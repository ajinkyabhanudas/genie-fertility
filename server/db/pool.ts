/**
 * @file pool.ts
 * @description Shared Postgres connection pool. DATABASE_URL is read once at
 * module load; every route/module imports `pool` rather than constructing
 * its own client.
 */

import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
