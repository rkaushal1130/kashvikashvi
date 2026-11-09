import { prisma } from '../src/config/database';

async function main() {
  const result: any[] = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  console.log(`Found ${result.length} tables in database:`);
  for (const row of result) {
    const tableName = row.table_name;
    const countRes: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "${tableName}";`);
    const count = countRes[0]?.count ?? 0;
    if (count > 0) {
      console.log(`  - ${tableName}: ${count} rows`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
