-- OCR Cockpit schema. Runs identically on the bundled in-process Postgres
-- (PGlite) and on a real Postgres server. IDs are generated in the app layer
-- (crypto.randomUUID) so no extensions are required.

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
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- Vendor-level learned defaults, re-applied to future documents from the
-- same vendor (e.g. account code, tax rate). Demonstrates the "re-apply
-- previously confirmed rules" requirement from the brief.
CREATE TABLE IF NOT EXISTS vendor_rules (
  vendor       TEXT PRIMARY KEY,
  account_code TEXT,
  tax_rate     DOUBLE PRECISION,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
