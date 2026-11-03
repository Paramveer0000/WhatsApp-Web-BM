export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const campaignId = params.id;
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all'; // 'all', 'failed_only', 'non_responders'
    const format = searchParams.get('format') || 'csv'; // 'csv' or 'xlsx'

    const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const where: any = { campaignId };
    if (filter === 'failed_only') {
      where.status = 'FAILED';
    } else if (filter === 'non_responders') {
      where.status = { in: ['SENT', 'DELIVERED', 'READ'] };
    }

    const recipients = await db.campaignRecipient.findMany({
      where,
      orderBy: { id: 'asc' },
    });

    const exportRows = recipients.map((r) => ({
      Recipient_Name: r.name || '',
      Phone: r.phone,
      Status: r.status,
      Variant_Index: r.variantIndex + 1,
      Instance_Used: r.instanceUsed || '',
      Sent_At: r.sentAt ? r.sentAt.toISOString() : '',
      Delivered_At: r.deliveredAt ? r.deliveredAt.toISOString() : '',
      Read_At: r.readAt ? r.readAt.toISOString() : '',
      Replied: r.status === 'REPLIED' ? 'YES' : 'NO',
      Error_Details: r.lastError || '',
      Rendered_Message: r.renderedMessage || '',
    }));

    const cleanCampName = campaign.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `report_${cleanCampName}_${filter}_${Date.now()}`;

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Delivery Report');
      const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        },
      });
    }

    // Default CSV
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

