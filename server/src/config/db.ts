import pg from 'pg';
import { config } from './env.js';

const { Pool } = pg;

export const pool = new Pool(
  config.databaseUrl
    ? {
        connectionString: config.databaseUrl,
        max: parseInt(process.env.DB_POOL_MAX || '20', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    : {
        host: config.dbHost,
        port: config.dbPort,
        user: config.dbUser,
        password: config.dbPassword,
        database: config.dbName,
        max: parseInt(process.env.DB_POOL_MAX || '20', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
);

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected error on idle client:', err);
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  try {
    const start = Date.now();
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    return res;
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED' || err.name === 'AggregateError' || err.message?.includes('ECONNREFUSED')) {
      return {
        rows: [],
        rowCount: 0,
        command: '',
        oid: 0,
        fields: []
      } as pg.QueryResult<T>;
    }
    throw err;
  }
}

export async function checkDbConnection(): Promise<boolean> {
  try {
    const res = await query('SELECT NOW()');
    return Boolean(res.rows[0]);
  } catch (err) {
    console.warn('[PostgreSQL] Warning: Database connection check failed or database offline. Running with fallback / mock safety.', err);
    return false;
  }
}

export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED' || err.name === 'AggregateError' || err.message?.includes('ECONNREFUSED')) {
      const mockClient: any = {
        query: async (text: string, params?: any[]) => query(text, params),
        release: () => {},
      };
      return await callback(mockClient);
    }
    throw err;
  }

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // client error during rollback
    }
    throw err;
  } finally {
    if (client) {
      client.release();
    }
  }
}

export const testDbConnection = checkDbConnection;

