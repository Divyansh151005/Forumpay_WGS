
import { NextResponse } from 'next/server';
import { DynamoDBInvoiceRepository } from '@/infrastructure/persistence/DynamoDBInvoiceRepository';
import { invoiceService } from '@/lib/services';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic'; // Ensure not cached

const repository = new DynamoDBInvoiceRepository();

export async function GET(request: Request) {
    try {
        // 0. Rate Limiting
        if (!rateLimit(request as any, 'reconcile')) {
            return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
        }

        const pendingInvoices = await repository.findPending();
        console.log(`[Reconcile] Found ${pendingInvoices.length} pending invoices.`);

        const results = await Promise.allSettled(pendingInvoices.map(async (invoice) => {
            try {
                await invoiceService.reconcileInvoice(invoice.id);
                return { invoiceId: invoice.id, status: 'processed' };
            } catch (err: any) {
                console.error(`[Reconcile] Error checking invoice ${invoice.id}:`, err);
                return { invoiceId: invoice.id, status: 'error', error: err.message };
            }
        }));

        const summary = {
            total: pendingInvoices.length,
            processed: results.filter(r => r.status === 'fulfilled').length,
            errors: results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as any).status === 'error')).length
        };

        return NextResponse.json({ success: true, summary });

    } catch (error) {
        console.error("Reconciliation Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
