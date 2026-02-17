import { InvoiceStatus } from '../invoice-state';

export interface Invoice {
    invoiceId: string;
    orderId: string;
    userId: string;
    walletAddress: string;
    amount: string;
    currency: string;
    network: string;
    status: InvoiceStatus;
    createdAt: string;
    expiresAt: string;
    txHash: string | null;
    paymentAddress: string; // From ForumPay
    lastIngestedEventId?: string;
}
