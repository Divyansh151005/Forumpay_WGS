
import { DynamoDBInvoiceRepository } from '../infrastructure/persistence/DynamoDBInvoiceRepository';
import { ForumPayProcessor } from '../infrastructure/processors/ForumPayProcessor';
import { InvoiceService } from '../application/payments/InvoiceService';
import { InvoiceAnalytics } from '../application/analytics/InvoiceAnalytics';

const repository = new DynamoDBInvoiceRepository();
const processor = new ForumPayProcessor();
const analytics = new InvoiceAnalytics();

export const invoiceService = new InvoiceService(repository, processor);
export const invoiceAnalytics = analytics;
