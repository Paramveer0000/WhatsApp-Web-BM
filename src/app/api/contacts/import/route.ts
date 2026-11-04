export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { normalizePhone } from '@/lib/phone';
import { EvolutionClient } from '@/lib/evolution';
import { logger } from '@/lib/logger';
import * as XLSX from 'xlsx';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const contentType = req.headers.get('content-type') || '';
    let rows: any[] = [];
    let phoneColumn: string | undefined;
    let nameColumn: string | undefined;
    let listName: string | undefined;
    let defaultCountryCode = '91';
    let verifyWhatsApp = false;
    let instanceName: string | undefined;

    // Handle Multipart Form Data (file upload: CSV, XLSX, XLS)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      listName = (formData.get('listName') as string) || `Import-${new Date().toLocaleDateString()}`;
      defaultCountryCode = (formData.get('defaultCountryCode') as string) || '91';
      verifyWhatsApp = formData.get('verifyWhatsApp') === 'true';
      instanceName = (formData.get('instanceName') as string) || undefined;
      phoneColumn = (formData.get('phoneColumn') as string) || undefined;
      nameColumn = (formData.get('nameColumn') as string) || undefined;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return NextResponse.json({ error: 'The uploaded file has no sheets or content' }, { status: 400 });
      }
      const worksheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (rows.length === 0) {
        return NextResponse.json({ error: 'The uploaded file contains no data rows' }, { status: 400 });
      }

      // Auto-detect columns from the first row if not provided
      const sampleRow = rows[0];
      const keys = Object.keys(sampleRow);

      if (!phoneColumn) {
        phoneColumn = keys.find((k) =>
          /^(phone|mobile|whatsapp|number|contact|phone_number|phonenumber|tel|contact_number)$/i.test(k.trim())
        ) || keys.find((k) =>
          /(phone|mobile|whatsapp|number|contact|tel)/i.test(k.trim())
        );

        if (!phoneColumn && keys.length > 0) {
          phoneColumn = keys[0];
        }
      }

      if (!nameColumn) {
        nameColumn = keys.find((k) =>
          /^(name|full_name|fullname|first_name|firstname|contact_name|customer_name)$/i.test(k.trim())
        ) || keys.find((k) =>
          /(name)/i.test(k.trim()) && k !== phoneColumn
        );

        if (!nameColumn && keys.length > 1 && keys[1] !== phoneColumn) {
          nameColumn = keys[1];
        }
      }
    } else {
      // Handle standard JSON payload
      const body = await req.json();
      rows = body.rows || [];
      phoneColumn = body.phoneColumn;
      nameColumn = body.nameColumn;
      listName = body.listName;
      defaultCountryCode = body.defaultCountryCode || '91';
      verifyWhatsApp = Boolean(body.verifyWhatsApp);
      instanceName = body.instanceName;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided for import' }, { status: 400 });
    }

    if (!phoneColumn) {
      return NextResponse.json({ error: 'Could not determine phone number column in the file' }, { status: 400 });
    }

    // 1. Fetch current global Blacklist
    const blacklistRecords = await db.blacklist.findMany({ select: { phone: true } });
    const blacklistedSet = new Set(blacklistRecords.map((b) => b.phone));

    // 2. Prepare or create target list
    let targetListId: string | null = null;
    if (listName) {
      const list = await db.contactList.upsert({
        where: { name: listName.trim() },
        update: {},
        create: {
          name: listName.trim(),
          description: `Imported on ${new Date().toLocaleDateString()}`,
        },
      });
      targetListId = list.id;
    }

    const seenPhonesInFile = new Set<string>();
    const validContacts: Array<{ phone: string; name?: string; customFields: Record<string, any> }> = [];
    const invalidRows: Array<{ row: number; rawPhone: string; error: string }> = [];
    let duplicatesInFile = 0;
    let blacklistedCount = 0;

    // 3. Process and normalize each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawPhone = row[phoneColumn];
      const name = nameColumn && row[nameColumn] ? String(row[nameColumn]).trim() : '';

      const normalized = normalizePhone(rawPhone, defaultCountryCode);

      if (!normalized.isValid) {
        invalidRows.push({ row: i + 1, rawPhone: String(rawPhone || ''), error: normalized.error || 'Invalid phone' });
        continue;
      }

      if (seenPhonesInFile.has(normalized.formatted)) {
        duplicatesInFile++;
        continue;
      }

      if (blacklistedSet.has(normalized.formatted)) {
        blacklistedCount++;
        continue;
      }

      seenPhonesInFile.add(normalized.formatted);

      // Collect custom fields from remaining columns
      const customFields: Record<string, any> = {};
      for (const [key, val] of Object.entries(row)) {
        if (key !== phoneColumn && key !== nameColumn) {
          customFields[key] = val;
        }
      }

      validContacts.push({
        phone: normalized.formatted,
        name,
        customFields,
      });
    }

    // 4. Optional WhatsApp Number Verification Gate
    let unregisteredCount = 0;
    let verifiedContacts = validContacts;

    if (verifyWhatsApp && instanceName && validContacts.length > 0) {
      try {
        const client = await EvolutionClient.fromDatabase();
        const chunkSize = 50;
        const verifiedList: typeof validContacts = [];

        for (let i = 0; i < validContacts.length; i += chunkSize) {
          const chunk = validContacts.slice(i, i + chunkSize);
          const numbers = chunk.map((c) => c.phone);
          const checkRes = await client.checkWhatsAppNumbers(instanceName, numbers);

          const statusMap = new Map<string, boolean>();
          for (const item of checkRes) {
            statusMap.set(item.number, Boolean(item.exists));
          }

          for (const c of chunk) {
            if (statusMap.get(c.phone) !== false) {
              verifiedList.push(c);
            } else {
              unregisteredCount++;
            }
          }
        }

        verifiedContacts = verifiedList;
      } catch (checkErr: any) {
        logger.warn({ err: checkErr.message }, 'WhatsApp number pre-check failed, proceeding with validated list');
      }
    }

    // 5. Persist to Contact and ListContact tables
    let savedCount = 0;
    for (const c of verifiedContacts) {
      const contact = await db.contact.upsert({
        where: { phone: c.phone },
        update: {
          name: c.name || undefined,
          customFields: JSON.stringify(c.customFields),
        },
        create: {
          phone: c.phone,
          name: c.name || null,
          customFields: JSON.stringify(c.customFields),
          tags: JSON.stringify(['import']),
          optInStatus: true,
        },
      });

      if (targetListId) {
        await db.listContact.upsert({
          where: {
            listId_contactId: {
              listId: targetListId,
              contactId: contact.id,
            },
          },
          update: {},
          create: {
            listId: targetListId,
            contactId: contact.id,
          },
        });
      }
      savedCount++;
    }

    return NextResponse.json({
      success: true,
      imported: savedCount,
      duplicates: duplicatesInFile,
      invalid: invalidRows.length,
      stats: {
        totalRows: rows.length,
        validCount: savedCount,
        duplicatesCount: duplicatesInFile,
        blacklistedCount,
        invalidCount: invalidRows.length,
        unregisteredWhatsAppCount: unregisteredCount,
      },
      invalidRows: invalidRows.slice(0, 100),
      listId: targetListId,
    });
  } catch (err: any) {
    logger.error({ err }, 'Error importing contacts');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
