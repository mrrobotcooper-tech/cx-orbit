import { describe, expect, it } from 'vitest';
import { createMetrics } from '../src/index.js';

describe('createMetrics', () => {
  it('exposes HTTP metrics labeled with the service', async () => {
    const metrics = createMetrics('test-svc');
    metrics.httpRequestsTotal.inc({ method: 'GET', route: '/x', status: '200' });
    metrics.httpRequestDurationSeconds.observe({ method: 'GET', route: '/x', status: '200' }, 0.01);

    const output = await metrics.registry.metrics();
    expect(output).toContain('http_requests_total');
    expect(output).toContain('http_request_duration_seconds');
    expect(output).toContain('service="test-svc"');
  });

  it('includes Node default process metrics', async () => {
    const metrics = createMetrics('defaults-svc');
    const output = await metrics.registry.metrics();
    expect(output).toContain('process_cpu_user_seconds_total');
  });
});
