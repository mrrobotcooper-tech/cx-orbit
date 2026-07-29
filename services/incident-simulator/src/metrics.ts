import { Counter, Gauge, type Registry } from '@cx-orbit/platform';

export interface IncidentMetrics {
  active: Gauge<'type' | 'code'>;
  started: Counter<'type' | 'code'>;
  ended: Counter<'type' | 'code' | 'reason'>;
  injections: Counter<'type' | 'kind'>;
}

export function createIncidentMetrics(registry: Registry): IncidentMetrics {
  return {
    active: new Gauge({
      name: 'cxorbit_incidents_active',
      help: 'Currently running simulated incidents',
      labelNames: ['type', 'code'],
      registers: [registry],
    }),
    started: new Counter({
      name: 'cxorbit_incidents_started_total',
      help: 'Simulated incidents started',
      labelNames: ['type', 'code'],
      registers: [registry],
    }),
    ended: new Counter({
      name: 'cxorbit_incidents_ended_total',
      help: 'Simulated incidents ended',
      labelNames: ['type', 'code', 'reason'],
      registers: [registry],
    }),
    injections: new Counter({
      name: 'cxorbit_incident_injections_total',
      help: 'Side-effect injections performed by the simulator (duplicates, floods, …)',
      labelNames: ['type', 'kind'],
      registers: [registry],
    }),
  };
}
