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
    // 1. Diagnostics, Log tables & Feature tables
    const tableStatements = [
      "CREATE TABLE IF NOT EXISTS SystemLog (id TEXT PRIMARY KEY, level TEXT DEFAULT 'info', source TEXT DEFAULT 'worker', message TEXT NOT NULL, details TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)",
      "CREATE INDEX IF NOT EXISTS idx_system_log_level_created ON SystemLog(level, createdAt)",
      "CREATE INDEX IF NOT EXISTS idx_system_log_source_created ON SystemLog(source, createdAt)",
      "CREATE TABLE IF NOT EXISTS WorkerHeartbeat (id TEXT PRIMARY KEY, status TEXT DEFAULT 'ACTIVE', lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP, metadata TEXT)",

      // Quick Replies table
      "CREATE TABLE IF NOT EXISTS QuickReply (id TEXT PRIMARY KEY, shortcut TEXT NOT NULL UNIQUE, title TEXT NOT NULL, content TEXT NOT NULL, category TEXT DEFAULT 'General', mediaUrl TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP)",
      "CREATE INDEX IF NOT EXISTS idx_quick_reply_category ON QuickReply(category)",

      // CRM Tasks table
      "CREATE TABLE IF NOT EXISTS CrmTask (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, dueDate DATETIME, priority TEXT DEFAULT 'MEDIUM', status TEXT DEFAULT 'PENDING', assignedTo TEXT DEFAULT 'Unassigned', contactPhone TEXT, dealId TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP)",
      "CREATE INDEX IF NOT EXISTS idx_crm_task_status ON CrmTask(status)",
      "CREATE INDEX IF NOT EXISTS idx_crm_task_duedate ON CrmTask(dueDate)",
      "CREATE INDEX IF NOT EXISTS idx_crm_task_phone ON CrmTask(contactPhone)",

      // Lead Deals table (Sales Pipeline)
      "CREATE TABLE IF NOT EXISTS LeadDeal (id TEXT PRIMARY KEY, title TEXT NOT NULL, value REAL DEFAULT 0, currency TEXT DEFAULT 'INR', stage TEXT DEFAULT 'NEW_LEAD', contactName TEXT, contactPhone TEXT, tags TEXT DEFAULT '[]', notes TEXT, assignedTo TEXT DEFAULT 'Unassigned', priority TEXT DEFAULT 'MEDIUM', expectedClose DATETIME, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP)",
      "CREATE INDEX IF NOT EXISTS idx_lead_deal_stage ON LeadDeal(stage)",
      "CREATE INDEX IF NOT EXISTS idx_lead_deal_phone ON LeadDeal(contactPhone)",

      // Media Asset table (DAM)
      "CREATE TABLE IF NOT EXISTS MediaAsset (id TEXT PRIMARY KEY, sha256 TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, size INTEGER NOT NULL, path TEXT NOT NULL, url TEXT, data TEXT, title TEXT, fileName TEXT, category TEXT DEFAULT 'image', tags TEXT DEFAULT '[]', createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP)",
    ];

    for (const sql of tableStatements) {
      try {
        await db.$executeRawUnsafe(sql);
      } catch {}
    }

    // 2. Safely add missing columns if not present (prevents 'duplicate column name' Prisma errors)
    await addColumnSafely('MediaAsset', 'title', 'TEXT');
    await addColumnSafely('MediaAsset', 'fileName', 'TEXT');
    await addColumnSafely('MediaAsset', 'category', "TEXT DEFAULT 'image'");
    await addColumnSafely('MediaAsset', 'tags', "TEXT DEFAULT '[]'");
    await addColumnSafely('MediaAsset', 'updatedAt', "DATETIME DEFAULT CURRENT_TIMESTAMP");

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

    // 3. Seed default Quick Replies if table is empty
    try {
      const qrCount = await db.quickReply.count();
      if (qrCount === 0) {
        const DEFAULT_QUICK_REPLIES = [
          {
            shortcut: '/pricing',
            title: 'Pricing & Plans Breakdown',
            content: 'Hello! Here is our current pricing breakdown:\n\n• Starter: ₹1,499/mo (1 Instance, 10k messages)\n• Growth: ₹3,999/mo (3 Instances, 50k messages, Spintax)\n• Enterprise: Custom (Multi-instance warmup & dedicated proxies)\n\nWould you like a custom proposal?',
            category: 'Sales',
          },
          {
            shortcut: '/demo',
            title: 'Live Product Demo Walkthrough',
            content: 'Hi there! We would love to walk you through our bulk messaging engine, chatbot studio, and anti-ban guardrails.\n\nYou can pick a convenient 15-minute slot that works for you!',
            category: 'Sales',
          },
          {
            shortcut: '/support',
            title: 'Customer Support Working Hours',
            content: 'Our support team is available Monday to Saturday, 9:00 AM - 7:00 PM IST.\n\nFor urgent critical support, reply with "URGENT" and our on-call tech lead will connect with you immediately.',
            category: 'Support',
          },
          {
            shortcut: '/catalog',
            title: 'Product Catalog & Brochure',
            content: 'Here is our complete 2026 digital product catalog and service brochure. Feel free to browse and reply with the items you are interested in!',
            category: 'General',
          },
          {
            shortcut: '/discount',
            title: 'Special 15% Limited Discount',
            content: 'Great news! Use voucher code *SAVE15* on your next invoice to get an instant 15% discount. Valid until Sunday midnight!',
            category: 'Promotions',
          },
          {
            shortcut: '/bank',
            title: 'Bank Transfer & NEFT Details',
            content: 'Here are our official company bank details for NEFT/RTGS/IMPS transfer:\n\n• Bank: HDFC Bank\n• Account Name: Nexa Business Solutions\n• Account No: 50200012345678\n• IFSC Code: HDFC0001234\n\nPlease share transaction screenshot once done.',
            category: 'Finance',
          },
        ];

        for (const qr of DEFAULT_QUICK_REPLIES) {
          await db.quickReply.create({ data: qr });
        }
      }
    } catch {}
  })();

  return schemaSyncPromise;
}
