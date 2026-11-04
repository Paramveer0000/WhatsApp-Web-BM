import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

let schemaSyncPromise: Promise<void> | null = null;

async function addColumnSafely(table: string, column: string, definition: string): Promise<void> {
  try {
    const cols = await db.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info(${table})`);
    const exists = Array.isArray(cols) && cols.some((c) => c.name && c.name.toLowerCase() === column.toLowerCase());
    if (!exists) {
      await db.$executeRawUnsafe(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch {
    // Ignored: Table may not exist yet or locked during initial boot
  }
}

/**
 * Self-healing runtime migration runner for SQLite.
 * Automatically adds any missing columns if an existing persistent SQLite volume was not yet migrated.
 */
export async function ensureDbSchema(): Promise<void> {
  if (schemaSyncPromise) return schemaSyncPromise;

  schemaSyncPromise = (async () => {
    // 1. Diagnostics & Log tables
    const tableStatements = [
      "CREATE TABLE IF NOT EXISTS SystemLog (id TEXT PRIMARY KEY, level TEXT DEFAULT 'info', source TEXT DEFAULT 'worker', message TEXT NOT NULL, details TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)",
      "CREATE INDEX IF NOT EXISTS idx_system_log_level_created ON SystemLog(level, createdAt)",
      "CREATE INDEX IF NOT EXISTS idx_system_log_source_created ON SystemLog(source, createdAt)",
      "CREATE TABLE IF NOT EXISTS WorkerHeartbeat (id TEXT PRIMARY KEY, status TEXT DEFAULT 'ACTIVE', lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP, metadata TEXT)",
    ];

    for (const sql of tableStatements) {
      try {
        await db.$executeRawUnsafe(sql);
      } catch {}
    }

    // 2. Safely add missing columns if not present (prevents 'duplicate column name' Prisma errors)
    await addColumnSafely('Campaign', 'distributionMode', "TEXT DEFAULT 'SINGLE'");
    await addColumnSafely('Campaign', 'rotationMode', "TEXT DEFAULT 'ROUND_ROBIN'");
    await addColumnSafely('Campaign', 'rotationScope', "TEXT DEFAULT 'CAMPAIGN'");
    await addColumnSafely('Campaign', 'shuffleAudience', 'INTEGER DEFAULT 0');
    await addColumnSafely('Campaign', 'shuffleSeed', 'INTEGER');
    await addColumnSafely('Campaign', 'avoidRepeatContent', 'INTEGER DEFAULT 1');

    await addColumnSafely('CampaignRecipient', 'sendingAt', 'DATETIME');
    await addColumnSafely('CampaignRecipient', 'rotationIndex', 'INTEGER');
    await addColumnSafely('CampaignRecipient', 'variantId', 'TEXT');
    await addColumnSafely('CampaignRecipient', 'variantIndex', 'INTEGER DEFAULT 0');
    await addColumnSafely('CampaignRecipient', 'evolutionMessageId', 'TEXT');
    await addColumnSafely('CampaignRecipient', 'evaluationStatus', "TEXT DEFAULT 'UNVERIFIED'");
    await addColumnSafely('CampaignRecipient', 'qualityScore', 'INTEGER DEFAULT 100');
  })();

  return schemaSyncPromise;
}
