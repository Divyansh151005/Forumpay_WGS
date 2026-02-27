
import { PaymentProcessor, ProcessorInvoiceResponse, ProcessorWebhookEvent, ProcessorStatus } from '../../application/payments/PaymentProcessor';
import { forumPayClient } from '../../lib/forumpay/client';
import { Security } from '../../lib/security';

export class ForumPayProcessor implements PaymentProcessor {
    async createProcessorInvoice(data: {
        amount: string;
        currency: string;
        orderId: string;
        payerId?: string;
    }): Promise<ProcessorInvoiceResponse> {
        const response = await forumPayClient.startPayment({
            amount: data.amount,
            currency: data.currency,
            orderId: data.orderId,
            payerId: data.payerId
        });

        return {
            processorInvoiceId: response.payment_id,
            paymentAddress: response.address,
            amount: response.amount,
            currency: response.currency,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // ForumPay default approx
            status: response.status
        };
    }

    verifyWebhook(headers: any, body: string): boolean {
        const signature = headers['x-forumpay-signature'] || '';
        const secret = process.env.FORUMPAY_WEBHOOK_SECRET;
        return Security.verifyWebhookSignature(signature, body, secret);
    }

    parseWebhook(body: any): ProcessorWebhookEvent {
        const { payment_id, status, tx_hash } = body;

        let mappedStatus: 'waiting' | 'paid' | 'expired' | 'failed' | 'unknown' = 'unknown';

        switch (status) {
            case 'waiting':
                mappedStatus = 'waiting';
                break;
            case 'processing':
            case 'confirming':
            case 'confirmed':
                mappedStatus = 'paid';
                break;
            case 'cancelled':
                mappedStatus = 'failed';
                break;
            case 'timeout':
                mappedStatus = 'expired';
                break;
        }

        return {
            processorInvoiceId: payment_id,
            status: mappedStatus,
            txHash: tx_hash,
            raw: body
        };
    }

    async fetchProcessorStatus(processorInvoiceId: string): Promise<ProcessorStatus> {
        const response = await forumPayClient.checkStatus(processorInvoiceId);

        switch (response.status) {
            case 'waiting':
                return ProcessorStatus.WAITING;
            case 'confirmed':
                return ProcessorStatus.PAID;
            case 'cancelled':
                return ProcessorStatus.FAILED;
            case 'timeout':
                return ProcessorStatus.EXPIRED;
            default:
                return ProcessorStatus.WAITING;
        }
    }
}
