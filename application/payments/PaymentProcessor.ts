
export interface ProcessorInvoiceResponse {
    processorInvoiceId: string;
    paymentAddress: string;
    amount: string;
    currency: string;
    expiresAt: string;
    status: string;
}

export interface ProcessorWebhookEvent {
    processorInvoiceId: string;
    status: 'waiting' | 'paid' | 'expired' | 'failed' | 'unknown';
    txHash?: string;
    raw?: any;
}

export enum ProcessorStatus {
    WAITING = 'waiting',
    PAID = 'paid',
    EXPIRED = 'expired',
    FAILED = 'failed'
}

export interface PaymentProcessor {
    createProcessorInvoice(data: {
        amount: string;
        currency: string;
        orderId: string;
        payerId?: string;
    }): Promise<ProcessorInvoiceResponse>;

    verifyWebhook(headers: any, body: string): boolean;

    parseWebhook(body: any): ProcessorWebhookEvent;

    fetchProcessorStatus(processorInvoiceId: string): Promise<ProcessorStatus>;
}
