/**
 * Pure function: splits long messages into natural conversational bubbles.
 * Invariant: Never split inside URLs, phone numbers, prices/numbers, code blocks,
 * bold/italic WhatsApp markup, or numbered menu lists.
 */

export interface SplitOptions {
  splitIntoBubbles?: boolean;
  minChars?: number;
  maxChars?: number;
  maxBubbles?: number;
}

export function splitIntoBubbles(text: string, options: SplitOptions = {}): string[] {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];

  const {
    splitIntoBubbles = true,
    minChars = 80,
    maxChars = 220,
    maxBubbles = 3,
  } = options;

  // If feature is disabled or text is already short enough, return single bubble
  if (!splitIntoBubbles || trimmed.length <= maxChars || maxBubbles <= 1) {
    return [trimmed];
  }

  // If text contains a menu/list structure (e.g., "1.", "2." or bullets), preserve as single bubble
  const hasNumberedMenu = /(?:^|\n)\s*(?:\d+[\.\)]|[a-zA-Z][\.\)])\s+/m.test(trimmed);
  if (hasNumberedMenu) {
    // If there's an intro paragraph before the menu, we can split off the intro, but keep the menu together
    const parts = trimmed.split(/\n{2,}/);
    if (parts.length > 1 && parts.length <= maxBubbles) {
      return parts.map((p) => p.trim()).filter(Boolean);
    }
    return [trimmed];
  }

  // 1. First attempt: Split by double newlines (paragraphs)
  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length > 1 && paragraphs.length <= maxBubbles) {
    return paragraphs;
  }

  // 2. Protected Token Tokenizer:
  // Temporarily replace protected spans (URLs, phones, code blocks, bold/italic spans)
  // with placeholders like __PROT_0__
  const protectedTokens: string[] = [];
  const protect = (match: string) => {
    const placeholder = `\uE000PROT_${protectedTokens.length}\uE001`;
    protectedTokens.push(match);
    return placeholder;
  };

  let tokenized = trimmed
    // Code blocks ```...``` or `...`
    .replace(/```[\s\S]*?```/g, protect)
    .replace(/`[^`\n]+`/g, protect)
    // URLs (http, https, www) without swallowing trailing sentence punctuation
    .replace(/https?:\/\/[^\s)]+?(?=[.,;:!?]?(?:\s|$))/g, protect)
    .replace(/www\.[^\s)]+?(?=[.,;:!?]?(?:\s|$))/g, protect)
    // WhatsApp bold *...* and italic _..._
    .replace(/\*[^*\n]+\*/g, protect)
    .replace(/_[^_\n]+_/g, protect)
    // Phone numbers (international, Indian 5+5, US 3+3+4, etc.)
    .replace(/(?:\+?\d{1,3}[-.\s]?)?(?:\d{5}[-.\s]?\d{5}|\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g, protect)
    // Currency & numbers e.g. ₹10,000 or $50.00
    .replace(/(?:₹|\$|€|£|Rs\.?)\s?\d+(?:,\d+)*(?:\.\d+)?/g, protect);

  // 3. Candidate sentence break points (. ! ? or newline)
  // Split on punctuation followed by whitespace, or single newlines
  const sentences: string[] = [];
  const rawParts = tokenized.split(/(?<=[.!?\n])\s+/);

  for (const part of rawParts) {
    const clean = part.trim();
    if (clean) sentences.push(clean);
  }

  if (sentences.length <= 1) {
    // Cannot break safely on punctuation
    return [trimmed];
  }

  // 4. Group sentences into bubbles up to maxChars & maxBubbles
  const bubbles: string[] = [];
  let currentBubble = '';

  for (let i = 0; i < sentences.length; i++) {
    const sent = sentences[i];
    const candidate = currentBubble ? `${currentBubble} ${sent}` : sent;

    // Restore candidate length with real tokens for accurate sizing
    const candidateRealLength = restoreTokens(candidate, protectedTokens).length;

    if (candidateRealLength <= maxChars || !currentBubble) {
      currentBubble = candidate;
    } else {
      bubbles.push(restoreTokens(currentBubble, protectedTokens).trim());
      currentBubble = sent;

      // If we've hit maxBubbles - 1, the remaining sentences must stay in the last bubble
      if (bubbles.length >= maxBubbles - 1) {
        const remaining = sentences.slice(i).join(' ');
        bubbles.push(restoreTokens(remaining, protectedTokens).trim());
        currentBubble = '';
        break;
      }
    }
  }

  if (currentBubble) {
    bubbles.push(restoreTokens(currentBubble, protectedTokens).trim());
  }

  // Filter out any empty fragments
  const finalBubbles = bubbles.filter(Boolean);
  return finalBubbles.length > 0 ? finalBubbles : [trimmed];
}

function restoreTokens(text: string, tokens: string[]): string {
  return text.replace(/\uE000PROT_(\d+)\uE001/g, (_, idx) => {
    return tokens[Number(idx)] ?? '';
  });
}
