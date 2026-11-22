/**
 * Custom Lead Form Builder and CRM Helper Functions.
 */

// In-memory sliding rate limiter for public form submissions (10 submits per 15 min per IP)
const ipSubmissionTracker = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export function checkFormRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = ipSubmissionTracker.get(ip);

  if (!record || now >= record.resetAt) {
    ipSubmissionTracker.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

/**
 * Normalizes phone numbers for WhatsApp:
 * Strips whitespace, hyphens, brackets, leading zeros, or '+'.
 * Auto-prepends '91' if 10-digit standard mobile number.
 */
export function normalizeLeadPhone(raw: string): string {
  if (!raw) return '';
  let digits = raw.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }
  // Auto-prepend 91 if 10 digits
  if (digits.length === 10) {
    digits = `91${digits}`;
  }
  return digits;
}

/**
 * Auto-generates a clean URL-safe slug from form title with random suffix.
 */
export function generateFormSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'lead-form';

  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${base}-${randomSuffix}`;
}

/**
 * Replaces dynamic variables in welcome message template:
 * Supports {name}, {phone}, {email}, and any custom fields e.g. {f_budget}, {city}.
 */
export function renderWelcomeMessage(
  template: string,
  lead: {
    name: string;
    phone: string;
    email?: string | null;
    customFields?: Record<string, any>;
  }
): string {
  if (!template) return '';
  let rendered = template
    .replace(/\{name\}/gi, lead.name || '')
    .replace(/\{phone\}/gi, lead.phone || '')
    .replace(/\{email\}/gi, lead.email || '');

  if (lead.customFields && typeof lead.customFields === 'object') {
    for (const [key, val] of Object.entries(lead.customFields)) {
      const stringVal = val === null || val === undefined ? '' : String(val);
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      rendered = rendered.replace(regex, stringVal);
    }
  }

  return rendered.trim();
}

export interface FormFieldDefinition {
  id: string;
  label: string;
  type: 'text' | 'phone' | 'email' | 'number' | 'select' | 'textarea' | 'checkbox';
  required: boolean;
  placeholder?: string;
  options?: string[]; // For select dropdowns
  isSystem?: boolean; // Core locked fields (Name, WhatsApp Number)
}
