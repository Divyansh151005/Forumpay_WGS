
import { NextResponse } from 'next/server';
import { InvoiceRepository } from '@/lib/db';
import { Security } from '@/lib/security';
import { forumPayClient } from '@/lib/forumpay/client';
import { InvoiceStatus } from '@/lib/invoice-state';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 1. Validation & Security Checks
        const validatedData = Security.validateInvoiceRequest(body);

        // 2. AI Risk Check (Non-blocking)
        Security.aiRiskScore(validatedData.walletAddress, validatedData.amount);

        // 3. Call ForumPay API via Adapter
        const paymentData = await forumPayClient.startPayment({
            amount: validatedData.amount,
            currency: validatedData.currency,
            orderId: validatedData.orderId,
            payerId: validatedData.userId
        });

        // 4. Persistence
        const newInvoice = {
            invoiceId: paymentData.payment_id,
            orderId: validatedData.orderId,
            userId: validatedData.userId,
            walletAddress: validatedData.walletAddress,
            amount: validatedData.amount,
            currency: validatedData.currency,
            network: 'ETH', // Defaulting for demo, could be extracted from request if needed
            status: InvoiceStatus.PENDING,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 mins
            txHash: null,
            paymentAddress: paymentData.address
        };

        await InvoiceRepository.save(newInvoice);

        return NextResponse.json(newInvoice);

    } catch (error: any) {
        console.error("Invoice Creation Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
