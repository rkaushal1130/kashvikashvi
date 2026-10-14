import { execSync } from 'child_process';

/**
 * Automates Prisma database schema synchronization during build/deployment.
 *
 * In production deployments (such as Vercel), this ensures that all tables, enums,
 * and columns (like `users.status`) defined in schema.prisma are synchronized
 * directly to the remote database (e.g. Neon, Supabase, RDS), mirroring local behavior.
 */
function syncDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log('ℹ️ [db-sync] No DATABASE_URL found in environment, skipping automated db push.');
    return;
  }

  // Prevent accidentally pushing to localhost if running an isolated production build locally
  if (process.env.SKIP_DB_SYNC === 'true') {
    console.log('ℹ️ [db-sync] SKIP_DB_SYNC is true, skipping automated db push.');
    return;
  }

  console.log('🔄 [db-sync] DATABASE_URL detected. Synchronizing PostgreSQL schema via Prisma db push...');

  try {
    execSync('npm run prisma:db:push --prefix backend', {
      stdio: 'inherit',
      env: process.env,
    });
    console.log('✅ [db-sync] Database schema synchronized successfully.');
  } catch (error) {
    console.error('⚠️ [db-sync] Database synchronization error:', error.message);
    if (process.env.VERCEL) {
      console.error('❌ [db-sync] Deployment database sync failed on Vercel.');
      throw error;
    }
  }
}

syncDatabase();
