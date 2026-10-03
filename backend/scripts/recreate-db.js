const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres' });
  await client.connect();
  await client.query('DROP DATABASE IF EXISTS kashvimlm');
  await client.query('CREATE DATABASE kashvimlm');
  await client.end();
  console.log('Clean kashvimlm database recreated successfully!');
}

main().catch(console.error);
