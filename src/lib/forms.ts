/**
 * Custom Lead Form Builder, Schema Engine and CRM Helper Functions.
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
      const stringVal = val === null || val === undefined 
        ? '' 
        : Array.isArray(val) 
        ? val.join(', ') 
        : String(val);
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      rendered = rendered.replace(regex, stringVal);
    }
  }

  return rendered.trim();
}

export type FormFieldType =
  | 'text'           // Short Answer text input
  | 'phone'          // WhatsApp / Phone with international formatting
  | 'email'          // Email with validation
  | 'number'         // Numeric input
  | 'textarea'       // Multi-line detailed response
  | 'select'         // Dropdown single select
  | 'radio'          // Visual choice cards / radio pills
  | 'checkbox_group' // Multi-select checkbox options
  | 'date'           // Calendar date picker
  | 'rating'         // 1-5 Star rating widget
  | 'section_header' // Visual divider with section title
  | 'checkbox';      // Single consent or agreement toggle

export interface ConditionalRule {
  dependsOn: string; // ID of the parent field
  operator: 'equals' | 'not_equals' | 'contains' | 'is_filled';
  value?: string;
}

export interface FormFieldDefinition {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  width?: 'full' | 'half';
  options?: string[];
  defaultValue?: any;
  isSystem?: boolean;
  conditional?: ConditionalRule | null;
}

/**
 * Evaluates whether a field should be visible based on its conditional rule.
 */
export function isFieldVisible(
  field: FormFieldDefinition,
  formData: Record<string, any>
): boolean {
  if (!field.conditional || !field.conditional.dependsOn) {
    return true;
  }

  const { dependsOn, operator, value } = field.conditional;
  const parentValue = formData[dependsOn];

  if (operator === 'is_filled') {
    return parentValue !== undefined && parentValue !== null && String(parentValue).trim().length > 0;
  }

  if (parentValue === undefined || parentValue === null) {
    return false;
  }

  if (Array.isArray(parentValue)) {
    if (operator === 'contains' || operator === 'equals') {
      return parentValue.some((v) => String(v).toLowerCase() === String(value || '').toLowerCase());
    }
    if (operator === 'not_equals') {
      return !parentValue.some((v) => String(v).toLowerCase() === String(value || '').toLowerCase());
    }
    return false;
  }

  const strParent = String(parentValue).toLowerCase().trim();
  const strExpected = String(value || '').toLowerCase().trim();

  switch (operator) {
    case 'equals':
      return strParent === strExpected;
    case 'not_equals':
      return strParent !== strExpected;
    case 'contains':
      return strParent.includes(strExpected);
    default:
      return true;
  }
}
