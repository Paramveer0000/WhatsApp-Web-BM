import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbSchema } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getTenantWhere } from '@/lib/tenant';
import { sanitizeCsvCell } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await ensureDbSchema();
    const tenantFilter = getTenantWhere(user);

    const { searchParams } = new URL(req.url);
    const formId = searchParams.get('form_id') || searchParams.get('formId');
    const tag = searchParams.get('tag');
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim();

    const where: any = {
      ...tenantFilter,
    };

    if (formId && formId !== 'all') {
      where.formId = formId;
    }
    if (tag && tag !== 'all') {
      where.tag = tag;
    }
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const leads = await db.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        form: {
          select: { title: true },
        },
      },
    });

    // 1. Gather all unique custom field keys across these leads for column headers
    const customKeysSet = new Set<string>();
    const parsedRows = leads.map((l) => {
      let customFields: Record<string, any> = {};
      try {
        customFields = JSON.parse(l.customFields || '{}');
      } catch {
        customFields = {};
      }
      Object.keys(customFields).forEach((k) => customKeysSet.add(k));
      return {
        id: l.id,
        name: l.name,
        phone: l.phone,
        email: l.email || '',
        status: l.status,
        tag: l.tag || '',
        sourceForm: l.form?.title || 'Direct/Manual',
        createdAt: new Date(l.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        customFields,
      };
    });

    const customKeys = Array.from(customKeysSet);

    // 2. Build CSV Header
    const standardHeaders = ['Name', 'Phone', 'Email', 'Status', 'Tag', 'Source Form', 'Date Received'];
    const allHeaders = [...standardHeaders, ...customKeys.map((k) => `Custom: ${k}`)];

    const csvLines: string[] = [];
    csvLines.push(allHeaders.map((h) => `"${sanitizeCsvCell(h)}"`).join(','));

    // 3. Build CSV Rows with formula injection sanitization
    for (const row of parsedRows) {
      const lineValues: string[] = [
        sanitizeCsvCell(row.name),
        sanitizeCsvCell(row.phone),
        sanitizeCsvCell(row.email),
        sanitizeCsvCell(row.status),
        sanitizeCsvCell(row.tag),
        sanitizeCsvCell(row.sourceForm),
        sanitizeCsvCell(row.createdAt),
      ];

      for (const k of customKeys) {
        const val = row.customFields[k];
        const strVal = val === null || val === undefined ? '' : String(val);
        lineValues.push(sanitizeCsvCell(strVal));
      }

      const escapedLine = lineValues.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
      csvLines.push(escapedLine);
    }

    const csvContent = csvLines.join('\r\n');
    const filename = `crm-leads-export-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to export leads' },
      { status: 500 }
    );
  }
}
