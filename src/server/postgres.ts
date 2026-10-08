import { Pool, PoolClient, QueryResultRow } from 'pg';

/**
 * PostgreSQL repository adapter for isolated enterprise deployments.
 * It is opt-in: the application continues to use SQLite locally unless
 * DATABASE_URL is configured. No production connection is made by tests.
 */
export class PostgresRepositoryAdapter {
  private readonly pool: Pool;

  constructor(connectionString = process.env.DATABASE_URL) {
    if (!connectionString) throw new Error('DATABASE_URL is required for PostgreSQL mode');
    this.pool = new Pool({ connectionString, max: Number(process.env.PG_POOL_MAX || 10), ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: true } : undefined });
  }

  async healthCheck(): Promise<boolean> {
    const result = await this.pool.query('SELECT 1 AS ready');
    return result.rows[0]?.ready === 1;
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query<T>(text, values);
    return result.rows;
  }

  async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const value = await work(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> { await this.pool.end(); }
}
