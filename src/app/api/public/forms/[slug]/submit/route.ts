import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbSchema } from '@/lib/db';
import { checkFormRateLimit, normalizeLeadPhone, renderWelcomeMessage, isFieldVisible } from '@/lib/forms';
import { EvolutionClient } from '@/lib/evolution';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    await ensureDbSchema();
    const slug = (params.slug || '').trim().toLowerCase();

    // 1. IP Rate Limiting Check (Max 10 submissions per 15 mins per IP)
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    const rateCheck = checkFormRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please wait a few minutes before submitting again.',
        },
        { status: 429 }
      );
    }

    const body = await req.json();

    // 2. Invisible Honeypot Anti-Bot Filter (_hp field)
    if (body._hp && String(body._hp).trim().length > 0) {
      logger.warn({ ip, slug }, 'Spam bot submission caught by honeypot field');
      // Silently succeed to fool bots without saving spam to database
      return NextResponse.json({
        success: true,
        message: 'Submission received successfully',
      });
    }

    // 3. Find active form
    const form = await db.form.findUnique({
      where: { slug },
    });

    if (!form || !form.isActive) {
      return NextResponse.json(
        { success: false, error: 'Form not found or is currently closed' },
        { status: 404 }
      );
    }

    let fieldDefinitions: any[] = [];
    try {
      fieldDefinitions = JSON.parse(form.fields);
    } catch {
      fieldDefinitions = [];
    }

    // 4. Validate Fields against Schema
    const customFields: Record<string, any> = {};
    let leadName = '';
    let rawPhone = '';
    let leadEmail: string | null = null;

    for (const field of fieldDefinitions) {
      if (field.type === 'section_header') continue;

      // Skip validation if field is hidden by conditional logic
      if (!isFieldVisible(field, body)) {
        continue;
      }

      const val = body[field.id];

      // Check required fields
      if (field.required) {
        if (field.type === 'checkbox') {
          if (!val) {
            return NextResponse.json(
              { success: false, error: `${field.label} is required.` },
              { status: 400 }
            );
          }
        } else if (
          val === undefined ||
          val === null ||
          (typeof val === 'string' && val.trim() === '') ||
          (Array.isArray(val) && val.length === 0)
        ) {
          return NextResponse.json(
            { success: false, error: `Field '${field.label}' is required.` },
            { status: 400 }
          );
        }
      }

      // Capture core fields
      if (field.type === 'phone' || field.id === 'f_phone') {
        rawPhone = String(val || '').trim();
      } else if (field.id === 'f_name' || (field.type === 'text' && field.isSystem)) {
        leadName = String(val || '').trim();
      } else if (field.type === 'email' || field.id === 'f_email') {
        leadEmail = val ? String(val).trim() : null;
      } else {
        // Collect custom fields
        if (val !== undefined && val !== null) {
          customFields[field.id] = val;
        }
      }
    }

    // Fallback if not mapped via field IDs
    if (!leadName && body.name) leadName = String(body.name).trim();
    if (!rawPhone && body.phone) rawPhone = String(body.phone).trim();
    if (!leadEmail && body.email) leadEmail = String(body.email).trim();

    if (!leadName) {
      return NextResponse.json({ success: false, error: 'Full Name is required.' }, { status: 400 });
    }

    const normalizedPhone = normalizeLeadPhone(rawPhone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid WhatsApp phone number.' },
        { status: 400 }
      );
    }

    // 5. Save Lead in CRM
    const newLead = await db.lead.create({
      data: {
        formId: form.id,
        name: leadName,
        phone: normalizedPhone,
        email: leadEmail,
        customFields: JSON.stringify(customFields),
        tag: form.tag || null,
        status: 'new',
        clientId: form.clientId || null,
        createdById: form.createdById || null,
      },
    });

    // Also upsert/sync into Contact table so they are instantly searchable in Contacts
    try {
      await db.contact.upsert({
        where: { phone: normalizedPhone },
        create: {
          phone: normalizedPhone,
          name: leadName,
          tags: JSON.stringify(form.tag ? ['lead', form.tag] : ['lead']),
          customFields: JSON.stringify(customFields),
          source: `FORM:${form.title}`,
          clientId: form.clientId || null,
          createdById: form.createdById || null,
        },
        update: {
          name: leadName,
          customFields: JSON.stringify(customFields),
        },
      });
    } catch {}

    // 6. Asynchronous WhatsApp Instant Auto-Reply
    if (form.autoReplyEnabled && form.autoReplyInstance && form.autoReplyTemplate) {
      const welcomeText = renderWelcomeMessage(form.autoReplyTemplate, {
        name: leadName,
        phone: normalizedPhone,
        email: leadEmail,
        customFields,
      });

      if (welcomeText.trim()) {
        // Execute in background without delaying HTTP response
        (async () => {
          try {
            const evo = await EvolutionClient.fromDatabase();
            await evo.sendText(form.autoReplyInstance!, normalizedPhone, welcomeText, {
              delay: 1500,
              presence: 'composing',
            });
            logger.info(
              { leadId: newLead.id, phone: normalizedPhone, instance: form.autoReplyInstance },
              'Instant WhatsApp welcome message dispatched to lead'
            );
          } catch (replyErr: any) {
            logger.warn(
              { err: replyErr.message, leadId: newLead.id, phone: normalizedPhone },
              'Failed to dispatch automatic WhatsApp welcome message'
            );
          }
        })().catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Submission received successfully',
      leadId: newLead.id,
    });
  } catch (error: any) {
    logger.error({ err: error.message }, 'Form submission error');
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit form' },
      { status: 500 }
    );
  }
}
