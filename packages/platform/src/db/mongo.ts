import {
  MongoClient,
  MongoServerError,
  type Collection,
  type Db,
  type ClientSession,
  type MongoClientOptions,
} from 'mongodb';

export { MongoClient, MongoServerError };
export type { Collection, Db, ClientSession };

/** True when an error is a MongoDB duplicate-key (E11000) violation. */
export function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof MongoServerError && err.code === 11000;
}

export interface MongoConnection {
  client: MongoClient;
  db: Db;
  close(): Promise<void>;
}

export interface ConnectMongoOptions {
  uri: string;
  /** Overrides the database encoded in the URI, if provided. */
  dbName?: string;
  clientOptions?: MongoClientOptions;
}

/**
 * Connect to MongoDB and return a thin wrapper exposing the client and a `Db`
 * handle. The deployment runs Mongo as a single-node replica set so that
 * multi-document transactions (used by the Outbox — ADR-005) are available.
 */
export async function connectMongo(options: ConnectMongoOptions): Promise<MongoConnection> {
  const client = new MongoClient(options.uri, options.clientOptions);
  await client.connect();
  const db = options.dbName ? client.db(options.dbName) : client.db();
  return {
    client,
    db,
    async close(): Promise<void> {
      await client.close();
    },
  };
}
