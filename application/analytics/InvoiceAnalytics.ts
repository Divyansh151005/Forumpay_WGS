
import { InvoiceAggregate, WGSInvoiceStatus } from '../../domain/invoice/InvoiceAggregate';
import { logger } from '../../lib/logger';

export class InvoiceAnalytics {
    public async trackInvoiceTransition(invoice: InvoiceAggregate, oldStatus?: WGSInvoiceStatus): Promise<void> {
        const data = invoice.props_copy;

        logger.info('Analytics Event: Invoice State Change', {
            invoiceId: data.invoiceId,
            status: data.status,
            prevStatus: oldStatus,
            amount: data.amount,
            currency: data.currency,
            merchantId: data.merchantId
        });

        if (data.status === WGSInvoiceStatus.PAID) {
            this.reportRevenue(data);
        }
    }

    private reportRevenue(data: any): void {
        // Stub for revenue tracking system
        logger.info('Revenue tracking stub', {
            amount: data.amount,
            currency: data.currency,
            merchantId: data.merchantId
        });
    }
}
