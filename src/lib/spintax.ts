/**
 * Enterprise Templating Engine with Recursive-Descent AST Parser,
 * Deterministic PRNG Rendering, and WhatsApp Syntax Formatter.
 */

export type ASTNode =
  | { type: 'text'; value: string }
  | { type: 'variable'; key: string; fallback?: string }
  | { type: 'spintax'; options: ASTNode[][] };

export interface ParseError {
  message: string;
  line: number;
  column: number;
}

export class TemplateSyntaxError extends Error {
  public line: number;
  public column: number;

  constructor(message: string, line: number, column: number) {
    super(`Template syntax error at line ${line}, col ${column}: ${message}`);
    this.name = 'TemplateSyntaxError';
    this.line = line;
    this.column = column;
  }
}

/**
 * Recursive-Descent Parser for template text
 * Supports:
 * - Double braces for variables: {{name}} or {{name|fallback}}
 * - Single braces for spintax: {Hi|Hello|{Dear|Good morning}} (nesting allowed)
 * - Escaping via backslash: \{, \}, \|
 */
export function parseTemplateToAST(input: string): { ast: ASTNode[]; errors: ParseError[] } {
  const errors: ParseError[] = [];
  let index = 0;
  let line = 1;
  let col = 1;

  function advance(n: number = 1) {
    for (let i = 0; i < n; i++) {
      if (input[index] === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
      index++;
    }
  }

  function peek(n: number = 0): string {
    return input[index + n] || '';
  }

  function parseNodes(stopChars: string[] = [], depth: number = 0): ASTNode[] {
    if (depth > 25) {
      // Exceeded max recursion depth, treat remainder as plain text to prevent stack overflow
      return [{ type: 'text', value: input.slice(index) }];
    }
    const nodes: ASTNode[] = [];
    let currentText = '';

    while (index < input.length) {
      const ch = peek();

      // Check for stop condition
      if (stopChars.includes(ch)) {
        break;
      }

      // Check for escaped characters
      if (ch === '\\' && ['{', '}', '|', '\\'].includes(peek(1))) {
        advance(); // skip \
        currentText += peek();
        advance();
        continue;
      }

      // Variable: {{var}} or {{var|fallback}}
      if (ch === '{' && peek(1) === '{') {
        if (currentText) {
          nodes.push({ type: 'text', value: currentText });
          currentText = '';
        }
        advance(2); // skip {{

        let varContent = '';
        const startLine = line;
        const startCol = col;
        let closed = false;

        while (index < input.length) {
          if (peek() === '}' && peek(1) === '}') {
            advance(2);
            closed = true;
            break;
          }
          varContent += peek();
          advance();
        }

        if (!closed) {
          errors.push({
            message: 'Unclosed variable tag (expected "}}")',
            line: startLine,
            column: startCol,
          });
        }

        const pipeIdx = varContent.indexOf('|');
        if (pipeIdx !== -1) {
          const key = varContent.substring(0, pipeIdx).trim();
          const fallback = varContent.substring(pipeIdx + 1);
          nodes.push({ type: 'variable', key, fallback });
        } else {
          nodes.push({ type: 'variable', key: varContent.trim() });
        }
        continue;
      }

      // Single brace for Spintax: {opt1|opt2} or legacy {name|fallback}
      if (ch === '{') {
        if (currentText) {
          nodes.push({ type: 'text', value: currentText });
          currentText = '';
        }
        const startLine = line;
        const startCol = col;
        advance(); // skip {

        const options: ASTNode[][] = [];
        let currentOption: ASTNode[] = [];

        while (index < input.length && peek() !== '}') {
          if (peek() === '|') {
            options.push(currentOption);
            currentOption = [];
            advance();
            continue;
          }

          const parsedChild = parseNodes(['|', '}'], depth + 1);
          currentOption.push(...parsedChild);
        }

        if (peek() === '}') {
          options.push(currentOption);
          advance(); // skip }

          // Support single-brace variables: {name}, {company}, {name|fallback}, {company|fallback}
          if (options.length === 1 && options[0].length === 1 && options[0][0].type === 'text') {
            const rawKey = options[0][0].value.trim();
            if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(rawKey)) {
              nodes.push({ type: 'variable', key: rawKey });
              continue;
            }
          } else if (options.length === 2 && options[0].length === 1 && options[0][0].type === 'text') {
            const rawKey = options[0][0].value.trim();
            if (/^(name|phone|company|city|email|var\d+|custom\d+|address|firstName|lastName|first_name|last_name)$/i.test(rawKey)) {
              const fallback = options[1].map((n) => (n.type === 'text' ? n.value : '')).join('');
              nodes.push({ type: 'variable', key: rawKey, fallback });
              continue;
            }
          }

          if (options.length > 1) {
            nodes.push({ type: 'spintax', options });
          } else {
            // Lone brace with no pipes
            nodes.push({ type: 'text', value: '{' });
            if (options[0]) nodes.push(...options[0]);
            nodes.push({ type: 'text', value: '}' });
          }
        } else {
          errors.push({
            message: 'Unclosed spintax block (expected "}")',
            line: startLine,
            column: startCol,
          });
        }
        continue;
      }

      // Standalone closing brace
      if (ch === '}' && stopChars.length === 0) {
        errors.push({
          message: 'Unexpected closing brace "}" without opening "{"',
          line,
          column: col,
        });
        currentText += ch;
        advance();
        continue;
      }

      currentText += ch;
      advance();
    }

    if (currentText) {
      nodes.push({ type: 'text', value: currentText });
    }

    return nodes;
  }

  const ast = parseNodes();
  return { ast, errors };
}

