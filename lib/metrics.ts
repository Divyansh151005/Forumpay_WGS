type MetricName =
    | 'invoice_created_total'
    | 'invoice_paid_total'
    | 'webhook_invalid_signature_total'
    | 'reconciliation_fixed_total'
    | 'rpc_failure_total'
    | 'db_error_total';

class MetricsRegistry {
    private counters: Map<MetricName, number> = new Map();

    constructor() {
        this.reset();
    }

    public increment(name: MetricName, labels: Record<string, string> = {}) {
        const current = this.counters.get(name) || 0;
        this.counters.set(name, current + 1);
        // In a real system, we would store labels properly (e.g., Prometheus format)
        // For now, simple counter.
    }

    public get(name: MetricName): number {
        return this.counters.get(name) || 0;
    }

    public getAll(): Record<string, number> {
        const result: Record<string, number> = {};
        this.counters.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    public reset() {
        this.counters.set('invoice_created_total', 0);
        this.counters.set('invoice_paid_total', 0);
        this.counters.set('webhook_invalid_signature_total', 0);
        this.counters.set('reconciliation_fixed_total', 0);
        this.counters.set('rpc_failure_total', 0);
        this.counters.set('db_error_total', 0);
    }
}

export const metrics = new MetricsRegistry();
