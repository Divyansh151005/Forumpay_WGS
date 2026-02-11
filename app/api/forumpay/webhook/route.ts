
import { NextResponse } from 'next/server';
import { InvoiceRepository } from '@/lib/db';
import { Security } from '@/lib/security';
import { InvoiceStatus } from '@/lib/invoice-state';

export async function POST(request: Request) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-forumpay-signature') || '';
        const timestamp = request.headers.get('x-forumpay-timestamp') || '';

        // 1. Verify Signature
        if (!Security.verifyWebhookSignature(signature, rawBody, process.env.FORUMPAY_WEBHOOK_SECRET)) {
            console.warn("Webhook signature verification failed");
            return NextResponse.json({ error: 'Invalid Signature' }, { status: 403 });
        }

        // 2. Verify Timestamp (Replay Protection)
        if (!Security.validateTimestamp(timestamp)) {
            console.warn("Webhook timestamp validation failed");
            return NextResponse.json({ error: 'Request Expired' }, { status: 400 });
        }

        const body = JSON.parse(rawBody);
        const { payment_id, status, tx_hash } = body;

        // Construct a unique event ID for idempotency (using payment_id + status if no native event_id)
        // Ideally ForumPay sends an 'event_id' or 'trace_id'
        const eventId = body.event_id || `${payment_id}:${status}`;

        // 3. Map Status
        
        // Mapping ForumPay status to our InvoiceStatus
        let newStatus: InvoiceStatus | null = null;

        switch (status) {
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
            default:
                console.log(`Unknown status received: ${status}`);
        }

        if (newStatus) {
            // 4. Update Invoice with Idempotency
            try {
                await InvoiceRepository.updateStatus(payment_id, newStatus, tx_hash, eventId);
            } catch (e: any) {
                // If it's a state transition error, we might want to return 200 to stop retries if it's an "old" message
                // typically we log and ignore
                console.warn(`Failed to update invoice ${payment_id}: ${e.message}`);
                // return 200 to acknowledge receipt even if logic failed (e.g. outdated status)
            }
        }

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error("Webhook Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
