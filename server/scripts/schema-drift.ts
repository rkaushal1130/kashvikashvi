/**
 * Compares every mapped Prisma model against the live database and reports drift.
 * Run: npx tsx scripts/schema-drift.ts
 */
import fs from 'fs';
import path from 'path';
import { pool } from '../src/config/db.js';

interface ModelField {
  name: string;
  column: string;
  isRelation: boolean;
}

function parseSchema(schemaPath: string) {
  const src = fs.readFileSync(schemaPath, 'utf8');
  const models: { model: string; table: string; fields: ModelField[] }[] = [];
  const modelRe = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m: RegExpExecArray | null;

  while ((m = modelRe.exec(src))) {
    const [, modelName, body] = m;
    const tableMatch = body.match(/@@map\("([^"]+)"\)/);
    if (!tableMatch) continue;
    const fields: ModelField[] = [];

    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;
      const [name, type] = parts;
      // Relations are modelled as another model's type; skip them.
      const isRelation = !/^(String|Int|Float|Boolean|DateTime|Decimal|Json|BigInt|Bytes)/.test(type);
      const mapMatch = line.match(/@map\("([^"]+)"\)/);
      const column = mapMatch ? mapMatch[1] : name;
      fields.push({ name, column, isRelation });
    }
    models.push({ model: modelName, table: tableMatch[1], fields });
  }
  return models;
}

async function main() {
  const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
  const models = parseSchema(schemaPath);
  let problems = 0;

  for (const { model, table, fields } of models) {
    const res = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    if (res.rows.length === 0) {
      console.log(`\n[${model}] -> table "${table}" DOES NOT EXIST`);
      problems++;
      continue;
    }
    const dbCols = new Set(res.rows.map((r) => r.column_name));
    const prismaCols = new Set<string>();
    const missing: string[] = [];

    for (const f of fields) {
      if (f.isRelation) continue;
      prismaCols.add(f.column);
      if (!dbCols.has(f.column)) missing.push(`${f.name} -> ${f.column}`);
    }
    const extra = [...dbCols].filter((c) => !prismaCols.has(c));

    if (missing.length || extra.length) {
      problems++;
      console.log(`\n[${model}] -> ${table}`);
      if (missing.length) console.log(`  Prisma field(s) with NO column in DB: ${missing.join(', ')}`);
      if (extra.length) console.log(`  DB column(s) not in Prisma model:   ${extra.join(', ')}`);
    }
  }

  console.log(problems === 0 ? '\nNo drift detected.' : `\n${problems} model(s) with drift.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
