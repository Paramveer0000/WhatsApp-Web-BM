export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const DEFAULT_SAMPLE_DEALS = [
  {
    title: 'Enterprise Annual License & Onboarding',
    value: 120000,
    currency: 'INR',
    stage: 'WON',
    contactName: 'Dalveer Singh',
    contactPhone: '918727962100',
    tags: JSON.stringify(['Enterprise', 'Annual', 'VIP']),
    notes: 'Paid annual upfront via NEFT. Onboarding scheduled for Monday.',
    assignedTo: 'Paramveer (Admin)',
    priority: 'HIGH',
  },
  {
    title: 'Bulk WhatsApp Outreach - 50k Contacts',
    value: 45000,
    currency: 'INR',
    stage: 'PROPOSAL',
    contactName: 'Nexa Media Agency',
    contactPhone: '919907127762',
    tags: JSON.stringify(['Agency', 'Broadcast', 'High Volume']),
    notes: 'Proposal sent with 3-instance warmup rotation schedule. Awaiting signoff.',
    assignedTo: 'Support Desk',
    priority: 'HIGH',
  },
  {
    title: 'Diwali Promotional Broadcast Package',
    value: 28500,
    currency: 'INR',
    stage: 'QUALIFIED',
    contactName: 'Falcon Garden Tools',
    contactPhone: '919814505717',
    tags: JSON.stringify(['E-Commerce', 'Festive Offer']),
    notes: 'Requested demo of Spintax variations and humanizer pacing.',
    assignedTo: 'Paramveer (Admin)',
    priority: 'MEDIUM',
  },
  {
    title: 'Chatbot Studio Flow Automation',
    value: 18000,
    currency: 'INR',
    stage: 'CONTACTED',
    contactName: 'Kam Kaura',
    contactPhone: '919434233224',
    tags: JSON.stringify(['Chatbot', 'Inquiry']),
    notes: 'Connected via WhatsApp replies. Looking for automated lead qualification flow.',
    assignedTo: 'Unassigned',
    priority: 'MEDIUM',
  },
  {
    title: 'Inbound WhatsApp Inquiry via Website',
    value: 12500,
    currency: 'INR',
    stage: 'NEW_LEAD',
    contactName: 'Rohit Sharma',
    contactPhone: '919800337300',
    tags: JSON.stringify(['New Lead', 'Website Inbound']),
    notes: 'Texted keyword "PRICING". Need initial follow-up discovery call.',
    assignedTo: 'Unassigned',
    priority: 'LOW',
  },
  {
    title: 'Real Estate Broadcast Outreach',
    value: 35000,
    currency: 'INR',
    stage: 'NEW_LEAD',
    contactName: 'Amanpreet Virdi',
    contactPhone: '919872551020',
    tags: JSON.stringify(['Real Estate', 'Warmup Needed']),
    notes: 'Inquired about anti-ban guardrail safety for property announcements.',
    assignedTo: 'Unassigned',
    priority: 'HIGH',
  },
];

export async function GET(req: NextRequest) {
  try {
    const dealsCount = await db.leadDeal.count();

    // Auto-seed sample deals if table is empty
    if (dealsCount === 0) {
      for (const deal of DEFAULT_SAMPLE_DEALS) {
        await db.leadDeal.create({ data: deal });
      }
    }

    const deals = await db.leadDeal.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    // Compute Pipeline Stats
    const stats = {
      totalDeals: deals.length,
      totalValue: deals.reduce((acc, d) => acc + (d.value || 0), 0),
      wonDeals: deals.filter((d) => d.stage === 'WON').length,
      wonValue: deals.filter((d) => d.stage === 'WON').reduce((acc, d) => acc + (d.value || 0), 0),
      qualifiedDeals: deals.filter((d) => d.stage === 'QUALIFIED').length,
      proposalDeals: deals.filter((d) => d.stage === 'PROPOSAL').length,
      newDeals: deals.filter((d) => d.stage === 'NEW_LEAD').length,
      contactedDeals: deals.filter((d) => d.stage === 'CONTACTED').length,
    };

    return NextResponse.json({ success: true, deals, stats });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to fetch lead deals');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      value = 0,
      currency = 'INR',
      stage = 'NEW_LEAD',
      contactName,
      contactPhone,
      tags = [],
      notes = '',
      assignedTo = 'Unassigned',
      priority = 'MEDIUM',
    } = body;

    if (!title || !contactPhone) {
      return NextResponse.json({ error: 'Title and contact phone are required' }, { status: 400 });
    }

    const cleanPhone = String(contactPhone).replace(/[^\d]/g, '');

    const created = await db.leadDeal.create({
      data: {
        title,
        value: Number(value) || 0,
        currency,
        stage,
        contactName: contactName || null,
        contactPhone: cleanPhone,
        tags: Array.isArray(tags) ? JSON.stringify(tags) : typeof tags === 'string' ? tags : '[]',
        notes,
        assignedTo,
        priority,
      },
    });

    // Optionally ensure contact exists in Contact table
    if (cleanPhone) {
      await db.contact.upsert({
        where: { phone: cleanPhone },
        update: { name: contactName || undefined },
        create: {
          phone: cleanPhone,
          name: contactName || null,
          source: 'CRM_LEAD',
          optInStatus: true,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, deal: created });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to create lead deal');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, stage, value, priority, notes, assignedTo, title } = body;

    if (!id) {
      return NextResponse.json({ error: 'Deal ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (stage !== undefined) updateData.stage = stage;
    if (value !== undefined) updateData.value = Number(value);
    if (priority !== undefined) updateData.priority = priority;
    if (notes !== undefined) updateData.notes = notes;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (title !== undefined) updateData.title = title;

    const updated = await db.leadDeal.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, deal: updated });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to update lead deal');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Deal ID is required' }, { status: 400 });
    }

    await db.leadDeal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to delete lead deal');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
