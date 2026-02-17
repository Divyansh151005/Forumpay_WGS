import { ethers } from 'ethers';
import { logger } from '../logger';
import { metrics } from '../metrics';
import { env } from '../env';

interface ChainConfig {
    chainId: number;
    name: string;
    rpcUrls: string[];
}

// Basic config mapping
const CHAINS: Record<string, ChainConfig> = {
    'ethereum': {
        chainId: 1,
        name: 'ethereum',
        rpcUrls: env.RPC_URLS_ETH ? env.RPC_URLS_ETH.split(',') : ['https://rpc.ankr.com/eth']
    },
    'polygon': {
        chainId: 137,
        name: 'polygon',
        rpcUrls: env.RPC_URLS_POLYGON ? env.RPC_URLS_POLYGON.split(',') : ['https://polygon-rpc.com']
    }
};

export class RpcProvider {
    private providers: Map<string, ethers.JsonRpcProvider[]> = new Map();
    private currentProviderIndex: Map<string, number> = new Map();

    constructor() {
        this.initProviders();
    }

    private initProviders() {
        Object.entries(CHAINS).forEach(([chain, config]) => {
            const providers = config.rpcUrls.map(url => new ethers.JsonRpcProvider(url));
            this.providers.set(chain, providers);
            this.currentProviderIndex.set(chain, 0);
        });
    }

    public getProvider(chain: string): ethers.JsonRpcProvider {
        const providers = this.providers.get(chain);
        if (!providers || providers.length === 0) {
            throw new Error(`No providers configured for chain: ${chain}`);
        }
        const index = this.currentProviderIndex.get(chain) || 0;
        return providers[index];
    }

    public async execute<T>(chain: string, operation: (provider: ethers.Provider) => Promise<T>): Promise<T> {
        const providers = this.providers.get(chain);
        if (!providers) throw new Error(`Unsupported chain: ${chain}`);

        let lastError: any;
        const startIndex = this.currentProviderIndex.get(chain) || 0;

        // Try each provider starting from current index
        for (let i = 0; i < providers.length; i++) {
            const currentIndex = (startIndex + i) % providers.length;
            const provider = providers[currentIndex];

            try {
                const result = await operation(provider);

                // If we succeeded and weren't using the primary, update the index to stick to this working one
                // (sticky session strategy)
                if (currentIndex !== startIndex) {
                    this.currentProviderIndex.set(chain, currentIndex);
                    logger.info('Switched RPC provider', { chain, newIndex: currentIndex });
                }

                return result;
            } catch (error: any) {
                lastError = error;
                logger.warn('RPC provider failed', { chain, index: currentIndex, error: error.message });
                metrics.increment('rpc_failure_total');

                // Slight backoff before trying next provider could be added here
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        logger.error('All RPC providers failed', { chain, error: lastError });
        throw lastError;
    }
}

export const rpcProvider = new RpcProvider();
