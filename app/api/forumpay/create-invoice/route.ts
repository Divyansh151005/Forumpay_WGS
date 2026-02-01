
import { NextResponse } from 'next/server';
import { InvoiceRepository } from '@/lib/db';
import { Security } from '@/lib/security';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 1. Validation & Security Checks
        const validatedData = Security.validateInvoiceRequest(body);

        // 2. AI Risk Check (Non-blocking)
        Security.aiRiskScore(validatedData.walletAddress, validatedData.amount);

        // 3. Call ForumPay API (Mocked for MVP if no key)
        const FORUMPAY_API_KEY = process.env.FORUMPAY_API_KEY;
        const FORUMPAY_API_URL = process.env.FORUMPAY_API_URL || 'https://api.forumpay.com/v1';

        let paymentData;

        if (FORUMPAY_API_KEY) {
            // Real API Call
            const response = await fetch(`${FORUMPAY_API_URL}/invoice`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${FORUMPAY_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: validatedData.amount,
                    currency: validatedData.currency,
                    reference_no: validatedData.orderId
                })
            });
            if (!response.ok) throw new Error('ForumPay API Error');
            paymentData = await response.json();
        } else {
            // Mock Response for Development/Demo
            paymentData = {
                payment_id: `fp_${uuidv4().slice(0, 8)}`,
                address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', // Demo address
                amount: validatedData.amount,
                currency: validatedData.currency,
                reference_no: validatedData.orderId
            };
        }

        // 4. Persistence
        const newInvoice = {
            invoiceId: paymentData.payment_id,
            orderId: validatedData.orderId,
            userId: validatedData.userId,
            walletAddress: validatedData.walletAddress,
            amount: validatedData.amount,
            currency: validatedData.currency,
            network: 'ETH', // Defaulting for demo
            status: 'PENDING' as const,
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
