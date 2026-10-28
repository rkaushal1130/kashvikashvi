import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.resolve(rootDir, 'backend');

/**
 * Automates Prisma database schema synchronization during build/deployment.
 *
 * In production deployments (such as Vercel), this ensures that all tables, enums,
 * and columns (like `users.status`) defined in schema.prisma are synchronized
 * directly to the remote database, mirroring local behavior.
 */
function syncDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log('ℹ️ [db-sync] No DATABASE_URL found in environment, skipping automated db push.');
    return;
  }

  if (process.env.SKIP_DB_SYNC === 'true') {
    console.log('ℹ️ [db-sync] SKIP_DB_SYNC is true, skipping automated db push.');
    return;
  }

  console.log('🔄 [db-sync] DATABASE_URL detected. Synchronizing PostgreSQL schema via Prisma db push...');

  const res = spawnSync('npm', ['run', 'prisma:db:push'], {
    stdio: 'inherit',
    env: process.env,
    cwd: backendDir,
  });

  if (res.status === 0) {
    console.log('✅ [db-sync] Database schema synchronized successfully.');

    // Automatically enforce 3 canonical roles on deployment
    console.log('🔄 [db-sync] Enforcing 3 canonical roles (Admin, Distributor, Customer Care)...');
    spawnSync('npx', ['tsx', 'scripts/migrate-roles.ts'], {
      stdio: 'inherit',
      env: process.env,
      cwd: backendDir,
    });
  } else {
    console.warn(`⚠️ [db-sync] Automated db push exited with code ${res.status}. Continuing build...`);
    console.warn('ℹ️ [db-sync] If your remote database requires direct terminal sync, run:');
    console.warn('ℹ️ [db-sync]   DATABASE_URL="<your_vercel_db_url>" npm run db:push');
  }
}

syncDatabase();
