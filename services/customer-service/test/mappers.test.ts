import { describe, expect, it } from 'vitest';
import { toCustomerDTO, toIdentityDTO } from '../src/domain/types.js';
import type { CustomerRow, IdentityRow } from '../src/domain/types.js';

const now = new Date('2026-01-01T00:00:00.000Z');

const identity: IdentityRow = {
  id: 'id_1',
  customer_id: 'customer_1',
  channel: 'webchat',
  external_id: 'visitor_1',
  display_name: 'Ana',
  created_at: now,
};

describe('toIdentityDTO', () => {
  it('maps snake_case to camelCase and serializes dates', () => {
    expect(toIdentityDTO(identity)).toEqual({
      channel: 'webchat',
      externalId: 'visitor_1',
      displayName: 'Ana',
      createdAt: now.toISOString(),
    });
  });

  it('omits displayName when null', () => {
    const dto = toIdentityDTO({ ...identity, display_name: null });
    expect('displayName' in dto).toBe(false);
  });
});

describe('toCustomerDTO', () => {
  it('nests identities and omits null displayName', () => {
    const customer: CustomerRow = {
      id: 'customer_1',
      display_name: null,
      created_at: now,
      updated_at: now,
    };
    const dto = toCustomerDTO(customer, [identity]);
    expect(dto).toEqual({
      id: 'customer_1',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      identities: [
        {
          channel: 'webchat',
          externalId: 'visitor_1',
          displayName: 'Ana',
          createdAt: now.toISOString(),
        },
      ],
    });
    expect('displayName' in dto).toBe(false);
  });
});
