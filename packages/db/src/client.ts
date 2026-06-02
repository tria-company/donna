import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Create a Drizzle database client.
 * 
 * @param databaseUrl - PostgreSQL connection string
 * @param options - Additional postgres.js options
 * @returns Drizzle database client with full schema
 */
export function createDb(databaseUrl: string, options?: postgres.Options<{}>) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  // Connection tuned for the Supabase transaction pooler (Supavisor):
  //  - prepare:false      — pooler can't keep prepared statements across txns.
  //  - idle_timeout:20    — RELEASE idle connections back to the pooler. Without
  //    this, postgres.js holds every opened socket open forever; the API's
  //    several pools together pin ~15 slots = the pooler's per-user limit, which
  //    starves other clients (and the API's own request bursts) until even
  //    `select 1` hangs ~30s. Releasing idle sockets keeps the slot pool free.
  //  - connect_timeout:10 — fail fast instead of hanging the default ~30s when
  //    the pooler is momentarily out of slots, so a request errors and retries
  //    instead of pinning a slot (and tripping the frontend's 30s timeout).
  //  - max:8              — modest ceiling; combined with idle_timeout the
  //    steady-state footprint is near zero. Callers may override via `options`.
  const client = postgres(databaseUrl, {
    prepare: false,
    max: 8,
    idle_timeout: 20,
    connect_timeout: 10,
    ...options,
  });

  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;