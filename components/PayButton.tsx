
'use client';

import { useState } from 'react';
import { WGSWallet } from '@/lib/wgs-wallet-stub';
import InvoiceModal from './InvoiceModal'; // Correct import path
import { Loader2, Zap } from 'lucide-react';

export default function PayButton() {
    const [loading, setLoading] = useState(false);
    const [invoice, setInvoice] = useState<any>(null);
    const [error, setError] = useState('');

    const handlePayClick = async () => {
        setLoading(true);
        setError('');
        try {
            // 1. Connect Wallet to get User Context
            const { address } = await WGSWallet.connect();

            // 2. Create Invoice
            const response = await fetch('/api/forumpay/create-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: '50.00', // Hardcoded for demo
                    currency: 'ETH',
                    orderId: `ord_${Date.now()}`,
                    userId: 'user_123',
                    walletAddress: address
                })
            });

            if (!response.ok) throw new Error('Failed to create invoice');

            const invoiceData = await response.json();
            setInvoice(invoiceData);

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Payment intialization failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={handlePayClick}
                disabled={loading}
                className="btn-primary flex items-center gap-2 group"
            >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} className="group-hover:text-yellow-300 transition-colors" />}
                {loading ? 'Initializing...' : 'Pay with Crypto'}
            </button>

            {error && <p className="text-error mt-2 text-sm">{error}</p>}

            {invoice && (
                <InvoiceModal
                    invoice={invoice}
                    onClose={() => setInvoice(null)}
                />
            )}
        </>
    );
}
