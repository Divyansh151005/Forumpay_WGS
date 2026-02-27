
import { NextResponse } from 'next/server';
import { DynamoDBInvoiceRepository } from '@/infrastructure/persistence/DynamoDBInvoiceRepository';

const repository = new DynamoDBInvoiceRepository();

export async function GET(request: Request, context: { params: Promise<{ invoiceId: string }> }) {
    try {
        const { invoiceId } = await context.params;

        if (!invoiceId) {
            return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
        }

        const invoice = await repository.findById(invoiceId);

        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        const data = invoice.toJSON();

        return NextResponse.json({
            status: data.status,
            amount: data.amount,
            currency: data.currency,
            network: data.network,
            txHash: data.txHash
        });

    } catch (error) {
        console.error("Get Invoice Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
