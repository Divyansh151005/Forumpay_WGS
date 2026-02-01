
import { NextResponse } from 'next/server';
import { InvoiceRepository } from '@/lib/db';
import { Security } from '@/lib/security';

export async function POST(request: Request) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-forumpay-signature') || '';

        // 1. Verify Signature
        if (!Security.verifyWebhookSignature(signature, rawBody, process.env.FORUMPAY_WEBHOOK_SECRET || '')) {
            return NextResponse.json({ error: 'Invalid Signature' }, { status: 401 });
        }

        const body = JSON.parse(rawBody);
        const { payment_id, status, tx_hash } = body;

        // 2. Update Invoice Logic
        // Mapping ForumPay status to our schema
        // ForumPay: confirmed, cancelled, timeout
        let newStatus: 'PENDING' | 'CONFIRMED' | 'PAID' | 'FAILED' | 'EXPIRED' = 'PENDING';

        if (status === 'confirmed') newStatus = 'PAID'; // Confirmed = Paid in our simplistic model
        else if (status === 'cancelled') newStatus = 'FAILED';
        else if (status === 'timeout') newStatus = 'EXPIRED';

        await InvoiceRepository.updateStatus(payment_id, newStatus, tx_hash);

        // 3. Trigger Business Logic (Stub)
        if (newStatus === 'PAID') {
            console.log(`[Service] Unlocking order for Invoice ${payment_id}`);
        }

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error("Webhook Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
