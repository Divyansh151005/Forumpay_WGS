
import { NextResponse } from 'next/server';
import { InvoiceRepository } from '@/lib/db';

export async function GET(request: Request, context: { params: Promise<{ invoiceId: string }> }) {
    try {
        const { invoiceId } = await context.params;

        if (!invoiceId) {
            return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
        }

        const invoice = await InvoiceRepository.findById(invoiceId);

        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        return NextResponse.json({
            status: invoice.status,
            amount: invoice.amount,
            currency: invoice.currency,
            network: invoice.network,
            txHash: invoice.txHash
        });

    } catch (error) {
        console.error("Get Invoice Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
