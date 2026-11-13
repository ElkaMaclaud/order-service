import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export const PG_POOL = 'PG_POOL';
export const DATABASE = 'DATABASE';
export type Database = NodePgDatabase<typeof schema>;
