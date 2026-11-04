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

/**
 * Self-healing runtime migration runner for SQLite.
 * Automatically adds any missing columns if an existing persistent SQLite volume was not yet migrated.
 */
export async function ensureDbSchema(): Promise<void> {
  if (schemaSyncPromise) return schemaSyncPromise;

  schemaSyncPromise = (async () => {
    const statements = [
      // Campaign rotation & distribution columns
      "ALTER TABLE Campaign ADD COLUMN distributionMode TEXT DEFAULT 'SINGLE'",
      "ALTER TABLE Campaign ADD COLUMN rotationMode TEXT DEFAULT 'ROUND_ROBIN'",
      "ALTER TABLE Campaign ADD COLUMN rotationScope TEXT DEFAULT 'CAMPAIGN'",
      "ALTER TABLE Campaign ADD COLUMN shuffleAudience INTEGER DEFAULT 0",
      "ALTER TABLE Campaign ADD COLUMN shuffleSeed INTEGER",
      "ALTER TABLE Campaign ADD COLUMN avoidRepeatContent INTEGER DEFAULT 1",
      // CampaignRecipient multi-message rotation & timing columns
      "ALTER TABLE CampaignRecipient ADD COLUMN sendingAt DATETIME",
      "ALTER TABLE CampaignRecipient ADD COLUMN rotationIndex INTEGER",
      "ALTER TABLE CampaignRecipient ADD COLUMN variantId TEXT",
      "ALTER TABLE CampaignRecipient ADD COLUMN variantIndex INTEGER DEFAULT 0",
      "ALTER TABLE CampaignRecipient ADD COLUMN evolutionMessageId TEXT",
      "ALTER TABLE CampaignRecipient ADD COLUMN evaluationStatus TEXT DEFAULT 'UNVERIFIED'",
      "ALTER TABLE CampaignRecipient ADD COLUMN qualityScore INTEGER DEFAULT 100",
    ];

    for (const sql of statements) {
      try {
        await db.$executeRawUnsafe(sql);
      } catch {
        // Ignored: Column already exists or table not ready
      }
    }
  })();

  return schemaSyncPromise;
}
