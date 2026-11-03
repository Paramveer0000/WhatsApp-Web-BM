import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'whatsapp_bulk.db');
export const db = new DatabaseSync(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    instance_name TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    total_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    min_delay INTEGER DEFAULT 12,
    max_delay INTEGER DEFAULT 25,
    simulate_typing INTEGER DEFAULT 1,
    message_template TEXT NOT NULL,
    created_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    halt_reason TEXT
  );

  CREATE TABLE IF NOT EXISTS recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    name TEXT,
    custom_variables TEXT,
    status TEXT DEFAULT 'pending',
    sent_at TEXT,
    error TEXT,
    rendered_message TEXT,
    response_data TEXT,
    evaluation_status TEXT DEFAULT 'pending_eval',
    quality_notes TEXT,
    quality_score INTEGER DEFAULT 100
  );

  CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON recipients(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_recipients_status ON recipients(status);
`);

// Safe migrations to add evaluation columns if existing DB was created before
try {
  db.exec(`
    ALTER TABLE campaigns ADD COLUMN quality_score INTEGER DEFAULT 100;
  `);
} catch {}
try {
  db.exec(`
    ALTER TABLE campaigns ADD COLUMN skipped_count INTEGER DEFAULT 0;
  `);
} catch {}
try {
  db.exec(`
    ALTER TABLE recipients ADD COLUMN evaluation_status TEXT DEFAULT 'pending_eval';
  `);
} catch {}
try {
  db.exec(`
    ALTER TABLE recipients ADD COLUMN quality_notes TEXT;
  `);
} catch {}
try {
  db.exec(`
    ALTER TABLE recipients ADD COLUMN quality_score INTEGER DEFAULT 100;
  `);
} catch {}

// Seed default settings if not exists
const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSettingStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

const defaultSettings = {
  evolution_api_url: 'http://localhost:8080',
  global_api_key: '',
  default_country_code: '91',
  default_min_delay: '12',
  default_max_delay: '25',
  default_simulate_typing: '1',
  // Evaluation & Quality Layer Settings
  enable_number_validation: '1',
  validation_action: 'skip', // 'skip' or 'warn'
  enable_spam_filter: '1',
  spam_blacklist: 'lottery, urgent wire, claim prize, 100% free cash, bank password, crypto deposit, transfer money now',
  missing_variable_fallback: 'Valued Customer',
  max_consecutive_failures: '3',
  max_failure_rate_percent: '20'
};

for (const [key, value] of Object.entries(defaultSettings)) {
  const existing = getSettingStmt.get(key);
  if (!existing) {
    setSettingStmt.run(key, value);
  }
}

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

export function updateSettings(newSettings) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(newSettings)) {
    stmt.run(key, String(value ?? ''));
  }
  return getSettings();
}

