const pool = require('./database');
const fs   = require('fs');
const path = require('path');

async function runMigrations() {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../sql/schema.sql'), 'utf8');
  const statements = sql.split(';').filter(s => s.trim());
  for (const statement of statements) {
    await pool.query(statement);
  }
  console.log('[DB] Migraciones aplicadas');
}

module.exports = { runMigrations };