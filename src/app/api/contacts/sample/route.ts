export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { sanitizeCsvCell } from '@/lib/security';
import * as XLSX from 'xlsx';

const SAMPLE_CONTACTS = [
  { phone: '919876543210', name: 'Rahul Sharma', company: 'Acme Corp', city: 'Mumbai', tags: 'VIP;Customer' },
  { phone: '919876543211', name: 'Priya Patel', company: 'Innovate Ltd', city: 'Delhi', tags: 'Lead;Hot' },
  { phone: '919876543212', name: 'Amit Verma', company: 'Alpha Labs', city: 'Bangalore', tags: 'Enterprise' },
  { phone: '919876543213', name: 'Neha Singh', company: 'Logistics Pro', city: 'Hyderabad', tags: 'Partner' },
  { phone: '919876543214', name: 'Vikram Mehta', company: 'Apex Tech', city: 'Chennai', tags: 'Active' },
];

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get('format') || 'csv').toLowerCase();

  if (format === 'xlsx' || format === 'excel') {
    const ws = XLSX.utils.json_to_sheet(SAMPLE_CONTACTS);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sample Contacts');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="sample_contacts_template.xlsx"',
      },
    });
  }

  // Default: CSV
  const headers = 'phone,name,company,city,tags\n';
  const rows = SAMPLE_CONTACTS.map((c) => `${c.phone},"${c.name}","${c.company}","${c.city}","${c.tags}"`).join('\n');
  const csvContent = headers + rows;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="sample_contacts_template.csv"',
    },
  });
}

