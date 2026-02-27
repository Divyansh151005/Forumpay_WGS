
import { InvoiceAggregate } from './InvoiceAggregate';

export interface InvoiceRepository {
    save(invoice: InvoiceAggregate): Promise<void>;
    update(invoice: InvoiceAggregate): Promise<void>;
    findById(invoiceId: string): Promise<InvoiceAggregate | null>;
    findByForumId(forumInvoiceId: string): Promise<InvoiceAggregate | null>;
    findPending(): Promise<InvoiceAggregate[]>;
}
