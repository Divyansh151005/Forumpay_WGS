
import { InvoiceAggregate, WGSInvoiceStatus } from '../../domain/invoice/InvoiceAggregate';
import { InvoiceRepository } from '../../domain/invoice/InvoiceRepository';
import { PaymentProcessor, ProcessorStatus } from './PaymentProcessor';
import { logger } from '../../lib/logger';
import { metrics } from '../../lib/metrics';

export class InvoiceService {
    constructor(
        private repository: InvoiceRepository,
        private processor: PaymentProcessor
    ) { }

    async createInvoice(data: {
        merchantId: string;
        payerUserId: string;
        walletAddress: string;
        amount: string;
        currency: string;
        network: string;
    }): Promise<InvoiceAggregate> {
        const invoiceId = `wgs_${Date.now()}`; // Or UUID
        const invoice = InvoiceAggregate.create({
            invoiceId,
            merchantId: data.merchantId,
            payerUserId: data.payerUserId,
            walletAddress: data.walletAddress,
            amount: data.amount,
            currency: data.currency,
            network: data.network,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000)
        });

        await this.repository.save(invoice);
        logger.info('WGS Invoice created', { invoiceId });

        try {
            const processorResponse = await this.processor.createProcessorInvoice({
                amount: data.amount,
                currency: data.currency,
                orderId: invoiceId,
                payerId: data.payerUserId
            });

            invoice.setForumInvoiceId(processorResponse.processorInvoiceId);
            await this.repository.update(invoice);

            logger.info('Processor invoice linked', {
                invoiceId,
                processorInvoiceId: processorResponse.processorInvoiceId
            });

            return invoice;
        } catch (error: any) {
            logger.error('Failed to create processor invoice', { invoiceId, error: error.message });
            invoice.markAsFailed();
            await this.repository.update(invoice);
            throw error;
        }
    }

    async handleWebhook(headers: any, body: string): Promise<void> {
        if (!this.processor.verifyWebhook(headers, body)) {
            throw new Error('Invalid webhook signature');
        }

        const event = this.processor.parseWebhook(JSON.parse(body));
        const invoice = await this.repository.findByForumId(event.processorInvoiceId);

        if (!invoice) {
            logger.warn('Invoice not found for webhook', { processorInvoiceId: event.processorInvoiceId });
            return;
        }

        const oldStatus = invoice.status;

        switch (event.status) {
            case 'paid':
                invoice.markAsPaid(event.txHash);
                break;
            case 'expired':
                invoice.markAsExpired();
                break;
            case 'failed':
                invoice.markAsFailed();
                break;
        }

        if (invoice.status !== oldStatus) {
            await this.repository.update(invoice);
            logger.info('Invoice status transitioned via webhook', {
                invoiceId: invoice.id,
                from: oldStatus,
                to: invoice.status
            });
            metrics.increment(`invoice_transition_${invoice.status.toLowerCase()}` as any);
        }
    }

    async reconcileInvoice(invoiceId: string): Promise<void> {
        const invoice = await this.repository.findById(invoiceId);
        if (!invoice || !invoice.forumInvoiceId) return;

        const status = await this.processor.fetchProcessorStatus(invoice.forumInvoiceId);
        const oldStatus = invoice.status;

        switch (status) {
            case ProcessorStatus.PAID:
                invoice.markAsPaid();
                break;
            case ProcessorStatus.EXPIRED:
                invoice.markAsExpired();
                break;
            case ProcessorStatus.FAILED:
                invoice.markAsFailed();
                break;
        }

        if (invoice.status !== oldStatus) {
            await this.repository.update(invoice);
            logger.info('Invoice reconciled', { invoiceId, from: oldStatus, to: invoice.status });
        }
    }
}
