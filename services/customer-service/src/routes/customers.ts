import { type AppServer } from '@cx-orbit/platform';
import type { PostgresConnection } from '@cx-orbit/platform';
import { ChannelSchema } from '@cx-orbit/shared';
import { z } from 'zod';
import { toCustomerDTO } from '../domain/types.js';
import { getCustomer, getIdentitiesFor, listCustomers, resolveByIdentity } from '../repository.js';

export interface CustomerRoutesDeps {
  pg: PostgresConnection;
  defaultPageSize: number;
  maxPageSize: number;
}

export function registerCustomerRoutes(app: AppServer, deps: CustomerRoutesDeps): void {
  const listQuerySchema = z.object({
    channel: ChannelSchema.optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce
      .number()
      .int()
      .positive()
      .max(deps.maxPageSize)
      .default(deps.defaultPageSize),
  });

  // GET /customers — paginated list, optional channel filter, with identities.
  app.get('/customers', async (req, reply) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400);
      return {
        error: {
          code: 'invalid_query',
          message: 'Invalid query parameters',
          issues: parsed.error.issues,
        },
      };
    }
    const q = parsed.data;

    const { rows, total } = await listCustomers(deps.pg, {
      channel: q.channel,
      limit: q.pageSize,
      offset: (q.page - 1) * q.pageSize,
    });
    const identities = await getIdentitiesFor(
      deps.pg,
      rows.map((r) => r.id),
    );
    const byCustomer = new Map<string, typeof identities>();
    for (const identity of identities) {
      const list = byCustomer.get(identity.customer_id) ?? [];
      list.push(identity);
      byCustomer.set(identity.customer_id, list);
    }

    return {
      data: rows.map((row) => toCustomerDTO(row, byCustomer.get(row.id) ?? [])),
      pagination: {
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.ceil(total / q.pageSize),
      },
    };
  });

  // GET /customers/resolve?channel=&externalId= — reverse lookup by identity.
  app.get<{ Querystring: { channel?: string; externalId?: string } }>(
    '/customers/resolve',
    async (req, reply) => {
      const schema = z.object({ channel: ChannelSchema, externalId: z.string().min(1) });
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) {
        reply.code(400);
        return { error: { code: 'invalid_query', message: 'channel and externalId are required' } };
      }
      const customer = await resolveByIdentity(
        deps.pg,
        parsed.data.channel,
        parsed.data.externalId,
      );
      if (!customer) {
        reply.code(404);
        return { error: { code: 'not_found', message: 'No customer for that identity' } };
      }
      const identities = await getIdentitiesFor(deps.pg, [customer.id]);
      return { customer: toCustomerDTO(customer, identities) };
    },
  );

  // GET /customers/:id — one customer with identities.
  app.get<{ Params: { id: string } }>('/customers/:id', async (req, reply) => {
    const customer = await getCustomer(deps.pg, req.params.id);
    if (!customer) {
      reply.code(404);
      return { error: { code: 'not_found', message: 'Customer not found' } };
    }
    const identities = await getIdentitiesFor(deps.pg, [customer.id]);
    return { customer: toCustomerDTO(customer, identities) };
  });
}
