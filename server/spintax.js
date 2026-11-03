/**
 * Resolves Spintax formatted text.
 * Example: "{Hi|Hello|Dear} {name}, {Wishing you|Have} a great day!"
 * Supports nested spintax: "{Hi|{Hello|Hey there}}"
 */
export function parseSpintax(text) {
  if (!text) return '';
  
  const spintaxRegex = /\{([^{}]+)\}/;
  let matches;
  let parsed = text;
  
  // Recursively resolve inner-most spintax groups until none remain
  let iterations = 0;
  while ((matches = spintaxRegex.exec(parsed)) !== null && iterations < 100) {
    const options = matches[1].split('|');
    const choice = options[Math.floor(Math.random() * options.length)];
    parsed = parsed.replace(matches[0], choice);
    iterations++;
  }
  
  return parsed;
}

/**
 * Replaces variable placeholders like {name}, {phone}, {company} etc.
 * Case-insensitive match on keys.
 */
export function substituteVariables(text, variables = {}) {
  if (!text) return '';
  
  return text.replace(/\{([a-zA-Z0-9_-]+)\}/g, (match, key) => {
    // If it looks like spintax (contains pipe), don't substitute here
    if (key.includes('|')) return match;
    
    const lowerKey = key.toLowerCase();
    for (const [varName, varVal] of Object.entries(variables)) {
      if (varName.toLowerCase() === lowerKey) {
        return varVal !== undefined && varVal !== null ? String(varVal) : '';
      }
    }
    return match; // Return as-is if no variable found
  });
}

/**
 * Full message renderer: substitutes variables first, then resolves spintax.
 */
export function renderMessage(template, recipient = {}, fallbackName = 'Valued Customer') {
  const vars = {
    name: recipient.name && recipient.name.trim() !== '' ? recipient.name : fallbackName,
    phone: recipient.phone || '',
    ...(recipient.custom_variables ? (typeof recipient.custom_variables === 'string' ? JSON.parse(recipient.custom_variables) : recipient.custom_variables) : {})
  };

  const withVars = substituteVariables(template, vars);
  return parseSpintax(withVars);
}

/**
 * Normalize and validate phone numbers:
 * - Strip non-digits (spaces, dashes, brackets, pluses)
 * - Remove leading '00' or single '0'
 * - If 10 digits (standard national format for many countries like India/US), auto-prepend country code
 */
export function cleanPhoneNumber(rawPhone, defaultCountryCode = '91') {
  if (!rawPhone) return { isValid: false, phone: '', error: 'Empty phone number' };
  
  let cleaned = String(rawPhone).trim();
  // Remove non-digit characters
  cleaned = cleaned.replace(/[^\d]/g, '');
  
  // Remove international prefix '00'
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  
  // If starts with single 0 and is 11 digits (e.g. 09876543210), strip the 0
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }
  
  // Auto-prepend country code if 10 digits
  if (cleaned.length === 10 && defaultCountryCode) {
    const cleanCC = defaultCountryCode.replace(/[^\d]/g, '');
    cleaned = cleanCC + cleaned;
  }
  
  // Standard WhatsApp phone numbers are usually 11-15 digits
  if (cleaned.length < 10 || cleaned.length > 16) {
    return {
      isValid: false,
      phone: cleaned,
      error: `Invalid phone length (${cleaned.length} digits). Expected 10-15 digits.`
    };
  }
  
  return {
    isValid: true,
    phone: cleaned,
    error: null
  };
}

