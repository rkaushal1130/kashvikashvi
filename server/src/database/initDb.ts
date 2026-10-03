import fs from 'fs';
import path from 'path';
import { pool, checkDbConnection } from '../config/db.js';

export async function initializeDatabase() {
  console.log('[DB-Init] Checking PostgreSQL connection...');
  const isConnected = await checkDbConnection();

  if (!isConnected) {
    console.warn('[DB-Init] PostgreSQL server is not responding or credentials need configuration.');
    console.log('[DB-Init] Running in offline / mock-resilient mode.');
    return { success: false, mode: 'OFFLINE_RESILIENT' };
  }

  const client = await pool.connect();
  try {
    const candidateDirs = [
      path.join(process.cwd(), 'src/database'),
      path.join(process.cwd(), 'server/src/database'),
      path.join(process.cwd(), 'dist/database'),
    ];
    const baseDir = candidateDirs.find((d) => fs.existsSync(path.join(d, 'schema.sql'))) || candidateDirs[0];

    console.log('[DB-Init] Executing database migration (schema.sql)...');
    const schemaPath = path.join(baseDir, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schemaSql);
      console.log('[DB-Init] Migration schema.sql executed successfully.');
    }

    console.log('[DB-Init] Executing database seed (seed.sql)...');
    const seedPath = path.join(baseDir, 'seed.sql');
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await client.query(seedSql);
      console.log('[DB-Init] Seed seed.sql executed successfully.');
    }

    console.log('[DB-Init] Database initialization completed successfully.');
    return { success: true, mode: 'DATABASE_ONLINE' };
  } catch (err: any) {
    console.error('[DB-Init] Database initialization encountered an error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

// Allow direct execution: npx tsx src/database/initDb.ts
if (process.argv[1] && process.argv[1].endsWith('initDb.ts')) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
