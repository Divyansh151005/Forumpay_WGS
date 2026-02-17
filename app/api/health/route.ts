import { NextResponse } from 'next/server';
import { InvoiceRepository } from '../../../lib/db';
import { rpcProvider } from '../../../lib/rpc/provider';
import { metrics } from '../../../lib/metrics';
import { env } from '../../../lib/env';

export async function GET() {
    const healthStatus: any = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || 'unknown',
        checks: {}
    };

    // 1. Check DB (DynamoDB)
    try {
        // Basic check: list pending or just access the table
        // For health check, a lightweight operation is best.
        // Maybe just check if we can read one item or scan limit 1
        // InvoiceRepository doesn't have a "ping" method, but we can try to FindById with a dummy ID 
        // and expect null (success) or error (failure).
        await InvoiceRepository.findById('PROBE-HEALTH-CHECK');
        healthStatus.checks.database = 'connected';
    } catch (e: any) {
        healthStatus.checks.database = `error: ${e.message}`;
        healthStatus.status = 'degraded';
    }

    // 2. Check RPC (Ethereum)
    try {
        const provider = rpcProvider.getProvider('ethereum');
        // Just get block number
        // We should use execute to use proper failover logic
        await Promise.race([
            provider.getBlockNumber(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);
        healthStatus.checks.rpc = 'connected';
    } catch (e: any) {
        healthStatus.checks.rpc = `error: ${e.message}`;
        // RPC failure might be critical or not depending on use case.
        // If all providers fail, it's degraded.
        healthStatus.status = 'degraded';
    }

    // 3. Metrics
    healthStatus.metrics = metrics.getAll();

    return NextResponse.json(healthStatus, {
        status: healthStatus.status === 'ok' ? 200 : 503
    });
}
