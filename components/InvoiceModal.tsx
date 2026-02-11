
'use client';

import { useState, useEffect } from 'react';
import { WGSWallet } from '@/lib/wgs-wallet-stub';
import { Copy, Check, Clock, ShieldCheck, X, AlertTriangle } from 'lucide-react';

import { QRCodeSVG } from 'qrcode.react';

interface InvoiceModalProps {
    invoice: any;
    onClose: () => void;
}

export default function InvoiceModal({ invoice, onClose }: InvoiceModalProps) {
    const [status, setStatus] = useState(invoice.status);
    const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 mins
    const [signing, setSigning] = useState(false);
    const [txHash, setTxHash] = useState(invoice.txHash);
    const [copied, setCopied] = useState(false);

    // Poll for status
    useEffect(() => {
        if (status === 'PAID' || status === 'FAILED') return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/invoice/${invoice.invoiceId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.status !== status) {
                        setStatus(data.status);
                        if (data.txHash) setTxHash(data.txHash);
                    }
                }
            } catch (ignore) {}
        }, 3000);

        // Timer
        const timer = setInterval(() => {
            setTimeLeft(t => Math.max(0, t - 1));
        }, 1000);

        return () => { clearInterval(interval); clearInterval(timer); };
    }, [status, invoice.invoiceId]);

    const handleCopy = () => {
        navigator.clipboard.writeText(invoice.paymentAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePayWallet = async () => {
        setSigning(true);
        try {
            const { signer } = await WGSWallet.connect();
            // 4. Trigger WGS Signing Key
            const tx = await WGSWallet.sendPayment(signer, invoice.paymentAddress, invoice.amount, invoice.currency, invoice.network);

            // Optimistic Update
            console.log("Transaction sent:", tx.hash);
            setTxHash(tx.hash);
            // We rely on polling for final status, but we can set to Processing/Detected if we had that state exposed in UI
            // For now, let's just wait for poll to pick up 'PAID' or 'CONFIRMED' from backend (simulated)
            
            // In a real app the webhook would come from ForumPay > Backend > DB > Poll updates Status
            // For this demo, we can simulate the webhook call if we want, OR just rely on the Manual Verification steps
            // Let's assume the user will use the "Simulate Webhook" script or we trigger it here for convenience?
            // User requirement: "Reconciliation Job ... Finds invoices stuck in PENDING"
            // Let's not simulate webhook here to force "Real Adapter" usage or manual trigger, 
            // BUT for the "Demo" experience we might want to auto-trigger it.
            // Actually, the previous code simulated webhook. Let's keep a simulation for the "Happy Path" demo 
            // but effectively we should rely on the backend.
            
            // To be "Production Ready", the frontend shouldn't fake the webhook.
            // But we can call checkStatus on the backend? 
            // The backend doesn't have a "force check" endpoint, only "get status".
            // Let's just mock the 'PAID' transition locally for immediate feedback if it succeeds?
            // No, that violates "Single Source of Truth".
            // We will just let polling handle it.
            
        } catch (error) {
            console.error("Signing failed:", error);
            alert("Payment cancelled or failed");
        } finally {
            setSigning(false);
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const paymentURI = WGSWallet.getPaymentURI(invoice.paymentAddress, invoice.amount, invoice.currency, invoice.network);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-panel w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                    <X size={20} />
                </button>

                <div className="flex items-center gap-2 mb-6">
                    <ShieldCheck className="text-success" />
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-success to-primary">Secure Payment</h2>
                </div>

                {status === 'PAID' ? (
                    <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/20 mb-4">
                            <Check size={32} className="text-success" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Payment Successful!</h3>
                        <p className="text-gray-400 mb-4">Your transaction has been confirmed.</p>
                        <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" className="text-sm text-primary hover:underline truncate block mx-auto max-w-[200px]">
                            {txHash}
                        </a>
                        <button onClick={onClose} className="btn-primary w-full mt-6">Return to Merchant</button>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center bg-white/5 rounded-lg p-3 mb-6">
                            <div className="text-sm text-gray-400">Amount Due</div>
                            <div className="text-2xl font-bold font-mono">{invoice.amount} {invoice.currency}</div>
                        </div>

                        <div className="flex flex-col items-center mb-6 p-4 bg-white rounded-lg">
                            <QRCodeSVG value={paymentURI} size={180} />
                            <p className="text-black text-xs mt-2 font-mono">Scan to Pay</p>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <div className="text-xs text-gray-500 mb-1 flex justify-between">
                                    <span>Payment Address ({invoice.network} / {invoice.currency})</span>
                                    <span className="flex items-center gap-1 text-orange-400"><Clock size={12} /> {formatTime(timeLeft)}</span>
                                </div>
                                <div className="flex gap-2">
                                    <code className="flex-1 bg-black/30 p-3 rounded border border-white/10 text-xs font-mono break-all text-gray-300">
                                        {invoice.paymentAddress}
                                    </code>
                                    <button onClick={handleCopy} className="p-3 rounded bg-white/10 hover:bg-white/20 transition-colors">
                                        {copied ? <Check size={18} className="text-success" /> : <Copy size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {status === 'CONFIRMED' || status === 'DETECTED' ? (
                            <div className="text-center py-4 animate-pulse">
                                <p className="text-success font-semibold">
                                    {status === 'DETECTED' ? 'Payment Detected...' : 'Confirming Transaction...'}
                                </p>
                            </div>
                        ) : (
                            <button
                                onClick={handlePayWallet}
                                disabled={signing}
                                className="btn-primary w-full py-4 text-lg shadow-lg shadow-primary/20 flex justify-center items-center gap-2"
                            >
                                {signing ? 'Requesting Signature...' : 'Pay from Wallet'}
                            </button>
                        )}

                        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                            <ShieldCheck size={12} />
                            <span>Scanned by WGS Security AI</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
