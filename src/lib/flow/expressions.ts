import { parseSpintax } from '@/lib/spintax';

/**
 * Sandboxed Expression & Variable Interpolation Engine
 * 
 * Supports:
 * - Variable lookup: {{name}}, {{contact.name}}, {{session.phone}}, {{message.text|fallback}}
 * - Spintax syntax: {Hi|Hello|Dear}
 * - Safe boolean/arithmetic condition evaluation (NO eval/Function)
 */

export interface ExpressionContext {
  contact?: {
    name?: string | null;
    phone?: string;
    tags?: string[];
    customFields?: Record<string, any>;
    [key: string]: any;
  };
  session?: Record<string, any>;
  message?: {
    text?: string;
    mediaType?: string;
    timestamp?: number;
    phone?: string;
  };
  bot?: {
    name?: string;
    id?: string;
  };
  system?: {
    now?: string;
    weekday?: string;
    timezone?: string;
  };
  [key: string]: any;
}

/**
 * Safely extracts a dotted property path from a context object.
 * e.g. "contact.name", "session.booking_date"
 */
export function getVariableValue(path: string, ctx: ExpressionContext): any {
  if (!path) return undefined;
  const cleanPath = path.trim();

  // Direct key lookup in session vars
  if (ctx.session && cleanPath in ctx.session) {
    return ctx.session[cleanPath];
  }

  const parts = cleanPath.split('.');
  let current: any = ctx;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }

  // Fallback to top-level ctx or session
  if (current === undefined && ctx.session) {
    return ctx.session[cleanPath];
  }

  return current;
}

/**
 * Replaces `{{variable|fallback}}` with resolved values from context.
 * Then runs Spintax resolver (`{A|B|C}`).
 */
export function renderTemplateText(text: string, ctx: ExpressionContext): string {
  if (!text) return '';

  // 1. Replace {{variable|fallback}}
  const renderedVars = text.replace(/\{\{\s*([a-zA-Z0-9_.]+)(?:\s*\|\s*([^}]+))?\s*\}\}/g, (_, varName, fallback) => {
    const val = getVariableValue(varName, ctx);
    if (val !== undefined && val !== null && val !== '') {
      return String(val);
    }
    return fallback !== undefined ? fallback : '';
  });

  // 2. Resolve Spintax ({Hi|Hello|Dear})
  try {
    return parseSpintax(renderedVars);
  } catch {
    return renderedVars;
  }
}

/**
 * Evaluates a single Condition rule safely without eval().
 */
export function evaluateConditionRule(
  rule: { variable: string; operator: string; value: string },
  ctx: ExpressionContext
): boolean {
  const actualVal = getVariableValue(rule.variable, ctx);
  const targetVal = rule.value ?? '';

  const actualStr = actualVal !== undefined && actualVal !== null ? String(actualVal).trim() : '';
  const targetStr = String(targetVal).trim();

  const actualLower = actualStr.toLowerCase();
  const targetLower = targetStr.toLowerCase();

  switch (rule.operator) {
    case 'equals':
      return actualLower === targetLower;

    case 'not_equals':
      return actualLower !== targetLower;

    case 'contains':
      return actualLower.includes(targetLower);

    case 'not_contains':
      return !actualLower.includes(targetLower);

    case 'starts_with':
      return actualLower.startsWith(targetLower);

    case 'ends_with':
      return actualLower.endsWith(targetLower);

    case 'greater_than': {
      const a = Number(actualVal);
      const b = Number(targetVal);
      return !isNaN(a) && !isNaN(b) && a > b;
    }

    case 'less_than': {
      const a = Number(actualVal);
      const b = Number(targetVal);
      return !isNaN(a) && !isNaN(b) && a < b;
    }

    case 'is_empty':
      return actualStr === '' || actualVal === null || actualVal === undefined;

    case 'is_not_empty':
      return actualStr !== '' && actualVal !== null && actualVal !== undefined;

    case 'matches_regex': {
      try {
        const regex = new RegExp(targetStr, 'i');
        return regex.test(actualStr);
      } catch {
        return false;
      }
    }

    case 'in_list': {
      const items = targetStr.split(',').map((s) => s.trim().toLowerCase());
      return items.includes(actualLower);
    }

    default:
      return false;
  }
}

/**
 * Validates user input for an Ask Question node based on validationType.
 */
export function validateUserInput(
  input: string,
  validationType: string = 'text',
  options?: { regexPattern?: string; choiceOptions?: string[] }
): { isValid: boolean; parsedValue: any; error?: string } {
  const clean = (input || '').trim();

  if (!clean) {
    return { isValid: false, parsedValue: null, error: 'Input cannot be empty' };
  }

  switch (validationType) {
    case 'text':
      return { isValid: true, parsedValue: clean };

    case 'number': {
      const num = Number(clean.replace(/,/g, ''));
      if (isNaN(num)) {
        return { isValid: false, parsedValue: null, error: 'Please enter a valid number' };
      }
      return { isValid: true, parsedValue: num };
    }

    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(clean)) {
        return { isValid: false, parsedValue: null, error: 'Please enter a valid email address' };
      }
      return { isValid: true, parsedValue: clean.toLowerCase() };
    }

    case 'phone': {
      const digits = clean.replace(/[^\d+]/g, '');
      if (digits.length < 8 || digits.length > 16) {
        return { isValid: false, parsedValue: null, error: 'Please enter a valid phone number (at least 8 digits)' };
      }
      return { isValid: true, parsedValue: digits };
    }

    case 'date': {
      const d = new Date(clean);
      if (isNaN(d.getTime())) {
        return { isValid: false, parsedValue: null, error: 'Please enter a valid date (e.g. YYYY-MM-DD)' };
      }
      return { isValid: true, parsedValue: d.toISOString().split('T')[0] };
    }

    case 'choice': {
      if (!options?.choiceOptions || options.choiceOptions.length === 0) {
        return { isValid: true, parsedValue: clean };
      }
      const lower = clean.toLowerCase();
      // Match by exact string or option index (1, 2, 3...)
      const choiceIdx = parseInt(clean, 10);
      if (!isNaN(choiceIdx) && choiceIdx >= 1 && choiceIdx <= options.choiceOptions.length) {
        return { isValid: true, parsedValue: options.choiceOptions[choiceIdx - 1] };
      }
      const matched = options.choiceOptions.find((opt) => opt.toLowerCase() === lower || opt.toLowerCase().includes(lower));
      if (!matched) {
        return {
          isValid: false,
          parsedValue: null,
          error: `Please choose one of: ${options.choiceOptions.join(', ')}`,
        };
      }
      return { isValid: true, parsedValue: matched };
    }

    case 'regex': {
      if (!options?.regexPattern) return { isValid: true, parsedValue: clean };
      try {
        const re = new RegExp(options.regexPattern);
        if (!re.test(clean)) {
          return { isValid: false, parsedValue: null, error: 'Input does not match required format' };
        }
        return { isValid: true, parsedValue: clean };
      } catch {
        return { isValid: true, parsedValue: clean };
      }
    }

    default:
      return { isValid: true, parsedValue: clean };
  }
}