/**
 * Deterministic Pseudo-Random Number Generator (Mulberry32)
 * Ensures reproducible spintax rendering across previews, retries, and workers.
 */
function createSeededPRNG(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }

  return function () {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Computes exact combinatorial variants count from AST
 */
export function countVariants(nodes: ASTNode[]): number {
  let count = 1;

  for (const node of nodes) {
    if (node.type === 'spintax') {
      let optionSum = 0;
      for (const option of node.options) {
        optionSum += countVariants(option);
      }
      count = count * Math.max(1, optionSum);
    }
  }

  return Math.min(count, 10_000_000);
}

/**
 * Deterministic renderer that traverses AST and outputs final text
 */
export function renderAST(
  nodes: ASTNode[],
  variables: Record<string, any> = {},
  prng: () => number = Math.random
): string {
  let result = '';

  for (const node of nodes) {
    if (node.type === 'text') {
      result += node.value;
    } else if (node.type === 'variable') {
      const lowerKey = node.key.toLowerCase();
      let matchedVal: any = undefined;

      for (const [k, v] of Object.entries(variables)) {
        if (k.toLowerCase() === lowerKey) {
          if (v !== undefined && v !== null && String(v).trim() !== '') {
            matchedVal = String(v);
            break;
          }
        }
      }

      if (matchedVal !== undefined) {
        result += matchedVal;
      } else if (node.fallback !== undefined) {
        result += node.fallback;
      } else {
        result += `{{${node.key}}}`;
      }
    } else if (node.type === 'spintax') {
      if (node.options.length > 0) {
        const choiceIdx = Math.floor(prng() * node.options.length);
        const chosen = node.options[choiceIdx] || node.options[0] || [];
        result += renderAST(chosen, variables, prng);
      }
    }
  }

  return result;
}

/**
 * High-level render message function
 */
export function renderMessage(
  template: string,
  recipient: { name?: string | null; phone?: string; customVariables?: any; custom_variables?: any } = {},
  options: {
    appendOptOut?: boolean;
    optOutText?: string;
    seedKey?: string;
  } = {}
): string {
  const vars: Record<string, any> = {
    name: recipient.name || '',
    phone: recipient.phone || '',
    ...(typeof recipient.customVariables === 'string'
      ? JSON.parse(recipient.customVariables || '{}')
      : recipient.customVariables || {}),
    ...(typeof recipient.custom_variables === 'string'
      ? JSON.parse(recipient.custom_variables || '{}')
      : recipient.custom_variables || {}),
  };

  const { ast } = parseTemplateToAST(template);
  const prng = options.seedKey ? createSeededPRNG(options.seedKey) : Math.random;
  let text = renderAST(ast, vars, prng);

  if (options.appendOptOut) {
    const footer = options.optOutText || 'Reply STOP to unsubscribe';
    text += `\n\n_${footer}_`;
  }

  // Warn if text exceeds WhatsApp length limit
  if (text.length > 4096) {
    text = text.slice(0, 4096);
  }

  return text;
}

/**
 * Legacy compatibility functions
 */
export function countSpintaxVariations(template: string): number {
  const { ast } = parseTemplateToAST(template);
  return countVariants(ast);
}

export function parseSpintax(text: string, seedKey?: string): string {
  const { ast } = parseTemplateToAST(text);
  const prng = seedKey ? createSeededPRNG(seedKey) : Math.random;
  return renderAST(ast, {}, prng);
}

export function substituteVariables(text: string, variables: Record<string, any> = {}): string {
  const { ast } = parseTemplateToAST(text);
  return renderAST(ast, variables);
}

/**
 * Converts WhatsApp formatting to safe HTML for preview bubbles
 */
export function formatWhatsAppToHtml(text: string): string {
  if (!text) return '';

  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks ```code```
  escaped = escaped.replace(/```([\s\S]*?)```/g, '<pre class="bg-black/30 p-1 rounded font-mono text-[11px] my-1">$1</pre>');
  // Bold *bold*
  escaped = escaped.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
  // Italic _italic_
  escaped = escaped.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  // Strikethrough ~strike~
  escaped = escaped.replace(/~([^~\n]+)~/g, '<del class="opacity-75">$1</del>');
  // Inline code `code`
  escaped = escaped.replace(/`([^`\n]+)`/g, '<code class="bg-black/30 px-1 py-0.5 rounded font-mono text-[11px]">$1</code>');
  // Newlines
  escaped = escaped.replace(/\n/g, '<br/>');

  return escaped;
}
