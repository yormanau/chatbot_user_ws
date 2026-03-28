const pool = require('./database');
const fs = require('fs');
const path = require('path');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SHOW COLUMNS FROM ${table} LIKE ?`,
    [column]
  );
  return rows.length > 0;
}

async function tableExists(table) {
  const [rows] = await pool.query(
    `SHOW TABLES LIKE ?`,
    [table]
  );
  return rows.length > 0;
}

async function runMigrations() {
  const sql = fs.readFileSync(
    path.resolve(__dirname, '../../sql/schema.sql'),
    'utf8'
  );

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    try {

      if (/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)/i.test(statement)) {
        const [, table, column] = statement.match(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)/i);

        const tableOk = await tableExists(table);
        if (!tableOk) {
          console.log(`[SKIP] Tabla ${table} no existe`);
          continue;
        }

        const exists = await columnExists(table, column);
        if (exists) {
          console.log(`[SKIP] ${table}.${column} ya existe`);
          continue;
        }
      }

      // 🔍 Detectar MODIFY COLUMN
      if (/ALTER\s+TABLE\s+(\w+)\s+MODIFY/i.test(statement)) {
        const [, table] = statement.match(/ALTER\s+TABLE\s+(\w+)/i);

        const exists = await tableExists(table);
        if (!exists) {
          console.log(`[SKIP] Tabla ${table} no existe`);
          continue;
        }
      }

      await pool.query(statement);
      console.log('[OK]', statement.substring(0, 80));

    } catch (err) {
      console.error('[ERROR CONTROLADO]', err.message);
    }
  }

  console.log('[DB] Migraciones aplicadas');
}

module.exports = { runMigrations };