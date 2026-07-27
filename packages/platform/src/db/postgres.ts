import pg from 'pg';

export type PgPool = pg.Pool;
export type PgClient = pg.PoolClient;
export type PgQueryResult<T extends pg.QueryResultRow = pg.QueryResultRow> = pg.QueryResult<T>;

export interface PostgresConnection {
  pool: pg.Pool;
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<pg.QueryResult<T>>;
  /** Run `fn` inside a BEGIN/COMMIT, rolling back on any error. */
  withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface ConnectPostgresOptions {
  connectionString: string;
  max?: number;
}

/** Connect to PostgreSQL with a connection pool and a transaction helper. */
export async function connectPostgres(
  options: ConnectPostgresOptions,
): Promise<PostgresConnection> {
  const pool = new pg.Pool({ connectionString: options.connectionString, max: options.max ?? 10 });
  await pool.query('SELECT 1');

  return {
    pool,
    query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) {
      return pool.query<T>(text, params);
    },
    async withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}

/** True when an error is a PostgreSQL unique-violation (SQLSTATE 23505). */
export function isUniqueViolationError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}
