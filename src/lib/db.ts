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

      // Reseller SaaS Clients table
      "CREATE TABLE IF NOT EXISTS ResellerClient (id TEXT PRIMARY KEY, companyName TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, ownerName TEXT NOT NULL, ownerEmail TEXT NOT NULL UNIQUE, ownerPhone TEXT, passwordHash TEXT NOT NULL, planName TEXT DEFAULT 'Starter', status TEXT DEFAULT 'ACTIVE', billingCycle TEXT DEFAULT 'MONTHLY', price REAL DEFAULT 0, currency TEXT DEFAULT 'INR', renewalDate DATETIME, maxInstances INTEGER DEFAULT 1, maxContacts INTEGER DEFAULT 5000, monthlyMsgCap INTEGER DEFAULT 10000, walletBalance REAL DEFAULT 0, hasCrmPipeline INTEGER DEFAULT 1, hasChatbot INTEGER DEFAULT 1, hasMultiWarmup INTEGER DEFAULT 1, hasDamMedia INTEGER DEFAULT 1, hasAiResponder INTEGER DEFAULT 0, customDomain TEXT, brandColor TEXT DEFAULT '#0c57e4', logoUrl TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP)",
      "CREATE INDEX IF NOT EXISTS idx_reseller_client_status ON ResellerClient(status)",
      "CREATE INDEX IF NOT EXISTS idx_reseller_client_email ON ResellerClient(ownerEmail)",
      "CREATE INDEX IF NOT EXISTS idx_reseller_client_slug ON ResellerClient(slug)",
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

    // 4. Seed default Reseller SaaS Clients if table is empty
    try {
      const clientCount = await db.resellerClient.count();
      if (clientCount === 0) {
        const DEFAULT_RESELLER_CLIENTS = [
          {
            companyName: 'Acme Retail Brands Ltd',
            slug: 'acme-retail',
            ownerName: 'Vikram Malhotra',
            ownerEmail: 'vikram@acmeretail.in',
            ownerPhone: '919812345678',
            passwordHash: '$2a$10$wT0/y6wM7WkCjA8mPZ8x2eL6/j7F6Q2f9T1e6v2F7n2z9q7d2v2K6', // hashed 'Client@123'
            planName: 'Growth',
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            price: 3999,
            currency: 'INR',
            renewalDate: new Date(Date.now() + 3600000 * 24 * 22),
            maxInstances: 3,
            maxContacts: 25000,
            monthlyMsgCap: 50000,
            walletBalance: 4250,
            hasCrmPipeline: true,
            hasChatbot: true,
            hasMultiWarmup: true,
            hasDamMedia: true,
            hasAiResponder: true,
            brandColor: '#0c57e4',
          },
          {
            companyName: 'Skyline Real Estate Group',
            slug: 'skyline-realty',
            ownerName: 'Amanpreet Virdi',
            ownerEmail: 'aman@skylinerealty.com',
            ownerPhone: '919872551020',
            passwordHash: '$2a$10$wT0/y6wM7WkCjA8mPZ8x2eL6/j7F6Q2f9T1e6v2F7n2z9q7d2v2K6',
            planName: 'Enterprise',
            status: 'ACTIVE',
            billingCycle: 'ANNUAL',
            price: 35000,
            currency: 'INR',
            renewalDate: new Date(Date.now() + 3600000 * 24 * 180),
            maxInstances: 10,
            maxContacts: 100000,
            monthlyMsgCap: 250000,
            walletBalance: 12800,
            hasCrmPipeline: true,
            hasChatbot: true,
            hasMultiWarmup: true,
            hasDamMedia: true,
            hasAiResponder: true,
            brandColor: '#0c57e4',
          },
          {
            companyName: 'Apex Coaching Institute',
            slug: 'apex-coaching',
            ownerName: 'Dr. R. K. Sharma',
            ownerEmail: 'contact@apexcoaching.edu',
            ownerPhone: '919412389012',
            passwordHash: '$2a$10$wT0/y6wM7WkCjA8mPZ8x2eL6/j7F6Q2f9T1e6v2F7n2z9q7d2v2K6',
            planName: 'Starter',
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            price: 1499,
            currency: 'INR',
            renewalDate: new Date(Date.now() + 3600000 * 24 * 14),
            maxInstances: 1,
            maxContacts: 5000,
            monthlyMsgCap: 15000,
            walletBalance: 1500,
            hasCrmPipeline: true,
            hasChatbot: false,
            hasMultiWarmup: false,
            hasDamMedia: true,
            hasAiResponder: false,
            brandColor: '#0c57e4',
          },
          {
            companyName: 'Nexa Media Agency',
            slug: 'nexa-media',
            ownerName: 'Paramveer Singh',
            ownerEmail: 'param@nexamedia.agency',
            ownerPhone: '919907127762',
            passwordHash: '$2a$10$wT0/y6wM7WkCjA8mPZ8x2eL6/j7F6Q2f9T1e6v2F7n2z9q7d2v2K6',
            planName: 'Custom VIP',
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            price: 7500,
            currency: 'INR',
            renewalDate: new Date(Date.now() + 3600000 * 24 * 28),
            maxInstances: 6,
            maxContacts: 50000,
            monthlyMsgCap: 100000,
            walletBalance: 8400,
            hasCrmPipeline: true,
            hasChatbot: true,
            hasMultiWarmup: true,
            hasDamMedia: true,
            hasAiResponder: true,
            brandColor: '#0c57e4',
          },
          {
            companyName: 'Metro Healthcare & Diagnostics',
            slug: 'metro-health',
            ownerName: 'Dr. Simran Kaur',
            ownerEmail: 'care@metrohealth.org',
            ownerPhone: '919876501234',
            passwordHash: '$2a$10$wT0/y6wM7WkCjA8mPZ8x2eL6/j7F6Q2f9T1e6v2F7n2z9q7d2v2K6',
            planName: 'Growth',
            status: 'TRIAL',
            billingCycle: 'MONTHLY',
            price: 3999,
            currency: 'INR',
            renewalDate: new Date(Date.now() + 3600000 * 24 * 3), // Trial ends in 3 days
            maxInstances: 2,
            maxContacts: 10000,
            monthlyMsgCap: 20000,
            walletBalance: 500,
            hasCrmPipeline: true,
            hasChatbot: true,
            hasMultiWarmup: true,
            hasDamMedia: true,
            hasAiResponder: false,
            brandColor: '#0c57e4',
          },
        ];

        for (const client of DEFAULT_RESELLER_CLIENTS) {
          await db.resellerClient.create({ data: client });
        }
      }
    } catch {}
  })();

  return schemaSyncPromise;
}
