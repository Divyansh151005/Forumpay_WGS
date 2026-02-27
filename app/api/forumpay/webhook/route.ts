
import { NextResponse } from 'next/server';
import { invoiceService } from '@/lib/services';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
    try {
        // 0. Rate Limiting
        if (!rateLimit(request as any, 'webhook')) {
            return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
        }

        const rawBody = await request.text();
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
            headers[key] = value;
        });

        // The InvoiceService handles signature verification and domain logic
        await invoiceService.handleWebhook(headers, rawBody);

        return NextResponse.json({ received: true });

    } catch (error: any) {
        if (error.message === 'Invalid webhook signature') {
            console.warn("Webhook signature verification failed");
            return NextResponse.json({ error: 'Invalid Signature' }, { status: 403 });
        }

        console.error("Webhook Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
