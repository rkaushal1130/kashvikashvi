import fs from 'fs';
import path from 'path';
import { prisma } from '../src/config/database';

async function restoreDatabase(filePath?: string) {
  const backupDir = path.resolve(__dirname, '../backups');
  let targetFile = filePath;

  if (!targetFile) {
    if (!fs.existsSync(backupDir)) {
      throw new Error(`Backup directory does not exist: ${backupDir}`);
    }
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.json')).sort().reverse();
    if (files.length === 0) {
      throw new Error('No JSON backup files found in backups folder.');
    }
    targetFile = path.join(backupDir, files[0]);
  }

  console.log(`🔄 Restoring database from: ${targetFile}`);
  const content = fs.readFileSync(targetFile, 'utf-8');
  const payload = JSON.parse(content);
  const tables = payload.tables || {};

  console.log(`Backup created at: ${payload.metadata?.createdAt}`);

  // Disable FK constraints temporarily or truncate all existing application tables
  for (const tableName of Object.keys(tables).reverse()) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`);
    } catch {
      // Ignore if table cannot be truncated
    }
  }

  // Insert data
  let totalRestored = 0;
  for (const [tableName, rows] of Object.entries(tables) as [string, any[]][]) {
    if (!rows || rows.length === 0) continue;
    try {
      for (const row of rows) {
        const columns = Object.keys(row).map((c) => `"${c}"`).join(', ');
        const values = Object.values(row);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        await prisma.$executeRawUnsafe(
          `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`,
          ...values
        );
      }
      totalRestored += rows.length;
      console.log(`  - Restored ${tableName}: ${rows.length} rows`);
    } catch (err: any) {
      console.warn(`  ! Could not restore ${tableName}:`, err.message);
    }
  }

  console.log(`\n✅ Database restored successfully! (${totalRestored} rows)\n`);
}

if (require.main === module) {
  const fileArg = process.argv[2];
  restoreDatabase(fileArg)
    .catch((err) => {
      console.error('❌ Restore failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
