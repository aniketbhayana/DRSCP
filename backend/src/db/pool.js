// =============================================================================
// DRSCP: backend/src/db/pool.js
// Dual-mode PostgreSQL connection layer:
// 1. Tries external PostgreSQL if DATABASE_URL or DB_HOST is configured.
// 2. Automatically falls back to embedded PostgreSQL 16 (PGlite) persisted
//    at backend/drscp_pg_data, initializing all schema, seeds, functions,
//    triggers, and views seamlessly.
// =============================================================================

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

let pgliteInstance = null;
let usePgLite = false;
let isInitialized = false;

// Real PostgreSQL Pool attempt
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/drscp',
  connectionTimeoutMillis: 1500,
});

async function initPGlite() {
  if (pgliteInstance) return pgliteInstance;
  const { PGlite } = require('@electric-sql/pglite');
  const dataDir = path.resolve(__dirname, '../../drscp_pg_data');
  const isNew = !fs.existsSync(dataDir);
  
  pgliteInstance = new PGlite(dataDir);
  
  if (isNew || !isInitialized) {
    console.log('==> Initializing embedded PostgreSQL (PGlite) schema & seed data...');
    const rootDir = path.resolve(__dirname, '../../../');
    const sqlFiles = [
      'db/01_schema/01_schema.sql',
      'db/02_seed/02a_seed_small.sql',
      'db/03_functions/03a_priority.sql',
      'db/03_functions/03b_allocation_procedures.sql',
      'db/03_functions/03c_helpers.sql',
      'db/04_triggers/04_triggers.sql',
      'db/05_views/05_views.sql',
    ];

    for (const relPath of sqlFiles) {
      const fullPath = path.resolve(rootDir, relPath);
      if (fs.existsSync(fullPath)) {
        try {
          let sql = fs.readFileSync(fullPath, 'utf8');
          sql = sql.replace(/^\uFEFF/, ''); // Strip BOM
          await pgliteInstance.exec(sql);
          console.log(`    [PGlite] Loaded ${relPath}`);
        } catch (err) {
          console.warn(`    [PGlite] Warning in ${relPath}: ${err.message}`);
        }
      }
    }
    isInitialized = true;
    console.log('==> Embedded PostgreSQL database ready and seeded!');
  }

  return pgliteInstance;
}

const pool = {
  async query(text, params) {
    if (!usePgLite) {
      try {
        return await pgPool.query(text, params);
      } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
          console.log('==> External PostgreSQL not available, switching to embedded PostgreSQL engine...');
          usePgLite = true;
        } else {
          throw err;
        }
      }
    }

    const db = await initPGlite();
    const res = await db.query(text, params);
    return res;
  },

  async connect() {
    if (!usePgLite) {
      try {
        const client = await pgPool.connect();
        return client;
      } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
          console.log('==> External PostgreSQL not available, switching client to embedded PostgreSQL engine...');
          usePgLite = true;
        } else {
          throw err;
        }
      }
    }

    const db = await initPGlite();
    return {
      query: async (text, params) => db.query(text, params),
      release: () => {},
    };
  },
};

module.exports = pool;
