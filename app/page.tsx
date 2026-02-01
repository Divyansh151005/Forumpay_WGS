
import PayButton from '@/components/PayButton';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 relative overflow-hidden">

      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 rounded-full blur-[100px]" />
      </div>

      <div className="z-10 max-w-5xl w-full items-center justify-between text-sm flex flex-col gap-12">

        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-extrabold tracking-tighter mb-4">
            WGS <span className="gradient-text">Payment Layer</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Production-grade execution layer for non-custodial crypto payments.
            WGS handles the audit, security, and AI policy. ForumPay handles the rails.
          </p>
        </div>

        {/* Demo Card */}
        <div className="glass-panel p-8 w-full max-w-md mx-auto flex flex-col gap-6 items-center">
          <div className="w-full flex justify-between items-center text-gray-400 text-xs uppercase tracking-widest border-b border-white/5 pb-4">
            <span>Invoice #DEMO-001</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Active</span>
          </div>

          <div className="text-center space-y-2 py-4">
            <span className="text-gray-400 text-sm">Total Amount</span>
            <div className="text-5xl font-bold text-white">$250.00</div>
            <span className="px-3 py-1 bg-white/5 rounded-full text-xs text-gray-300 border border-white/10">USDC / ETH / MATIC</span>
          </div>

          <PayButton />

          <p className="text-xs text-center text-gray-500 mt-4">
            Secured by WGS Policy Engine. No private keys are shared with the payment provider.
          </p>
        </div>

        {/* Footer Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full text-center mt-12">
          <div className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition">
            <h3 className="text-white font-bold mb-2">Non-Custodial</h3>
            <p className="text-gray-400 text-xs">Funds move directly from wallet to merchant. No intermediaries hold assets.</p>
          </div>
          <div className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition">
            <h3 className="text-white font-bold mb-2">AI Secured</h3>
            <p className="text-gray-400 text-xs">Real-time fraud heuristics and spending policy checks before signing.</p>
          </div>
          <div className="p-4 rounded-lg bg-white/5 hover:bg-white/10 transition">
            <h3 className="text-white font-bold mb-2">Multi-Chain</h3>
            <p className="text-gray-400 text-xs">Supports Ethereum, Polygon, and 50+ other networks via ForumPay.</p>
          </div>
        </div>

      </div>
    </main>
  );
}
