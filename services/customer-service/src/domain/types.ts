/** Raw row shapes as returned by Postgres (snake_case columns). */
export interface CustomerRow {
  id: string;
  display_name: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface IdentityRow {
  id: string;
  customer_id: string;
  channel: string;
  external_id: string;
  display_name: string | null;
  created_at: Date;
}

/** API DTOs (camelCase, ISO dates). */
export interface IdentityDTO {
  channel: string;
  externalId: string;
  displayName?: string;
  createdAt: string;
}

export interface CustomerDTO {
  id: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
  identities: IdentityDTO[];
}

export function toIdentityDTO(row: IdentityRow): IdentityDTO {
  return {
    channel: row.channel,
    externalId: row.external_id,
    ...(row.display_name !== null ? { displayName: row.display_name } : {}),
    createdAt: row.created_at.toISOString(),
  };
}

export function toCustomerDTO(row: CustomerRow, identities: IdentityRow[]): CustomerDTO {
  return {
    id: row.id,
    ...(row.display_name !== null ? { displayName: row.display_name } : {}),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    identities: identities.map(toIdentityDTO),
  };
}
