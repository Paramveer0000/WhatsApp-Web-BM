export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { EvolutionClient } from '@/lib/evolution';
import { normalizePhone } from '@/lib/phone';
import { logger } from '@/lib/logger';
import { withApi } from '@/lib/api-wrapper';

export const POST = withApi(async function (req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { instanceName, phones: rawPhones = [], contactIds = [] } = body;

  let targetPhones: string[] = [];

  if (Array.isArray(rawPhones) && rawPhones.length > 0) {
    targetPhones = rawPhones.map((p: string) => normalizePhone(p).formatted).filter(Boolean);
  } else if (Array.isArray(contactIds) && contactIds.length > 0) {
    const contacts = await db.contact.findMany({
      where: { id: { in: contactIds } },
      select: { phone: true },
    });
    targetPhones = contacts.map((c) => c.phone);
  } else {
    // Check unverified contacts
    const unverified = await db.contact.findMany({
      where: { waExists: null },
      take: 200,
      select: { phone: true },
    });
    targetPhones = unverified.map((c) => c.phone);
  }

  // Deduplicate
  targetPhones = Array.from(new Set(targetPhones));

  if (targetPhones.length === 0) {
    return NextResponse.json({ success: true, message: 'No contacts to verify', totalChecked: 0, validCount: 0, invalidCount: 0 });
  }

  // Find active instance
  let activeInstanceName = instanceName;
  if (!activeInstanceName) {
    const inst = await db.instance.findFirst({ where: { status: 'OPEN' } });
    if (!inst) {
      return NextResponse.json({ success: false, error: 'No connected instance found for WhatsApp verification' }, { status: 400 });
    }
    activeInstanceName = inst.name;
  }

  const client = await EvolutionClient.fromDatabase();
  const chunkSize = 50;
  let validCount = 0;
  let invalidCount = 0;
  const verificationResults: Array<{ phone: string; exists: boolean; jid?: string }> = [];

  for (let i = 0; i < targetPhones.length; i += chunkSize) {
    const chunk = targetPhones.slice(i, i + chunkSize);
    try {
      const results = await client.checkWhatsAppNumbers(activeInstanceName, chunk);
      for (const res of results) {
        const cleanNumber = normalizePhone(res.number).formatted || res.number;
        const exists = Boolean(res.exists);
        if (exists) validCount++;
        else invalidCount++;

        verificationResults.push({
          phone: cleanNumber,
          exists,
          jid: res.jid,
        });

        // Update contact record in database with 30-day TTL check timestamp
        await db.contact.updateMany({
          where: { phone: cleanNumber },
          data: {
            waExists: exists,
            waCheckedAt: new Date(),
          },
        });
      }
    } catch (err: any) {
      logger.warn({ err: err.message, chunkIndex: i }, 'Error during WhatsApp number batch verification');
    }
  }

  return NextResponse.json({
    success: true,
    totalChecked: targetPhones.length,
    validCount,
    invalidCount,
    results: verificationResults,
  });
});

