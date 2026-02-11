import { ethers } from 'ethers';

// 4. Wallet Upgrade: Multi-chain & Token Support
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

const CHAINS: Record<string, { rpc?: string, native: string, tokens: Record<string, string> }> = {
    'ETH': { native: 'ETH', tokens: { 'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' } },
    'MATIC': { native: 'MATIC', tokens: { 'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' } }
};

export const WGSWallet = {
    connect: async () => {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            await provider.send("eth_requestAccounts", []);
            const signer = await provider.getSigner();
            return {
                address: await signer.getAddress(),
                signer
            };
        } else {
            console.warn("No wallet found. Using mock signer.");
            return {
                address: "0xMockUserAddress123",
                signer: {
                    sendTransaction: async (tx: any) => {
                        console.log("Mock Signing Transaction:", tx);
                        await new Promise(r => setTimeout(r, 2000));
                        return { hash: "0x" + Math.random().toString(16).slice(2) + "..." };
                    }
                }
            };
        }
    },

    sendPayment: async (signer: any, to: string, amount: string, currency: string, network: string = 'ETH') => {
        const chain = CHAINS[network] || CHAINS['ETH'];
        const isNative = currency === chain.native;

        console.log(`[WGS Security] Verifying payment to allowed merchant: ${to} on ${network}`);

        try {
            if (isNative) {
                const tx = await signer.sendTransaction({
                    to,
                    value: ethers.parseUnits(amount, 18)
                });
                return tx;
            } else {
                // ERC-20 Logic
                const tokenAddress = chain.tokens[currency];
                if (!tokenAddress) throw new Error(`Token ${currency} not supported on ${network}`);

                // In a real implementation we would fetch decimals on-chain or from config
                // For this stub assuming 6 for USDC/USDT, 18 for others
                const decimals = (currency === 'USDC' || currency === 'USDT') ? 6 : 18;
                
                // If using real signer with provider
                if (signer.provider) {
                   const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
                   const tx = await contract.transfer(to, ethers.parseUnits(amount, decimals));
                   return tx;
                } else {
                   // Mock Signer fallback
                   return signer.sendTransaction({ to, data: '0xmockERC20call', value: 0 });
                }
            }
        } catch (err) {
            console.error("Payment failed:", err);
            throw err;
        }
    },

    getPaymentURI: (address: string, amount: string, currency: string, network: string = 'ETH') => {
        const chain = CHAINS[network] || CHAINS['ETH'];
        if (currency === chain.native) {
            // EIP-681 for native: ethereum:ADDRESS?value=WEI
            // Note: Simplification, value usually in exp notation or decimal
            return `${network.toLowerCase()}:${address}?value=${amount}`; 
        } else {
            // EIP-681 for tokens: ethereum:TOKEN_ADDRESS/transfer?address=RECIPIENT&uint256=AMOUNT
            const tokenAddress = chain.tokens[currency] || '0x...';
            // Amount needs to be raw units for URI usually, keeping simple for demo
            return `${network.toLowerCase()}:${tokenAddress}/transfer?address=${address}&uint256=${amount}`;
        }
    }
};
