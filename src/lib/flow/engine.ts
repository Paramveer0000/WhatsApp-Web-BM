import {
  FlowDefinition,
  FlowNode,
  FlowEdge,
  EngineSession,
  InboundEvent,
  EngineAction,
} from './schema';
import {
  renderTemplateText,
  evaluateConditionRule,
  validateUserInput,
  ExpressionContext,
} from './expressions';

export interface StepResult {
  session: EngineSession;
  actions: EngineAction[];
  logs: Array<{
    nodeId: string;
    nodeType: string;
    summary: string;
    vars?: Record<string, any>;
  }>;
  haltReason?: 'waiting_for_input' | 'completed' | 'handoff' | 'opt_out' | 'error' | 'max_steps';
}

const MAX_STEPS_PER_EVENT = 50;

/**
 * Pure state transition engine for executing visual WhatsApp chatbot flows.
 * Identical behavior in test simulator (dryRun) and production worker runtime.
 */
export function step(
  session: EngineSession,
  flow: FlowDefinition,
  inbound?: InboundEvent
): StepResult {
  const actions: EngineAction[] = [];
  const logs: StepResult['logs'] = [];
  let currentSession = { ...session, vars: { ...session.vars } };

  const nodeMap = new Map<string, FlowNode>();
  for (const n of flow.nodes) {
    nodeMap.set(n.id, n);
  }

  const outgoingEdges = new Map<string, FlowEdge[]>();
  for (const e of flow.edges) {
    if (!outgoingEdges.has(e.source)) outgoingEdges.set(e.source, []);
    outgoingEdges.get(e.source)!.push(e);
  }

  // 1. Determine Starting Node
  let currentNodeId: string | null = currentSession.currentNodeId || null;

  // If new session without a currentNodeId, find entry Trigger node
  if (!currentNodeId) {
    // Try to find matching keyword trigger, first message, or fallback trigger
    const triggers = flow.nodes.filter((n) => n.data.nodeType.startsWith('trigger_'));
    let matchedTrigger: FlowNode | null = null;

    if (inbound?.text) {
      const normalizedInbound = inbound.text.trim().toLowerCase();
      // A. Keyword triggers
      matchedTrigger = triggers.find((t) => {
        if (t.data.nodeType !== 'trigger_keyword') return false;
        const kws = t.data.config.keywords || [];
        const mode = t.data.config.matchMode || 'contains';
        return kws.some((kw) => {
          const target = kw.trim().toLowerCase();
          if (mode === 'exact') return normalizedInbound === target;
          if (mode === 'starts_with') return normalizedInbound.startsWith(target);
          if (mode === 'regex') {
            try {
              return new RegExp(target, 'i').test(normalizedInbound);
            } catch {
              return false;
            }
          }
          return normalizedInbound.includes(target);
        });
      }) || null;
    }

    // B. Campaign Reply Trigger
    if (!matchedTrigger) {
      matchedTrigger = triggers.find((t) => t.data.nodeType === 'trigger_campaign_reply') || null;
    }

    // C. First Message Trigger
    if (!matchedTrigger) {
      matchedTrigger = triggers.find((t) => t.data.nodeType === 'trigger_first_message') || null;
    }

    // D. Fallback Trigger
    if (!matchedTrigger) {
      matchedTrigger = triggers.find((t) => t.data.nodeType === 'trigger_fallback') || triggers[0] || null;
    }

    if (matchedTrigger) {
      currentNodeId = matchedTrigger.id;
    } else {
      return {
        session: currentSession,
        actions,
        logs: [{ nodeId: 'root', nodeType: 'none', summary: 'No entry trigger found for flow' }],
        haltReason: 'completed',
      };
    }
  }

  let stepsTaken = 0;
  let waitingForInput = false;

  while (currentNodeId && stepsTaken < MAX_STEPS_PER_EVENT) {
    stepsTaken++;
    currentSession.stepSeq += 1;
    const currentNode = nodeMap.get(currentNodeId);

    if (!currentNode) {
      logs.push({ nodeId: currentNodeId, nodeType: 'unknown', summary: `Node ${currentNodeId} not found in flow` });
      break;
    }

    const { nodeType, config } = currentNode.data;
    const context: ExpressionContext = {
      session: currentSession.vars,
      message: inbound ? { text: inbound.text, phone: inbound.phone, timestamp: inbound.timestamp } : {},
      contact: { phone: currentSession.phone },
      bot: { name: flow.metadata.name },
      system: {
        now: new Date().toISOString(),
        weekday: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        timezone: config.timezone || 'Asia/Kolkata',
      },
    };

    let nextNodeId: string | null = null;
    const nodeEdges = outgoingEdges.get(currentNode.id) || [];

    // =========================================================
    // EXECUTE NODE LOGIC
    // =========================================================

    // --- TRIGGER NODES ---
    if (nodeType.startsWith('trigger_')) {
      logs.push({ nodeId: currentNode.id, nodeType, summary: `Triggered flow at ${currentNode.data.label}` });
      nextNodeId = nodeEdges[0]?.target || null;
    }

    // --- SEND TEXT ---
    else if (nodeType === 'message_text') {
      const rawText = config.text || '';
      const rendered = renderTemplateText(rawText, context);
      const typingMs = config.typingSimulation ? Math.min(4000, Math.max(1000, rendered.length * 30)) : 0;

      actions.push({
        type: 'send_text',
        text: rendered,
        typingDelayMs: typingMs,
      });

      logs.push({
        nodeId: currentNode.id,
        nodeType,
        summary: `Sent text: "${rendered.slice(0, 40)}${rendered.length > 40 ? '...' : ''}"`,
      });

      nextNodeId = nodeEdges[0]?.target || null;
    }

    // --- SEND MEDIA ---
    else if (nodeType === 'message_media') {
      actions.push({
        type: 'send_media',
        mediaType: config.mediaType || 'image',
        mediaUrl: renderTemplateText(config.mediaUrl || '', context),
        caption: renderTemplateText(config.caption || '', context),
        fileName: config.fileName,
      });

      logs.push({ nodeId: currentNode.id, nodeType, summary: `Sent ${config.mediaType} media` });
      nextNodeId = nodeEdges[0]?.target || null;
    }

    // --- NUMBERED MENU ---
    else if (nodeType === 'message_menu') {
      const options = config.menuOptions || [];

      // If we don't have user input yet, output the numbered menu text and WAIT for user reply
      if (!inbound || currentSession.status !== 'waiting') {
        let menuMsg = config.menuTitle ? `${renderTemplateText(config.menuTitle, context)}\n\n` : '';
        options.forEach((opt, idx) => {
          menuMsg += `*${opt.index || idx + 1}.* ${opt.label}\n`;
        });
        menuMsg += `\n_Reply with a number (1-${options.length})_`;

        actions.push({
          type: 'send_text',
          text: menuMsg.trim(),
          typingDelayMs: 800,
        });

        currentSession.status = 'waiting';
        currentSession.currentNodeId = currentNode.id;
        currentSession.retryCount = 0;
        waitingForInput = true;

        logs.push({ nodeId: currentNode.id, nodeType, summary: 'Presented menu; waiting for user choice' });
        break;
      }

      // We HAVE user input; evaluate user choice
      const userInput = (inbound.text || '').trim();
      let matchedOption: typeof options[0] | null = null;

      // 1. Match by exact number ("1", "2")
      const parsedNum = parseInt(userInput, 10);
      if (!isNaN(parsedNum)) {
        matchedOption = options.find((o, idx) => (o.index || idx + 1) === parsedNum) || null;
      }

      // 2. Match by keywords or label
      if (!matchedOption) {
        const lower = userInput.toLowerCase();
        matchedOption = options.find((o) => {
          if (o.label.toLowerCase() === lower || o.label.toLowerCase().includes(lower)) return true;
          return o.keywords?.some((k) => lower.includes(k.toLowerCase()));
        }) || null;
      }

      if (matchedOption) {
        currentSession.vars['last_menu_choice'] = matchedOption.label;
        currentSession.vars['last_menu_index'] = matchedOption.index;
        currentSession.status = 'active';
        currentSession.retryCount = 0;

        // Find edge connected to this option's handle or edge by index
        const optionEdge = nodeEdges.find((e) => e.sourceHandle === matchedOption!.id || e.sourceHandle === `opt_${matchedOption!.id}`) ||
          nodeEdges[options.indexOf(matchedOption)] ||
          nodeEdges[0];

        nextNodeId = optionEdge?.target || null;
        logs.push({
          nodeId: currentNode.id,
          nodeType,
          summary: `User selected option "${matchedOption.label}" (${matchedOption.index})`,
          vars: { last_menu_choice: matchedOption.label },
        });
      } else {
        // Invalid reply
        const retries = currentSession.retryCount || 0;
        const maxRetries = config.maxRetries || 3;

        if (retries + 1 >= maxRetries) {
          // Exceeded max retries -> route to fallback handle or handoff
          const fallbackEdge = nodeEdges.find((e) => e.sourceHandle === 'invalid_fallback' || e.sourceHandle === 'fallback');
          if (fallbackEdge) {
            nextNodeId = fallbackEdge.target;
            currentSession.status = 'active';
            logs.push({ nodeId: currentNode.id, nodeType, summary: 'Max menu retries reached; routing to fallback branch' });
          } else {
            actions.push({
              type: 'handoff',
              message: 'Connecting you with an agent...',
            });
            currentSession.status = 'handoff';
            logs.push({ nodeId: currentNode.id, nodeType, summary: 'Max menu retries reached without fallback edge; handoff initiated' });
            break;
          }
        } else {
          currentSession.retryCount = retries + 1;
          const retryMsg = config.invalidReplyText || `Please reply with a valid number between 1 and ${options.length}.`;
          actions.push({
            type: 'send_text',
            text: renderTemplateText(retryMsg, context),
            typingDelayMs: 600,
          });
          currentSession.status = 'waiting';
          currentSession.currentNodeId = currentNode.id;
          waitingForInput = true;
          logs.push({ nodeId: currentNode.id, nodeType, summary: `Invalid menu reply ("${userInput}"); prompt retry (${currentSession.retryCount}/${maxRetries})` });
          break;
        }
      }
    }

    // --- ASK QUESTION ---
    else if (nodeType === 'input_ask') {
      const varName = config.variableName || 'user_answer';

      // If we don't have user input yet, ask the question and wait
      if (!inbound || currentSession.status !== 'waiting') {
        const prompt = renderTemplateText(config.questionText || '', context);
        actions.push({
          type: 'send_text',
          text: prompt,
          typingDelayMs: 800,
        });

        currentSession.status = 'waiting';
        currentSession.currentNodeId = currentNode.id;
        currentSession.retryCount = 0;
        waitingForInput = true;

        logs.push({ nodeId: currentNode.id, nodeType, summary: `Asked: "${prompt.slice(0, 30)}..."; waiting for reply` });
        break;
      }

      // We HAVE user input; validate
      const userInput = inbound.text || '';
      const validation = validateUserInput(userInput, config.validationType, {
        regexPattern: config.regexPattern,
        choiceOptions: config.choiceOptions,
      });

      if (validation.isValid) {
        currentSession.vars[varName] = validation.parsedValue;
        currentSession.status = 'active';
        currentSession.retryCount = 0;
        nextNodeId = nodeEdges[0]?.target || null;

        logs.push({
          nodeId: currentNode.id,
          nodeType,
          summary: `Captured valid input for {{${varName}}}: "${validation.parsedValue}"`,
          vars: { [varName]: validation.parsedValue },
        });
      } else {
        const retries = currentSession.retryCount || 0;
        const maxRetries = config.maxRetries || 3;

        if (retries + 1 >= maxRetries) {
          const timeoutEdge = nodeEdges.find((e) => e.sourceHandle === 'timeout' || e.sourceHandle === 'fallback');
          if (timeoutEdge) {
            nextNodeId = timeoutEdge.target;
            currentSession.status = 'active';
            logs.push({ nodeId: currentNode.id, nodeType, summary: 'Max question retries reached; branching to fallback' });
          } else {
            actions.push({
              type: 'handoff',
              message: 'Connecting with an agent to assist you...',
            });
            currentSession.status = 'handoff';
            logs.push({ nodeId: currentNode.id, nodeType, summary: 'Max question retries reached; handoff initiated' });
            break;
          }
        } else {
          currentSession.retryCount = retries + 1;
          const retryMsg = config.retryMessage || validation.error || 'Please provide a valid answer.';
          actions.push({
            type: 'send_text',
            text: renderTemplateText(retryMsg, context),
            typingDelayMs: 600,
          });
          currentSession.status = 'waiting';
          currentSession.currentNodeId = currentNode.id;
          waitingForInput = true;
          logs.push({ nodeId: currentNode.id, nodeType, summary: `Input validation failed: ${validation.error}. Retrying (${currentSession.retryCount}/${maxRetries})` });
          break;
        }
      }
    }

    // --- CONDITION (IF / ELSE) ---
    else if (nodeType === 'logic_condition') {
      const rules = config.conditionRules || [];
      const matchAll = config.matchAll !== false;

      let passes = false;
      if (rules.length > 0) {
        if (matchAll) {
          passes = rules.every((r) => evaluateConditionRule(r, context));
        } else {
          passes = rules.some((r) => evaluateConditionRule(r, context));
        }
      }

      const trueEdge = nodeEdges.find((e) => e.sourceHandle === 'true' || e.label?.toLowerCase() === 'true' || e.label?.toLowerCase() === 'yes') || nodeEdges[0];
      const falseEdge = nodeEdges.find((e) => e.sourceHandle === 'false' || e.label?.toLowerCase() === 'false' || e.label?.toLowerCase() === 'no') || nodeEdges[1];

      nextNodeId = passes ? (trueEdge?.target || null) : (falseEdge?.target || null);
      logs.push({
        nodeId: currentNode.id,
        nodeType,
        summary: `Condition evaluated to ${passes ? 'TRUE' : 'FALSE'}`,
      });
    }

    // --- BUSINESS HOURS ---
    else if (nodeType === 'logic_business_hours') {
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sun, 1 = Mon ...
      const daysOpen = config.daysOpen || [1, 2, 3, 4, 5]; // Mon-Fri default

      const [openHour = 9, openMin = 0] = (config.openTime || '09:00').split(':').map(Number);
      const [closeHour = 18, closeMin = 0] = (config.closeTime || '18:00').split(':').map(Number);

      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const openMinutes = openHour * 60 + openMin;
      const closeMinutes = closeHour * 60 + closeMin;

      const isTodayOpen = daysOpen.includes(currentDay);
      const isWithinHours = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
      const isOpen = isTodayOpen && isWithinHours;

      const openEdge = nodeEdges.find((e) => e.sourceHandle === 'open' || e.label?.toLowerCase() === 'open') || nodeEdges[0];
      const closedEdge = nodeEdges.find((e) => e.sourceHandle === 'closed' || e.label?.toLowerCase() === 'closed') || nodeEdges[1];

      nextNodeId = isOpen ? (openEdge?.target || null) : (closedEdge?.target || null);
      logs.push({
        nodeId: currentNode.id,
        nodeType,
        summary: `Business hours check: ${isOpen ? 'OPEN' : 'CLOSED'}`,
      });
    }

    // --- SET VARIABLE / UPDATE CONTACT ---
    else if (nodeType === 'logic_set_variable') {
      const assignments = config.variableAssignments || [];
      for (const a of assignments) {
        if (a.variable) {
          const renderedVal = renderTemplateText(a.expression, context);
          currentSession.vars[a.variable] = renderedVal;
        }
      }

      if (config.addTags && config.addTags.length > 0) {
        const existingTags: string[] = currentSession.vars['tags'] || [];
        currentSession.vars['tags'] = Array.from(new Set([...existingTags, ...config.addTags]));
      }

      logs.push({
        nodeId: currentNode.id,
        nodeType,
        summary: `Updated session variables: ${assignments.map((a) => a.variable).join(', ')}`,
        vars: currentSession.vars,
      });

      nextNodeId = nodeEdges[0]?.target || null;
    }

    // --- RANDOM SPLIT / A-B ---
    else if (nodeType === 'logic_random_split') {
      const branches = config.splitBranches || [{ id: 'a', label: 'Branch A', weightPercent: 50 }, { id: 'b', label: 'Branch B', weightPercent: 50 }];
      const totalWeight = branches.reduce((sum, b) => sum + (b.weightPercent || 50), 0);
      let rand = Math.random() * totalWeight;
      let chosenBranch = branches[0];

      for (const b of branches) {
        if (rand < (b.weightPercent || 50)) {
          chosenBranch = b;
          break;
        }
        rand -= (b.weightPercent || 50);
      }

      const branchEdge = nodeEdges.find((e) => e.sourceHandle === chosenBranch.id) || nodeEdges[branches.indexOf(chosenBranch)] || nodeEdges[0];
      nextNodeId = branchEdge?.target || null;
      logs.push({ nodeId: currentNode.id, nodeType, summary: `Random split selected "${chosenBranch.label}"` });
    }

    // --- GO TO ---
    else if (nodeType === 'logic_goto') {
      if (config.targetNodeId && nodeMap.has(config.targetNodeId)) {
        nextNodeId = config.targetNodeId;
        logs.push({ nodeId: currentNode.id, nodeType, summary: `Jumped to node ${config.targetNodeId}` });
      } else {
        nextNodeId = nodeEdges[0]?.target || null;
      }
    }

    // --- WAIT / DELAY ---
    else if (nodeType === 'logic_wait') {
      const delaySec = config.delaySeconds || 5;
      const nextEdge = nodeEdges[0];

      if (nextEdge) {
        actions.push({
          type: 'set_timer',
          timerKey: `${currentSession.id}:${currentSession.stepSeq}:${currentNode.id}`,
          delaySeconds: delaySec,
          resumeNodeId: nextEdge.target,
        });

        currentSession.currentNodeId = nextEdge.target;
        currentSession.status = 'waiting';
        waitingForInput = true;
        logs.push({ nodeId: currentNode.id, nodeType, summary: `Scheduled delay timer: ${delaySec}s` });
        break;
      }
    }

    // --- AI REPLY ---
    else if (nodeType === 'ai_reply') {
      actions.push({
        type: 'call_ai',
        prompt: inbound?.text || '',
        systemPrompt: renderTemplateText(config.systemPrompt || 'You are a helpful customer assistant.', context),
        knowledgeSource: config.knowledgeBaseText,
        maxTokens: config.maxAiTokens || 350,
        confidenceThreshold: config.confidenceThreshold || 0.7,
        answerNodeId: nodeEdges[0]?.target,
        fallbackNodeId: nodeEdges.find((e) => e.sourceHandle === 'fallback')?.target,
      });

      logs.push({ nodeId: currentNode.id, nodeType, summary: 'Dispatched AI response task' });
      // In dryRun/sim, simulator handles the response
      nextNodeId = nodeEdges[0]?.target || null;
      break;
    }

    // --- HTTP REQUEST ---
    else if (nodeType === 'integration_http') {
      actions.push({
        type: 'call_http',
        method: config.httpMethod || 'POST',
        url: renderTemplateText(config.httpUrl || '', context),
        headers: config.httpHeaders || {},
        body: config.httpBody ? renderTemplateText(config.httpBody, context) : undefined,
        responseMapping: config.httpResponseMapping,
        successNodeId: nodeEdges[0]?.target,
        failureNodeId: nodeEdges.find((e) => e.sourceHandle === 'failure')?.target,
      });

      logs.push({ nodeId: currentNode.id, nodeType, summary: `Invoked HTTP ${config.httpMethod || 'POST'} request` });
      nextNodeId = nodeEdges[0]?.target || null;
      break;
    }

    // --- NOTIFY TEAM ---
    else if (nodeType === 'action_notify') {
      actions.push({
        type: 'notify',
        channel: config.notifyChannel || 'in_app',
        target: config.notifyTarget,
        message: renderTemplateText(config.notifyMessage || 'Alert: Bot action triggered', context),
      });

      logs.push({ nodeId: currentNode.id, nodeType, summary: `Dispatched team notification via ${config.notifyChannel}` });
      nextNodeId = nodeEdges[0]?.target || null;
    }

    // --- SAVE LEAD ---
    else if (nodeType === 'action_save_lead') {
      const name = config.leadNameVar ? currentSession.vars[config.leadNameVar] : currentSession.vars['name'];
      const phone = config.leadPhoneVar ? currentSession.vars[config.leadPhoneVar] : currentSession.phone;

      actions.push({
        type: 'save_lead',
        listId: config.leadListId,
        tags: config.leadTags || ['bot-lead'],
        name,
        phone,
      });

      logs.push({ nodeId: currentNode.id, nodeType, summary: `Saved contact lead (${name || phone})` });
      nextNodeId = nodeEdges[0]?.target || null;
    }

    // --- HANDOFF TO HUMAN ---
    else if (nodeType === 'control_handoff') {
      const handoffMsg = config.handoffMessage ? renderTemplateText(config.handoffMessage, context) : 'An agent has been notified and will assist you shortly.';
      actions.push({
        type: 'handoff',
        message: handoffMsg,
        autoResumeHours: config.autoResumeHours,
        assignee: config.assignee,
      });

      currentSession.status = 'handoff';
      currentSession.endReason = 'handoff';
      logs.push({ nodeId: currentNode.id, nodeType, summary: 'Bot paused; conversation handed off to human agent' });
      break;
    }

    // --- OPT OUT ---
    else if (nodeType === 'control_opt_out') {
      actions.push({
        type: 'opt_out',
        reason: config.optOutReason || 'User requested opt-out via bot flow',
        confirmationText: config.optOutMessage ? renderTemplateText(config.optOutMessage, context) : 'You have been unsubscribed.',
      });

      currentSession.status = 'completed';
      currentSession.endReason = 'opt_out';
      logs.push({ nodeId: currentNode.id, nodeType, summary: 'Contact unsubscribed and added to blacklist' });
      break;
    }

    // --- END ---
    else if (nodeType === 'control_end') {
      if (config.endMessage) {
        actions.push({
          type: 'send_text',
          text: renderTemplateText(config.endMessage, context),
          typingDelayMs: 0,
        });
      }

      actions.push({
        type: 'end',
        reason: config.endReason || 'completed',
      });

      currentSession.status = 'completed';
      currentSession.endReason = config.endReason || 'completed';
      logs.push({ nodeId: currentNode.id, nodeType, summary: `Session completed (${currentSession.endReason})` });
      break;
    }

    // Advance to next node
    currentNodeId = nextNodeId;
    currentSession.currentNodeId = nextNodeId;
  }

  const haltReason: StepResult['haltReason'] =
    currentSession.status === 'completed'
      ? 'completed'
      : currentSession.status === 'handoff'
      ? 'handoff'
      : waitingForInput
      ? 'waiting_for_input'
      : stepsTaken >= MAX_STEPS_PER_EVENT
      ? 'max_steps'
      : undefined;

  return {
    session: currentSession,
    actions,
    logs,
    haltReason,
  };
}
