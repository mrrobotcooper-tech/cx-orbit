import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
  type Metric,
} from 'prom-client';

export { Counter, Gauge, Histogram, Registry };
export type { Metric };

export interface Metrics {
  registry: Registry;
  httpRequestsTotal: Counter<'method' | 'route' | 'status'>;
  httpRequestDurationSeconds: Histogram<'method' | 'route' | 'status'>;
}

/**
 * Per-service Prometheus registry with Node process default metrics plus
 * standard HTTP RED metrics (Rate, Errors, Duration). Services add their own
 * domain metrics against `metrics.registry`.
 */
export function createMetrics(service: string): Metrics {
  const registry = new Registry();
  registry.setDefaultLabels({ service });
  collectDefaultMetrics({ register: registry });

  const httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [registry],
  });

  const httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  return { registry, httpRequestsTotal, httpRequestDurationSeconds };
}
