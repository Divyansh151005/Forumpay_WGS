
import { NextResponse } from 'next/server';
import { InvoiceRepository } from '@/lib/db';
import { forumPayClient } from '@/lib/forumpay/client';
import { InvoiceStatus } from '@/lib/invoice-state';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic'; // Ensure not cached

export async function GET(request: Request) {
    try {
        // Security: In production, verify a CRON_SECRET header from Vercel/Scheduler
        // const authHeader = request.headers.get('authorization');
        // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { return new Response('Unauthorized', { status: 401 }); }

        // 0. Rate Limiting
        if (!rateLimit(request as any, 'reconcile')) {
            return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
        }

        const pendingInvoices = await InvoiceRepository.findPending();
        console.log(`[Reconcile] Found ${pendingInvoices.length} pending invoices.`);

        const results = await Promise.allSettled(pendingInvoices.map(async (invoice) => {
            try {
                const fpData = await forumPayClient.checkStatus(invoice.invoiceId);

                let newStatus: InvoiceStatus | null = null;
                switch (fpData.status) {
                    case 'waiting':
                        newStatus = InvoiceStatus.PENDING;
                        break;
                    case 'processing':
                    case 'confirming':
                        newStatus = InvoiceStatus.DETECTED;
                        break;
                    case 'confirmed':
                        newStatus = InvoiceStatus.PAID;
                        break;
                    case 'cancelled':
                        newStatus = InvoiceStatus.FAILED;
                        break;
                    case 'timeout':
                        newStatus = InvoiceStatus.EXPIRED;
                        break;
                }

                if (newStatus && newStatus !== invoice.status) {
                    // Only update if changed
                    // Note: This transition logic must respect the State Machine in the Repository
                    await InvoiceRepository.updateStatus(invoice.invoiceId, newStatus, undefined, `reconcile-${Date.now()}`);
                    return { invoiceId: invoice.invoiceId, status: 'updated', newStatus };
                }
                return { invoiceId: invoice.invoiceId, status: 'unchanged' };

            } catch (err: any) {
                console.error(`[Reconcile] Error checking invoice ${invoice.invoiceId}:`, err);
                return { invoiceId: invoice.invoiceId, status: 'error', error: err.message };
            }
        }));

        const summary = {
            total: pendingInvoices.length,
            updated: results.filter(r => r.status === 'fulfilled' && (r.value as any).status === 'updated').length,
            errors: results.filter(r => r.status === 'rejected' || (r.value as any).status === 'error').length
        };

        return NextResponse.json({ success: true, summary });

    } catch (error) {
        console.error("Reconciliation Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
