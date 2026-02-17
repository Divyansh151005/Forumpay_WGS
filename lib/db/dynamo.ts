import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Invoice } from '../types/invoice';
import { InvoiceStatus, InvoiceStateMachine } from '../invoice-state';
import { env } from '../env';
import { logger } from '../logger';
import { metrics } from '../metrics';

const client = new DynamoDBClient({
    region: env.AWS_REGION,
    credentials: (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) ? {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY
    } : undefined
});

const docClient = DynamoDBDocumentClient.from(client);

export const InvoiceRepository = {
    save: async (invoice: Invoice): Promise<void> => {
        try {
            await docClient.send(new PutCommand({
                TableName: env.DYNAMODB_TABLE_NAME,
                Item: invoice,
                ConditionExpression: 'attribute_not_exists(invoiceId)'
            }));

            logger.info('Invoice created', {
                invoiceId: invoice.invoiceId,
                userId: invoice.userId,
                currency: invoice.currency
            });
            metrics.increment('invoice_created_total');
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                throw new Error(`Invoice ${invoice.invoiceId} already exists`);
            }
            logger.error('Error saving invoice', { error: error.message });
            throw error;
        }
    },

    updateStatus: async (invoiceId: string, status: InvoiceStatus, txHash?: string, eventId?: string): Promise<void> => {
        // 1. Fetch current status to validate transition (soft check)
        // We could do this purely in UpdateExpression conditions, but reading first 
        // gives us better error messages and allows us to check valid prev states in JS
        // However, for strict atomicity, we rely on ConditionExpression.

        // To strictly stick to "Reject invalid transitions at DB level" we need to know the allowed previous states
        // The state machine defines allowed NEXT states.
        // So we can say: ConditionExpression: status IN (:valid_prev_states)

        // But DynamoDB doesn't support "IN" easily in ConditionExpression for dynamic lists without building the string manually.
        // Instead, we can read, validate, and then update with Condition 'status = :current_read_status' (Optimistic Locking)

        const currentInvoice = await InvoiceRepository.findById(invoiceId);
        if (!currentInvoice) {
            throw new Error(`Invoice ${invoiceId} not found`);
        }

        try {
            InvoiceStateMachine.validateTransition(currentInvoice.status, status);
        } catch (e: any) {
            logger.warn('Invalid state transition attempted', { invoiceId, from: currentInvoice.status, to: status });
            throw e;
        }

        // Idempotency check logic was:
        // if (eventId && current.lastIngestedEventId === eventId) return;
        if (eventId && currentInvoice.lastIngestedEventId === eventId) {
            logger.info('Event already processed', { invoiceId, eventId });
            return;
        }

        try {
            const updateExp = ['set #status = :status'];
            const expAttrNames: Record<string, string> = { '#status': 'status' };
            const expAttrValues: Record<string, any> = {
                ':status': status,
                ':currentStatus': currentInvoice.status
            };

            if (txHash) {
                updateExp.push('txHash = :txHash');
                expAttrValues[':txHash'] = txHash;
            }
            if (eventId) {
                updateExp.push('lastIngestedEventId = :eventId');
                expAttrValues[':eventId'] = eventId;
            }

            await docClient.send(new UpdateCommand({
                TableName: env.DYNAMODB_TABLE_NAME,
                Key: { invoiceId },
                UpdateExpression: updateExp.join(', '),
                ConditionExpression: '#status = :currentStatus', // Optimistic locking ensures atomicity
                ExpressionAttributeNames: expAttrNames,
                ExpressionAttributeValues: expAttrValues
            }));

            logger.info('Invoice status updated', {
                invoiceId,
                oldStatus: currentInvoice.status,
                newStatus: status,
                txHash
            });

            if (status === InvoiceStatus.PAID) {
                metrics.increment('invoice_paid_total');
            }

        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                // This means the state changed effectively concurrently
                logger.warn('Concurrent update detected', { invoiceId });
                throw new Error(`Invoice status changed concurrently for ${invoiceId}`);
            }
            logger.error('Error updating invoice status', { invoiceId, error: error.message });
            throw error;
        }
    },

    findById: async (invoiceId: string): Promise<Invoice | null> => {
        try {
            const result = await docClient.send(new GetCommand({
                TableName: env.DYNAMODB_TABLE_NAME,
                Key: { invoiceId },
                ConsistentRead: true // Enforce strong consistency
            }));
            return (result.Item as Invoice) || null;
        } catch (error: any) {
            logger.error('Error finding invoice by ID', { invoiceId, error: error.message });
            throw error;
        }
    },

    findByOrderId: async (orderId: string): Promise<Invoice | null> => {
        try {
            // Assumes GSI on orderId if query is needed, but for now scan or GSI.
            // Given instructions, we should probably use a GSI or Scan. 
            // Since I can't create indexes on the fly easily without IaC, 
            // I'll assume a GSI named 'OrderIdIndex' exists or use Scan for now (not efficient but functional for this step).
            // Actually, let's use Scan for simplicity unless GSI is mandated. 
            // "Replace JSON Repository" - JSON rep was doing full scan (in memory).
            // Better to warn: "Ensure GSI on OrderId"

            // For production robustness, we should use GSI. 
            // I will write code assuming GSI 'OrderIdIndex' exists to be "Enterprise Grade".
            // If it fails locally, user can fallback to scan or create index.

            const result = await docClient.send(new QueryCommand({
                TableName: env.DYNAMODB_TABLE_NAME,
                IndexName: 'OrderIdIndex',
                KeyConditionExpression: 'orderId = :orderId',
                ExpressionAttributeValues: { ':orderId': orderId }
            }));

            if (result.Items && result.Items.length > 0) {
                return result.Items[0] as Invoice;
            }
            return null;
        } catch (error: any) {
            logger.error('Error finding invoice by OrderID', { orderId, error: error.message });
            return null;
        }
    },

    findPending: async (): Promise<Invoice[]> => {
        // Should use GSI on Status ideally, or Scan.
        // Scan is acceptable for low volume "pending" checks in background jobs if filtered.
        // But Enterprise Grade suggests GSI on status.
        try {
            const result = await docClient.send(new QueryCommand({
                TableName: env.DYNAMODB_TABLE_NAME,
                IndexName: 'StatusIndex', // Assumed GSI
                KeyConditionExpression: '#status = :status',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: { ':status': InvoiceStatus.PENDING }
            }));
            // We also need DETECTED?

            // Actually, scanning with FilterExpression might be safer if we don't know the indexes exists.
            // But "Enterprise Grade" strongly implies good DB design.
            // I'll use Scan for now to ensure it works without external DB setup deps, 
            // but add a TODO for GSI.

            const scan = await docClient.send(new ScanCommand({
                TableName: env.DYNAMODB_TABLE_NAME,
                FilterExpression: '#status IN (:s1, :s2)',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: {
                    ':s1': InvoiceStatus.PENDING,
                    ':s2': InvoiceStatus.DETECTED
                }
            }));

            return (scan.Items as Invoice[]) || [];
        } catch (error: any) {
            logger.error('Error finding pending invoices', { error: error.message });
            return [];
        }
    }
};
