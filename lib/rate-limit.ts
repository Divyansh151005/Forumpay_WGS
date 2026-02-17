import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
    capacity: number;
    refillRate: number; // tokens per second
}

const LIMITS: Record<string, RateLimitConfig> = {
    'create-invoice': { capacity: 10, refillRate: 1 },
    'webhook': { capacity: 50, refillRate: 10 },
    'reconcile': { capacity: 5, refillRate: 0.1 },
    'default': { capacity: 20, refillRate: 2 }
};

class TokenBucket {
    private tokens: number;
    private lastRefill: number;
    private config: RateLimitConfig;

    constructor(config: RateLimitConfig) {
        this.config = config;
        this.tokens = config.capacity;
        this.lastRefill = Date.now();
    }

    consume(): boolean {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }
        return false;
    }

    private refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        const newTokens = elapsed * this.config.refillRate;

        if (newTokens > 0) {
            this.tokens = Math.min(this.config.capacity, this.tokens + newTokens);
            this.lastRefill = now;
        }
    }
}

// In-memory store: IP -> Bucket
const buckets = new Map<string, TokenBucket>();

export function rateLimit(request: NextRequest, type: string = 'default') {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const key = `${ip}:${type}`;

    if (!buckets.has(key)) {
        buckets.set(key, new TokenBucket(LIMITS[type] || LIMITS['default']));
    }

    const bucket = buckets.get(key)!;

    if (!bucket.consume()) {
        return false;
    }

    return true;
}
