import fs from 'fs';
import path from 'path';
import { prisma } from '../src/config/database';

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFilePath = path.join(backupDir, `backup_kashvimlm_${timestamp}.json`);
  console.log('🔄 Creating complete database backup...');

  // Get all table names in public schema
  const tables: Array<{ table_name: string }> = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const backupData: Record<string, any[]> = {};
  let totalRows = 0;

  for (const t of tables) {
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "${t.table_name}";`);
      backupData[t.table_name] = rows;
      totalRows += rows.length;
      if (rows.length > 0) {
        console.log(`  - ${t.table_name}: ${rows.length} rows`);
      }
    } catch (err: any) {
      console.warn(`  ! Could not backup ${t.table_name}:`, err.message);
    }
  }

  const metadata = {
    createdAt: new Date().toISOString(),
    totalTables: tables.length,
    totalRows,
    databaseUrl: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@') : 'N/A',
  };

  const payload = {
    metadata,
    tables: backupData,
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`\n✅ Backup successfully saved to: ${backupFilePath}`);
  console.log(`   Total tables: ${tables.length}, Total rows captured: ${totalRows}\n`);

  return backupFilePath;
}

if (require.main === module) {
  backupDatabase()
    .catch((err) => {
      console.error('❌ Backup failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
