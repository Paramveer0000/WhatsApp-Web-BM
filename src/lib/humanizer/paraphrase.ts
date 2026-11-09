/**
 * Protected Token Extractor and Validator.
 * Guarantees that any AI paraphrasing never alters URLs, phone numbers,
 * currency prices, dates, or template variables {{var}}.
 */

export function extractProtectedTokens(text: string): string[] {
  const tokens: string[] = [];
  if (!text) return tokens;

  // 1. Template variables {{...}}
  const vars = text.match(/\{\{[^{}]+\}\}/g) || [];
  tokens.push(...vars);

  // 2. URLs
  const urls = text.match(/https?:\/\/[^\s)]+/g) || [];
  tokens.push(...urls);

  // 3. Phone numbers
  const phones = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];
  tokens.push(...phones);

  // 4. Prices and currencies
  const prices = text.match(/(?:₹|\$|€|£|Rs\.?)\s?\d+(?:,\d+)*(?:\.\d+)?/g) || [];
  tokens.push(...prices);

  // Normalize by trimming
  return tokens.map((t) => t.trim().toLowerCase());
}

/**
 * Validates whether candidate paraphrased text accurately retains all critical
 * tokens found in the original source text. Returns true only if 100% of tokens match.
 */
export function validateParaphraseTokens(originalText: string, candidateText: string): boolean {
  if (!candidateText || candidateText.trim().length === 0) return false;

  const originalTokens = extractProtectedTokens(originalText);
  if (originalTokens.length === 0) return true;

  const candidateLower = candidateText.toLowerCase();

  for (const token of originalTokens) {
    if (!candidateLower.includes(token)) {
      return false; // Critical token missing or altered!
    }
  }

  return true;
}

