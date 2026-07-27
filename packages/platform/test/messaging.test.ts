import { describe, expect, it } from 'vitest';
import { EVENT_SUBJECT_PREFIX, eventSubject } from '../src/index.js';

describe('event subjects', () => {
  it('namespaces every event type under the prefix', () => {
    expect(eventSubject('message.received')).toBe(`${EVENT_SUBJECT_PREFIX}.message.received`);
    expect(eventSubject('routing.completed')).toBe(`${EVENT_SUBJECT_PREFIX}.routing.completed`);
  });
});
