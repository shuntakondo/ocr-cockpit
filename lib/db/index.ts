import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Dual-driver Postgres access for the BFF.
//   • No DATABASE_URL  → bundled in-process Postgres (PGlite, WASM), persisted
//                        to ./.pglite. Zero setup, runs anywhere.
//   • DATABASE_URL set → a real Postgres server via node-postgres (pg).
// Both speak the same SQL ($1 placeholders) and the same schema below.
// ─────────────────────────────────────────────────────────────────────────────

export interface Db {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
  /** Run one or more statements with no parameters (used for schema init). */
  exec(sql: string): Promise<void>;
  driver: "pglite" | "pg";
}

// Kept in sync with lib/db/schema.sql (that file is for `psql -f`; this string
// is what the app actually applies at startup so it works under any bundler).
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS documents (
  id                TEXT PRIMARY KEY,
  filename          TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'invoice',
  source            TEXT NOT NULL DEFAULT 'upload',
  size_bytes        INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'uploaded',
  extraction        JSONB,
  notes             TEXT,
  page              INTEGER,
  page_end          INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS page INTEGER;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS page_end INTEGER;
CREATE INDEX IF NOT EXISTS idx_documents_status     ON documents (status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents (created_at DESC);
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  action      TEXT NOT NULL,
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_document ON audit_log (document_id, created_at DESC);
CREATE TABLE IF NOT EXISTS vendor_rules (
  vendor       TEXT PRIMARY KEY,
  account_code TEXT,
  tax_rate     DOUBLE PRECISION,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function createPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = path.join(process.cwd(), ".pglite");
  const pg = await PGlite.create(dataDir);
  return {
    driver: "pglite",
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pg.query<T>(sql, params as unknown[]);
      return { rows: res.rows as T[] };
    },
    async exec(sql: string) {
      await pg.exec(sql);
    },
  };
}

async function createPgPool(connectionString: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString });
  return {
    driver: "pg",
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(sql, params as unknown[]);
      return { rows: res.rows as T[] };
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
  };
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  const db = url ? await createPgPool(url) : await createPglite();
  await db.exec(SCHEMA_SQL);
  return db;
}

// Cache the connection across hot reloads (dev) and route invocations.
const globalForDb = globalThis as unknown as { __ocrDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__ocrDb) {
    globalForDb.__ocrDb = createDb();
  }
  return globalForDb.__ocrDb;
}
