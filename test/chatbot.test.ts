import { describe, it, expect } from 'vitest';
import { validateFlow } from '@/lib/flow/validate';
import { step } from '@/lib/flow/engine';
import {
  renderTemplateText,
  evaluateConditionRule,
  validateUserInput,
} from '@/lib/flow/expressions';
import { FlowDefinition, EngineSession } from '@/lib/flow/schema';
import { PREBUILT_TEMPLATES } from '@/lib/flow/templates';

describe('Chatbot Studio: Flow Validator', () => {
  it('detects missing trigger error', () => {
    const invalidFlow: FlowDefinition = {
      schemaVersion: 1,
      metadata: { name: 'No Trigger', description: '', category: 'general', version: 1 },
      nodes: [
        {
          id: 'n1',
          type: 'flowNode',
          position: { x: 0, y: 0 },
          data: { label: 'Text', nodeType: 'message_text', config: { text: 'Hi' } },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const res = validateFlow(invalidFlow);
    expect(res.isValid).toBe(false);
    expect(res.errors.some((e) => e.code === 'NO_TRIGGER')).toBe(true);
  });

  it('detects unreachable nodes in flow', () => {
    const flow: FlowDefinition = {
      schemaVersion: 1,
      metadata: { name: 'Unreachable', description: '', category: 'general', version: 1 },
      nodes: [
        {
          id: 't1',
          type: 'flowNode',
          position: { x: 0, y: 0 },
          data: { label: 'Trigger', nodeType: 'trigger_keyword', config: { keywords: ['hi'] } },
        },
        {
          id: 'm1',
          type: 'flowNode',
          position: { x: 0, y: 100 },
          data: { label: 'Msg', nodeType: 'message_text', config: { text: 'Welcome' } },
        },
        {
          id: 'isolated',
          type: 'flowNode',
          position: { x: 200, y: 200 },
          data: { label: 'Isolated', nodeType: 'message_text', config: { text: 'Ghost node' } },
        },
      ],
      edges: [{ id: 'e1', source: 't1', target: 'm1', type: 'customEdge' }],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const res = validateFlow(flow);
    expect(res.errors.some((e) => e.code === 'UNREACHABLE_NODE' && e.nodeId === 'isolated')).toBe(true);
  });

  it('validates all prebuilt templates cleanly', () => {
    for (const tpl of PREBUILT_TEMPLATES) {
      const res = validateFlow(tpl.flow);
      expect(res.errors.length, `Template ${tpl.name} had validation errors: ${JSON.stringify(res.errors)}`).toBe(0);
    }
  });
});

describe('Chatbot Studio: Expressions & Input Validator', () => {
  it('interpolates variables and fallback values', () => {
    const ctx = {
      session: { order_id: 'ORD-991', first_name: 'Aarav' },
      contact: { phone: '919876543210' },
    };

    const text1 = 'Hello {{first_name}}, your order {{order_id}} is ready!';
    expect(renderTemplateText(text1, ctx)).toBe('Hello Aarav, your order ORD-991 is ready!');

    const text2 = 'Welcome {{unknown_var|Valued Customer}}!';
    expect(renderTemplateText(text2, ctx)).toBe('Welcome Valued Customer!');
  });

  it('evaluates condition rules safely', () => {
    const ctx = {
      session: { score: '85', status: 'PAID', city: 'Mumbai' },
    };

    expect(evaluateConditionRule({ variable: 'status', operator: 'equals', value: 'paid' }, ctx)).toBe(true);
    expect(evaluateConditionRule({ variable: 'status', operator: 'equals', value: 'unpaid' }, ctx)).toBe(false);
    expect(evaluateConditionRule({ variable: 'city', operator: 'contains', value: 'mumb' }, ctx)).toBe(true);
    expect(evaluateConditionRule({ variable: 'score', operator: 'greater_than', value: '50' }, ctx)).toBe(true);
  });

  it('validates user input types (email, number, phone, choices)', () => {
    expect(validateUserInput('test@example.com', 'email').isValid).toBe(true);
    expect(validateUserInput('not-an-email', 'email').isValid).toBe(false);

    expect(validateUserInput('4200', 'number').isValid).toBe(true);
    expect(validateUserInput('abc', 'number').isValid).toBe(false);

    expect(validateUserInput('+919876543210', 'phone').isValid).toBe(true);
    expect(validateUserInput('123', 'phone').isValid).toBe(false);

    const choices = ['Yes', 'No', 'Maybe'];
    expect(validateUserInput('yes', 'choice', { choiceOptions: choices }).isValid).toBe(true);
    expect(validateUserInput('1', 'choice', { choiceOptions: choices }).isValid).toBe(true);
    expect(validateUserInput('never', 'choice', { choiceOptions: choices }).isValid).toBe(false);
  });
});

describe('Chatbot Studio: Pure Step Engine', () => {
  const sampleFlow: FlowDefinition = {
    schemaVersion: 1,
    metadata: { name: 'Test Bot', description: '', category: 'general', version: 1 },
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      {
        id: 'trigger',
        type: 'flowNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'Trigger',
          nodeType: 'trigger_keyword',
          config: { keywords: ['hi', 'hello'], matchMode: 'contains' },
        },
      },
      {
        id: 'msg_welcome',
        type: 'flowNode',
        position: { x: 0, y: 100 },
        data: {
          label: 'Welcome',
          nodeType: 'message_text',
          config: { text: 'Hello from Bot!' },
        },
      },
      {
        id: 'ask_name',
        type: 'flowNode',
        position: { x: 0, y: 200 },
        data: {
          label: 'Ask Name',
          nodeType: 'input_ask',
          config: { questionText: 'What is your name?', variableName: 'user_name' },
        },
      },
      {
        id: 'confirm',
        type: 'flowNode',
        position: { x: 0, y: 300 },
        data: {
          label: 'Confirm',
          nodeType: 'message_text',
          config: { text: 'Nice to meet you, {{user_name}}!' },
        },
      },
      {
        id: 'end',
        type: 'flowNode',
        position: { x: 0, y: 400 },
        data: {
          label: 'End',
          nodeType: 'control_end',
          config: { endReason: 'completed' },
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'msg_welcome', type: 'customEdge' },
      { id: 'e2', source: 'msg_welcome', target: 'ask_name', type: 'customEdge' },
      { id: 'e3', source: 'ask_name', target: 'confirm', type: 'customEdge' },
      { id: 'e4', source: 'confirm', target: 'end', type: 'customEdge' },
    ],
  };

  it('runs initial trigger step and pauses at Ask Question node', () => {
    const initialSession: EngineSession = {
      id: 'sess_1',
      flowId: 'test_flow',
      instanceId: 'inst_1',
      phone: '919876543210',
      status: 'active',
      currentNodeId: null,
      vars: {},
      stepSeq: 0,
      retryCount: 0,
      startedAt: new Date().toISOString(),
      lastInboundAt: new Date().toISOString(),
    };

    const res = step(initialSession, sampleFlow, {
      messageId: 'm1',
      instanceId: 'inst_1',
      phone: '919876543210',
      text: 'hello',
      timestamp: Date.now(),
    });

    expect(res.actions.length).toBe(2); // send welcome text + ask name text
    expect(res.actions[0].type).toBe('send_text');
    expect((res.actions[0] as any).text).toBe('Hello from Bot!');
    expect((res.actions[1] as any).text).toBe('What is your name?');
    expect(res.session.status).toBe('waiting');
    expect(res.session.currentNodeId).toBe('ask_name');
  });

  it('captures user answer and advances to End node', () => {
    const waitingSession: EngineSession = {
      id: 'sess_1',
      flowId: 'test_flow',
      instanceId: 'inst_1',
      phone: '919876543210',
      status: 'waiting',
      currentNodeId: 'ask_name',
      vars: {},
      stepSeq: 2,
      retryCount: 0,
      startedAt: new Date().toISOString(),
      lastInboundAt: new Date().toISOString(),
    };

    const res = step(waitingSession, sampleFlow, {
      messageId: 'm2',
      instanceId: 'inst_1',
      phone: '919876543210',
      text: 'Vikram',
      timestamp: Date.now(),
    });

    expect(res.session.vars.user_name).toBe('Vikram');
    expect(res.actions.some((a) => a.type === 'send_text' && (a as any).text === 'Nice to meet you, Vikram!')).toBe(true);
    expect(res.session.status).toBe('completed');
  });
});
