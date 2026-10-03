import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';

async function main() {
  const dataDir = path.resolve(process.cwd(), '.pgdata');
  console.log('Initializing embedded PostgreSQL in:', dataDir);

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    persistent: true,
  });

  try {
    await pg.initialise();
    console.log('Initialise completed.');
  } catch (err: any) {
    console.log('Init note (may already be initialized):', err.message);
  }

  await pg.start();
  console.log('PostgreSQL started on port 5432!');

  try {
    await pg.createDatabase('kashvimlm');
    console.log('Database kashvimlm ready.');
  } catch (err: any) {
    console.log('Create database note:', err.message);
  }

  console.log('Ready for Prisma connections!');
}

main().catch((e) => {
  console.error('Failed to start embedded PostgreSQL:', e);
});
