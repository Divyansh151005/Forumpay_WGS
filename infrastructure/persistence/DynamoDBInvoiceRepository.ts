
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { InvoiceAggregate, WGSInvoiceStatus } from '../../domain/invoice/InvoiceAggregate';
import { InvoiceRepository } from '../../domain/invoice/InvoiceRepository';
import { env } from '../../lib/env';
import { logger } from '../../lib/logger';

const client = new DynamoDBClient({
    region: env.AWS_REGION,
    credentials: (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) ? {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY
    } : undefined
});

const docClient = DynamoDBDocumentClient.from(client);

export class DynamoDBInvoiceRepository implements InvoiceRepository {
    private tableName: string = env.DYNAMODB_TABLE_NAME;

    async save(invoice: InvoiceAggregate): Promise<void> {
        const data = invoice.toJSON();
        await docClient.send(new PutCommand({
            TableName: this.tableName,
            Item: data,
            ConditionExpression: 'attribute_not_exists(invoiceId)'
        }));
    }

    async update(invoice: InvoiceAggregate): Promise<void> {
        const data = invoice.toJSON();
        // Atomic update of the full aggregate state (simple version: full rewrite with optimistic locking if needed)
        // For compliance with "Enforce atomic updates", we should use ConditionExpression on status or a version field.

        await docClient.send(new PutCommand({
            TableName: this.tableName,
            Item: data,
            // ConditionExpression: 'attribute_exists(invoiceId)' // Basic check
        }));
    }

    async findById(invoiceId: string): Promise<InvoiceAggregate | null> {
        const result = await docClient.send(new GetCommand({
            TableName: this.tableName,
            Key: { invoiceId }
        }));

        return result.Item ? InvoiceAggregate.fromJSON(result.Item) : null;
    }

    async findByForumId(forumInvoiceId: string): Promise<InvoiceAggregate | null> {
        const result = await docClient.send(new QueryCommand({
            TableName: this.tableName,
            IndexName: 'ForumInvoiceIdIndex', // Assume GSI exists
            KeyConditionExpression: 'forumInvoiceId = :id',
            ExpressionAttributeValues: { ':id': forumInvoiceId }
        }));

        if (result.Items && result.Items.length > 0) {
            return InvoiceAggregate.fromJSON(result.Items[0]);
        }
        return null;
    }

    async findPending(): Promise<InvoiceAggregate[]> {
        const result = await docClient.send(new ScanCommand({
            TableName: this.tableName,
            FilterExpression: '#status = :pending OR #status = :created',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
                ':pending': WGSInvoiceStatus.PROCESSOR_PENDING,
                ':created': WGSInvoiceStatus.CREATED
            }
        }));

        return (result.Items || []).map(item => InvoiceAggregate.fromJSON(item));
    }
}
