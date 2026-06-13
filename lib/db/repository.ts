import { getDb } from "@/lib/db";
import type {
  AuditEntry,
  DocumentKind,
  DocumentRecord,
  DocumentSource,
  DocumentStatus,
  ExtractionData,
  VendorRule,
} from "@/lib/types";

// ── Row shapes (snake_case as stored) ────────────────────────────────────────

interface DocumentRow {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  kind: string;
  source: string;
  size_bytes: number;
  status: string;
  extraction: unknown;
  notes: string | null;
  created_at: unknown;
  updated_at: unknown;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

function parseExtraction(value: unknown): ExtractionData | null {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as ExtractionData;
    } catch {
      return null;
    }
  }
  return value as ExtractionData;
}

function rowToDocument(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    filename: row.filename,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    kind: row.kind as DocumentKind,
    source: row.source as DocumentSource,
    sizeBytes: Number(row.size_bytes) || 0,
    status: row.status as DocumentStatus,
    extraction: parseExtraction(row.extraction),
    notes: row.notes,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

// ── Documents ─────────────────────────────────────────────────────────────────

export interface NewDocument {
  filename: string;
  originalFilename: string;
  mimeType: string;
  kind: DocumentKind;
  source: DocumentSource;
  sizeBytes: number;
}

export async function createDocument(
  input: NewDocument,
): Promise<DocumentRecord> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const { rows } = await db.query<DocumentRow>(
    `INSERT INTO documents
       (id, filename, original_filename, mime_type, kind, source, size_bytes, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'uploaded')
     RETURNING *`,
    [
      id,
      input.filename,
      input.originalFilename,
      input.mimeType,
      input.kind,
      input.source,
      input.sizeBytes,
    ],
  );
  return rowToDocument(rows[0]);
}

export async function listDocuments(filter?: {
  status?: DocumentStatus;
}): Promise<DocumentRecord[]> {
  const db = await getDb();
  if (filter?.status) {
    const { rows } = await db.query<DocumentRow>(
      `SELECT * FROM documents WHERE status = $1 ORDER BY created_at DESC`,
      [filter.status],
    );
    return rows.map(rowToDocument);
  }
  const { rows } = await db.query<DocumentRow>(
    `SELECT * FROM documents ORDER BY created_at DESC`,
  );
  return rows.map(rowToDocument);
}

export async function getDocument(id: string): Promise<DocumentRecord | null> {
  const db = await getDb();
  const { rows } = await db.query<DocumentRow>(
    `SELECT * FROM documents WHERE id = $1`,
    [id],
  );
  return rows[0] ? rowToDocument(rows[0]) : null;
}

export interface DocumentPatch {
  status?: DocumentStatus;
  extraction?: ExtractionData | null;
  notes?: string | null;
  kind?: DocumentKind;
}

export async function updateDocument(
  id: string,
  patch: DocumentPatch,
): Promise<DocumentRecord | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (patch.status !== undefined) {
    sets.push(`status = $${i++}`);
    params.push(patch.status);
  }
  if (patch.extraction !== undefined) {
    sets.push(`extraction = $${i++}::jsonb`);
    params.push(patch.extraction === null ? null : JSON.stringify(patch.extraction));
  }
  if (patch.notes !== undefined) {
    sets.push(`notes = $${i++}`);
    params.push(patch.notes);
  }
  if (patch.kind !== undefined) {
    sets.push(`kind = $${i++}`);
    params.push(patch.kind);
  }

  if (sets.length === 0) return getDocument(id);

  sets.push(`updated_at = now()`);
  params.push(id);

  const db = await getDb();
  const { rows } = await db.query<DocumentRow>(
    `UPDATE documents SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    params,
  );
  return rows[0] ? rowToDocument(rows[0]) : null;
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  await db.query(`DELETE FROM documents WHERE id = $1`, [id]);
  await db.query(`DELETE FROM audit_log WHERE document_id = $1`, [id]);
}

export async function countByStatus(): Promise<Record<string, number>> {
  const db = await getDb();
  const { rows } = await db.query<{ status: string; n: string }>(
    `SELECT status, COUNT(*)::int AS n FROM documents GROUP BY status`,
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = Number(r.n);
  return out;
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export async function addAudit(
  documentId: string,
  action: string,
  detail?: string,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO audit_log (id, document_id, action, detail) VALUES ($1, $2, $3, $4)`,
    [crypto.randomUUID(), documentId, action, detail ?? null],
  );
}

export async function listAudit(documentId: string): Promise<AuditEntry[]> {
  const db = await getDb();
  const { rows } = await db.query<{
    id: string;
    document_id: string;
    action: string;
    detail: string | null;
    created_at: unknown;
  }>(
    `SELECT * FROM audit_log WHERE document_id = $1 ORDER BY created_at DESC`,
    [documentId],
  );
  return rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    action: r.action,
    detail: r.detail,
    createdAt: toIso(r.created_at),
  }));
}

// ── Vendor rules (learned defaults) ───────────────────────────────────────────

export async function getVendorRule(
  vendor: string,
): Promise<VendorRule | null> {
  const db = await getDb();
  const { rows } = await db.query<{
    vendor: string;
    account_code: string | null;
    tax_rate: number | null;
    updated_at: unknown;
  }>(`SELECT * FROM vendor_rules WHERE vendor = $1`, [vendor]);
  if (!rows[0]) return null;
  return {
    vendor: rows[0].vendor,
    accountCode: rows[0].account_code,
    taxRate: rows[0].tax_rate == null ? null : Number(rows[0].tax_rate),
    updatedAt: toIso(rows[0].updated_at),
  };
}

export async function upsertVendorRule(
  vendor: string,
  accountCode: string | null,
  taxRate: number | null,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO vendor_rules (vendor, account_code, tax_rate, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (vendor) DO UPDATE
       SET account_code = EXCLUDED.account_code,
           tax_rate     = EXCLUDED.tax_rate,
           updated_at   = now()`,
    [vendor, accountCode, taxRate],
  );
}
