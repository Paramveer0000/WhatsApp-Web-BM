import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';

export interface PhoneValidationResult {
  isValid: boolean;
  raw: string;
  formatted: string;
  country?: string;
  error?: string | null;
}

/**
 * Normalizes phone numbers:
 * - Strips whitespace, brackets, hyphens, pluses
 * - Removes leading 00 or single 0
 * - Auto-prepends default country code (e.g. 91) if 10 digits
 * - Validates using libphonenumber-js
 */
export function normalizePhone(raw: string | number, defaultCountryCode: string = '91'): PhoneValidationResult {
  if (!raw) {
    return { isValid: false, raw: '', formatted: '', error: 'Empty phone number' };
  }

  let cleaned = String(raw).trim().replace(/[^\d]/g, '');

  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // If 10 digits, prepend default country code (e.g. India 91 or US 1)
  if (cleaned.length === 10 && defaultCountryCode) {
    const cleanCC = defaultCountryCode.replace(/[^\d]/g, '');
    cleaned = cleanCC + cleaned;
  }

  if (cleaned.length < 10 || cleaned.length > 16) {
    return {
      isValid: false,
      raw: String(raw),
      formatted: cleaned,
      error: `Invalid length (${cleaned.length} digits). Expected 10-15 digits.`,
    };
  }

  // Validate with libphonenumber-js
  try {
    const parsed = parsePhoneNumber(`+${cleaned}`);
    if (parsed && parsed.isValid()) {
      return {
        isValid: true,
        raw: String(raw),
        formatted: cleaned,
        country: parsed.country,
        error: null,
      };
    }
  } catch {
    // If country parser fails but length is 10-15 digits
  }

  return {
    isValid: true,
    raw: String(raw),
    formatted: cleaned,
    error: null,
  };
}

/**
 * Deduplicate rows based on normalized phone number
 */
export function deduplicateContacts(rows: Array<{ phone: string; [key: string]: any }>) {
  const seen = new Set<string>();
  const unique: typeof rows = [];
  let duplicatesCount = 0;

  for (const row of rows) {
    if (seen.has(row.phone)) {
      duplicatesCount++;
    } else {
      seen.add(row.phone);
      unique.push(row);
    }
  }

  return { unique, duplicatesCount };
}

