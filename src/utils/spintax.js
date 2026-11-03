/**
 * Resolves Spintax formatted text.
 * Example: "{Hi|Hello|Dear} {name}, {Wishing you|Have} a great day!"
 */
export function parseSpintax(text) {
  if (!text) return '';
  
  const spintaxRegex = /\{([^{}]+)\}/;
  let matches;
  let parsed = text;
  
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
 */
export function substituteVariables(text, variables = {}) {
  if (!text) return '';
  
  return text.replace(/\{([a-zA-Z0-9_-]+)\}/g, (match, key) => {
    if (key.includes('|')) return match;
    const lowerKey = key.toLowerCase();
    for (const [varName, varVal] of Object.entries(variables)) {
      if (varName.toLowerCase() === lowerKey) {
        return varVal !== undefined && varVal !== null ? String(varVal) : '';
      }
    }
    return match;
  });
}

/**
 * Combined renderer: substitutes variables, then parses Spintax.
 */
export function renderMessage(template, recipient = {}) {
  const vars = {
    name: recipient.name || '',
    phone: recipient.phone || '',
    ...(recipient.custom_variables ? (typeof recipient.custom_variables === 'string' ? JSON.parse(recipient.custom_variables) : recipient.custom_variables) : {})
  };

  const withVars = substituteVariables(template, vars);
  return parseSpintax(withVars);
}

/**
 * Converts WhatsApp formatting into HTML safely:
 * *bold* -> <strong>
 * _italic_ -> <em>
 * ~strike~ -> <del>
 * ```code``` -> <code>
 */
export function formatWhatsAppTextToHtml(rawText) {
  if (!rawText) return '';

  // Escape HTML tags to prevent XSS
  let escaped = rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Triple backticks (code blocks)
  escaped = escaped.replace(/```([\s\S]*?)```/g, '<code class="bg-emerald-950/40 text-emerald-300 font-mono text-xs px-1.5 py-0.5 rounded block whitespace-pre-wrap my-1">$1</code>');

  // Single backticks (inline code)
  escaped = escaped.replace(/`([^`\n]+)`/g, '<code class="bg-emerald-950/40 text-emerald-300 font-mono text-xs px-1 py-0.5 rounded">$1</code>');

  // Bold: *text*
  escaped = escaped.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, '<strong>$1</strong>');

  // Italic: _text_
  escaped = escaped.replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '<em>$1</em>');

  // Strike: ~text~
  escaped = escaped.replace(/(?<!\w)~([^~\n]+)~(?!\w)/g, '<del class="line-through">$1</del>');

  // Line breaks to <br>
  escaped = escaped.replace(/\n/g, '<br/>');

  return escaped;
}

/**
 * Validate Spintax balanced braces
 */
export function validateSpintax(text) {
  if (!text) return { isValid: true, message: '' };

  let open = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') open++;
    if (text[i] === '}') {
      open--;
      if (open < 0) {
        return { isValid: false, message: 'Unexpected closing brace "}" without opening "{"' };
      }
    }
  }

  if (open > 0) {
    return { isValid: false, message: `Unclosed brace: missing ${open} closing "}" brace(s)` };
  }

  return { isValid: true, message: 'Valid Spintax structure' };
}

