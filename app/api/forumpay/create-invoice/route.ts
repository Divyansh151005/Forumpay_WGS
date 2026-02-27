
import { NextResponse } from 'next/server';
import { invoiceService } from '@/lib/services';
import { Security } from '@/lib/security';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 0. Rate Limiting
        if (!rateLimit(request as any, 'create-invoice')) {
            return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
        }

        // 1. Validation & Security Checks
        const validatedData = Security.validateInvoiceRequest(body);

        // 2. AI Risk Check (Non-blocking)
        Security.aiRiskScore(validatedData.walletAddress, validatedData.amount);

        // 3. Orchestrate Invoice Creation via Service
        const invoice = await invoiceService.createInvoice({
            merchantId: 'WGS_MERCHANT', // Default or from context
            payerUserId: validatedData.userId,
            walletAddress: validatedData.walletAddress,
            amount: validatedData.amount,
            currency: validatedData.currency,
            network: 'ETH' // Default, should be configurable
        });

        return NextResponse.json(invoice.toJSON());

    } catch (error: any) {
        console.error("Invoice Creation Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
