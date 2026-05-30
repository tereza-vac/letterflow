/**
 * Canonical SQLite schema for letterflow's local database.
 *
 * The production desktop build stores data in a local SQLite file via
 * `@tauri-apps/plugin-sql`. These DDL statements describe the relational model
 * from the product spec. They are intentionally plain SQL (no ORM lock-in) so
 * the same schema can back a Drizzle/Prisma migration later, or be queried
 * directly for exports.
 *
 * NOTE: secrets (AI API keys, SMTP passwords) are NEVER stored here. They live
 * in the OS secure credential store (see lib/ai/secure-store.ts).
 */
export const SQL_SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS uploaded_file (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    extension TEXT NOT NULL,
    detected_type TEXT NOT NULL,
    override_type TEXT,
    size INTEGER NOT NULL DEFAULT 0,
    context_text TEXT,
    created_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS contact_list (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS contact (
    id TEXT PRIMARY KEY,
    list_id TEXT,
    email TEXT NOT NULL,
    normalized_email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    custom_fields TEXT NOT NULL DEFAULT '{}',
    source_file_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (list_id) REFERENCES contact_list(id),
    FOREIGN KEY (source_file_id) REFERENCES uploaded_file(id)
  );`,

  `CREATE INDEX IF NOT EXISTS idx_contact_norm_email ON contact(normalized_email);`,

  `CREATE TABLE IF NOT EXISTS campaign (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brief TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    preview_text TEXT NOT NULL DEFAULT '',
    plain_text_body TEXT NOT NULL DEFAULT '',
    html_body TEXT NOT NULL DEFAULT '',
    from_name TEXT NOT NULL DEFAULT '',
    from_email TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    risk_level TEXT NOT NULL DEFAULT 'low',
    risk_reasons TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS template (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT,
    plain_text_body TEXT,
    html_body TEXT,
    created_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS import_job (
    id TEXT PRIMARY KEY,
    file_id TEXT,
    summary TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (file_id) REFERENCES uploaded_file(id)
  );`,

  `CREATE TABLE IF NOT EXISTS import_issue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    score REAL,
    FOREIGN KEY (job_id) REFERENCES import_job(id)
  );`,

  `CREATE TABLE IF NOT EXISTS test_send_log (
    id TEXT PRIMARY KEY,
    campaign_id TEXT,
    recipient TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
  );`,

  // Non-secret settings metadata (which provider is selected, sender name,
  // SMTP host/port, encryption mode — but never passwords/keys).
  `CREATE TABLE IF NOT EXISTS settings_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  // Key/value snapshot used by the app's persistence layer for the MVP.
  `CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
];

export const DB_NAME = "sqlite:letterflow.db";
export const APP_STATE_KEY = "app_state_v1";
