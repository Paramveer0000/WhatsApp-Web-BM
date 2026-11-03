/**
 * Evaluation and Quality Layer for WhatsApp Bulk Campaigns
 */

export function evaluateTaskQuality(template, recipient, settings = {}) {
  let score = 100;
  const issues = [];
  const notes = [];

  // 1. Variable Completeness Check
  const missingFallback = settings.missing_variable_fallback || 'Valued Customer';
  const vars = {
    name: recipient.name || '',
    phone: recipient.phone || '',
    ...(recipient.custom_variables ? (typeof recipient.custom_variables === 'string' ? JSON.parse(recipient.custom_variables) : recipient.custom_variables) : {})
  };

  if (!vars.name || vars.name.trim() === '') {
    score -= 10;
    notes.push(`Contact name missing; substituted fallback "${missingFallback}".`);
  }

  // 2. Anti-Spam Blacklist Keywords Check
  if (settings.enable_spam_filter === '1' || settings.enable_spam_filter === true || settings.enable_spam_filter === 1) {
    const blacklistRaw = settings.spam_blacklist || '';
    const blacklistWords = blacklistRaw
      .split(',')
      .map(w => w.trim().toLowerCase())
      .filter(Boolean);

    const lowerTemplate = template.toLowerCase();
    const flaggedWords = [];

    for (const word of blacklistWords) {
      if (word && lowerTemplate.includes(word)) {
        flaggedWords.push(word);
      }
    }

    if (flaggedWords.length > 0) {
      score -= 35;
      issues.push(`Spam trigger keyword(s) detected: "${flaggedWords.join(', ')}"`);
      notes.push(`High spam risk: message contains flagged keywords [${flaggedWords.join(', ')}].`);
    }
  }

  // 3. Spintax Entropy Evaluation
  const hasSpintax = /\{([^{}]+)\}/.test(template);
  if (!hasSpintax) {
    score -= 15;
    notes.push('No Spintax variation found; recommended to use {Hi|Hello} to prevent pattern detection.');
  } else {
    notes.push('Spintax active for anti-ban text randomization.');
  }

  // 4. Message Length & Structure Check
  if (template.length < 10) {
    score -= 20;
    issues.push('Message template is suspiciously short (<10 chars).');
  } else if (template.length > 2000) {
    score -= 10;
    issues.push('Message template exceeds recommended length (>2000 chars).');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    qualityScore: score,
    isQualityPassed: score >= 60 && issues.length === 0,
    hasSpamRisk: issues.some(i => i.includes('Spam')),
    issues,
    notes: notes.join(' ')
  };
}

/**
 * Pre-dispatch Evaluation of recipient on WhatsApp
 */
export async function evaluateWhatsAppNumber(evolutionClient, instanceName, phone) {
  try {
    const results = await evolutionClient.checkWhatsAppNumbers(instanceName, [phone]);
    if (Array.isArray(results) && results.length > 0) {
      const match = results[0];
      const exists = Boolean(match.exists || match.isInWhatsapp);
      return {
        evaluated: true,
        exists,
        jid: match.jid || null,
        error: null
      };
    }
    return {
      evaluated: true,
      exists: false,
      jid: null,
      error: 'No validation record returned by Evolution API'
    };
  } catch (err) {
    return {
      evaluated: false,
      exists: true, // Fail-open if API check endpoint error, unless circuit-break
      error: err.message
    };
  }
}

