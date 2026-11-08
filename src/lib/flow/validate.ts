import { FlowDefinition, FlowNode } from './schema';

export interface FlowValidationIssue {
  nodeId?: string;
  level: 'error' | 'warning';
  code: string;
  message: string;
}

export interface FlowValidationResult {
  isValid: boolean;
  errors: FlowValidationIssue[];
  warnings: FlowValidationIssue[];
  nodeErrors: Record<string, string[]>;
}

/**
 * Validates a visual flow definition for structural and runtime completeness.
 */
export function validateFlow(flow: FlowDefinition): FlowValidationResult {
  const errors: FlowValidationIssue[] = [];
  const warnings: FlowValidationIssue[] = [];
  const nodeErrors: Record<string, string[]> = {};

  const addIssue = (level: 'error' | 'warning', code: string, message: string, nodeId?: string) => {
    const issue: FlowValidationIssue = { level, code, message, nodeId };
    if (level === 'error') {
      errors.push(issue);
      if (nodeId) {
        if (!nodeErrors[nodeId]) nodeErrors[nodeId] = [];
        nodeErrors[nodeId].push(message);
      }
    } else {
      warnings.push(issue);
    }
  };

  const { nodes, edges } = flow;
  const executableNodes = nodes.filter((n) => n.data.nodeType !== 'note' && n.data.nodeType !== 'group');

  // 1. Must have at least one trigger
  const triggerNodes = executableNodes.filter((n) => n.data.nodeType.startsWith('trigger_'));
  if (triggerNodes.length === 0) {
    addIssue('error', 'NO_TRIGGER', 'Flow must contain at least one Trigger node to start.');
  }

  // 2. Build Adjacency Graph
  const nodeMap = new Map<string, FlowNode>();
  for (const n of executableNodes) {
    nodeMap.set(n.id, n);
  }

  const outgoingEdges = new Map<string, string[]>();
  const incomingEdges = new Map<string, string[]>();

  for (const n of executableNodes) {
    outgoingEdges.set(n.id, []);
    incomingEdges.set(n.id, []);
  }

  for (const e of edges) {
    if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
      outgoingEdges.get(e.source)?.push(e.target);
      incomingEdges.get(e.target)?.push(e.source);
    }
  }

  // 3. Node-specific validations
  let hasHandoff = false;

  for (const n of executableNodes) {
    const { nodeType, config } = n.data;

    if (nodeType === 'control_handoff') hasHandoff = true;

    // Trigger validations
    if (nodeType === 'trigger_keyword') {
      const kws = config.keywords || [];
      if (kws.length === 0) {
        addIssue('error', 'EMPTY_KEYWORDS', 'Keyword trigger must specify at least one keyword.', n.id);
      }
    }

    // Message Text
    if (nodeType === 'message_text') {
      const text = (config.text || '').trim();
      if (!text) {
        addIssue('error', 'EMPTY_TEXT', 'Message text cannot be empty.', n.id);
      } else if (text.length > 1000) {
        addIssue('warning', 'LONG_TEXT', `Message is ${text.length} chars (recommended < 1000 to prevent WhatsApp spam filters).`, n.id);
      }
    }

    // Media
    if (nodeType === 'message_media') {
      if (!config.mediaUrl) {
        addIssue('error', 'MISSING_MEDIA_URL', 'Media message requires a valid media URL or file.', n.id);
      }
    }

    // Menu
    if (nodeType === 'message_menu') {
      const opts = config.menuOptions || [];
      if (opts.length < 2) {
        addIssue('error', 'INSUFFICIENT_MENU_OPTIONS', 'Menu must have at least 2 options.', n.id);
      }
      if (!config.invalidReplyText) {
        addIssue('warning', 'NO_MENU_FALLBACK', 'Consider setting an invalid reply message for unexpected user inputs.', n.id);
      }
    }

    // Ask Question
    if (nodeType === 'input_ask') {
      if (!config.questionText) {
        addIssue('error', 'MISSING_QUESTION', 'Question prompt cannot be empty.', n.id);
      }
      if (!config.variableName) {
        addIssue('error', 'MISSING_VARIABLE_NAME', 'Must specify a variable name to store the answer.', n.id);
      }
    }

    // Condition
    if (nodeType === 'logic_condition') {
      const rules = config.conditionRules || [];
      if (rules.length === 0) {
        addIssue('error', 'NO_CONDITION_RULES', 'Condition must specify at least one rule.', n.id);
      }
    }

    // HTTP
    if (nodeType === 'integration_http') {
      if (!config.httpUrl) {
        addIssue('error', 'MISSING_HTTP_URL', 'HTTP request requires a URL.', n.id);
      } else {
        try {
          const u = new URL(config.httpUrl);
          if (u.protocol !== 'http:' && u.protocol !== 'https:') {
            addIssue('error', 'INVALID_HTTP_PROTOCOL', 'URL must use http or https protocol.', n.id);
          }
          // SSRF check for localhost / loopback
          if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '169.254.169.254') {
            addIssue('warning', 'LOCAL_IP_WARNING', 'Private/loopback IP detected; will be blocked in production for SSRF protection.', n.id);
          }
        } catch {
          addIssue('error', 'INVALID_URL', 'Invalid URL format.', n.id);
        }
      }
    }

    // AI Reply
    if (nodeType === 'ai_reply') {
      if (!config.systemPrompt && !config.knowledgeBaseText) {
        addIssue('warning', 'EMPTY_AI_PROMPT', 'AI Reply has no custom instructions or knowledge base text; default fallback will be used.', n.id);
      }
    }

    // Output check (except End & Handoff nodes)
    const outs = outgoingEdges.get(n.id) || [];
    const isTerminalNode = nodeType === 'control_end' || nodeType === 'control_handoff' || nodeType === 'control_opt_out';
    if (!isTerminalNode && outs.length === 0) {
      addIssue('error', 'DANGLING_OUTPUT', 'This node has no outgoing connection to continue the flow.', n.id);
    }
  }

  // 4. Reachability Check (All non-trigger nodes must be reachable from at least one Trigger)
  const reachableNodes = new Set<string>();
  const queue: string[] = triggerNodes.map((t) => t.id);

  for (const tid of queue) {
    reachableNodes.add(tid);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = outgoingEdges.get(current) || [];
    for (const neighbor of neighbors) {
      if (!reachableNodes.has(neighbor)) {
        reachableNodes.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  for (const n of executableNodes) {
    if (!reachableNodes.has(n.id)) {
      addIssue('error', 'UNREACHABLE_NODE', 'Node is unreachable from any trigger.', n.id);
    }
  }

  // 5. Infinite Cycle Detection (Loops without an Ask/Wait node)
  const isInputOrBlockingNode = (nodeId: string) => {
    const n = nodeMap.get(nodeId);
    if (!n) return false;
    const t = n.data.nodeType;
    return t === 'input_ask' || t === 'message_menu' || t === 'logic_wait' || t === 'control_handoff' || t === 'control_end';
  };

  // Detect non-blocking cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const checkCycle = (currId: string, path: string[]) => {
    visited.add(currId);
    recursionStack.add(currId);

    const neighbors = outgoingEdges.get(currId) || [];
    for (const nextId of neighbors) {
      if (!visited.has(nextId)) {
        checkCycle(nextId, [...path, nextId]);
      } else if (recursionStack.has(nextId)) {
        // Found a cycle! Verify if cycle contains at least one user-input or wait node
        const cycleNodes = path.slice(path.indexOf(nextId));
        const hasBlocking = cycleNodes.some(isInputOrBlockingNode);
        if (!hasBlocking) {
          addIssue(
            'error',
            'INFINITE_LOOP',
            'Cycle detected without an Ask Question, Menu, or Wait node. This will cause an infinite loop and ban risk.',
            currId
          );
        }
      }
    }

    recursionStack.delete(currId);
  };

  for (const t of triggerNodes) {
    checkCycle(t.id, [t.id]);
  }

  // General warning if no human handoff path exists in the whole bot
  if (!hasHandoff && executableNodes.length > 3) {
    warnings.push({
      level: 'warning',
      code: 'NO_HANDOFF_PATH',
      message: 'Flow contains no Handoff to Human node; customers may get stuck without agent assistance.',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    nodeErrors,
  };
}

