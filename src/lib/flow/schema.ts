import { z } from 'zod';

// =========================================================
// NODE TYPES & CATEGORIES
// =========================================================

export const FlowNodeCategory = z.enum([
  'trigger',
  'message',
  'input',
  'logic',
  'ai',
  'integration',
  'control',
  'organization',
]);
export type FlowNodeCategoryType = z.infer<typeof FlowNodeCategory>;

export const FlowNodeType = z.enum([
  // Triggers
  'trigger_keyword',
  'trigger_first_message',
  'trigger_fallback',
  'trigger_campaign_reply',
  'trigger_webhook',

  // Messages
  'message_text',
  'message_media',
  'message_menu',

  // Input & Logic
  'input_ask',
  'logic_condition',
  'logic_business_hours',
  'logic_set_variable',
  'logic_random_split',
  'logic_wait',
  'logic_goto',

  // AI & Integrations
  'ai_reply',
  'ai_intent',
  'integration_http',
  'action_notify',
  'action_save_lead',

  // Control
  'control_handoff',
  'control_opt_out',
  'control_end',

  // Organization
  'note',
  'group',
]);
export type FlowNodeTypeKey = z.infer<typeof FlowNodeType>;

// =========================================================
// NODE DATA SCHEMAS
// =========================================================

export const MenuOptionSchema = z.object({
  id: z.string(),
  index: z.number().int().min(1),
  label: z.string().min(1),
  keywords: z.array(z.string()).default([]).optional(),
});
export type MenuOption = z.infer<typeof MenuOptionSchema>;

export const ConditionRuleSchema = z.object({
  variable: z.string().min(1),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'starts_with',
    'ends_with',
    'greater_than',
    'less_than',
    'is_empty',
    'is_not_empty',
    'matches_regex',
    'in_list',
  ]),
  value: z.string().default(''),
});
export type ConditionRule = z.infer<typeof ConditionRuleSchema>;

export const HttpResponseMappingSchema = z.object({
  jsonPath: z.string().min(1),
  variable: z.string().min(1),
});
export type HttpResponseMapping = z.infer<typeof HttpResponseMappingSchema>;

export const IntentOptionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
});
export type IntentOption = z.infer<typeof IntentOptionSchema>;

export const SplitBranchSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  weightPercent: z.number().min(1).max(100),
});
export type SplitBranch = z.infer<typeof SplitBranchSchema>;

// Generic Node Config Schema (Union-friendly map)
export const NodeConfigSchema = z.object({
  // Generic
  title: z.string().optional(),
  description: z.string().optional(),

  // Trigger Keyword
  keywords: z.array(z.string()).optional(),
  matchMode: z.enum(['exact', 'contains', 'starts_with', 'regex']).optional(),
  caseSensitive: z.boolean().optional(),

  // Trigger Campaign Reply
  campaignId: z.string().optional(),
  windowDays: z.number().int().min(1).max(90).optional(),

  // Trigger First Message
  daysWithoutConversation: z.number().int().min(0).max(365).optional(),

  // Send Text
  text: z.string().optional(),
  typingSimulation: z.boolean().optional(),

  // Send Media
  mediaType: z.enum(['image', 'video', 'document', 'audio']).optional(),
  mediaUrl: z.string().optional(),
  caption: z.string().optional(),
  fileName: z.string().optional(),

  // Menu
  menuTitle: z.string().optional(),
  menuOptions: z.array(MenuOptionSchema).optional(),
  invalidReplyText: z.string().optional(),
  maxRetries: z.number().int().min(1).max(10).optional(),

  // Ask Question
  questionText: z.string().optional(),
  variableName: z.string().optional(),
  validationType: z.enum(['text', 'number', 'email', 'phone', 'date', 'regex', 'choice']).optional(),
  regexPattern: z.string().optional(),
  choiceOptions: z.array(z.string()).optional(),
  retryMessage: z.string().optional(),
  timeoutMinutes: z.number().int().min(1).max(1440).optional(),

  // Condition
  conditionRules: z.array(ConditionRuleSchema).optional(),
  matchAll: z.boolean().optional(),

  // Business Hours
  timezone: z.string().optional(),
  daysOpen: z.array(z.number().int().min(0).max(6)).optional(), // 0 = Sun, 1 = Mon ...
  openTime: z.string().optional(), // "09:00"
  closeTime: z.string().optional(), // "18:00"
  holidays: z.array(z.string()).optional(), // "YYYY-MM-DD"

  // Set Variable / Contact
  variableAssignments: z.array(z.object({
    variable: z.string(),
    expression: z.string(),
  })).optional(),
  addTags: z.array(z.string()).optional(),
  removeTags: z.array(z.string()).optional(),
  setOptInStatus: z.boolean().optional(),

  // Random Split
  splitBranches: z.array(SplitBranchSchema).optional(),

  // Wait / Delay
  delaySeconds: z.number().int().min(1).max(86400).optional(),

  // Go To
  targetNodeId: z.string().optional(),

  // AI Reply
  systemPrompt: z.string().optional(),
  aiTone: z.enum(['professional', 'friendly', 'concise', 'enthusiastic', 'formal']).optional(),
  aiLanguage: z.string().optional(),
  maxAiTokens: z.number().int().min(50).max(2000).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  knowledgeBaseText: z.string().optional(),
  bannedTopics: z.string().optional(),

  // AI Intent
  intents: z.array(IntentOptionSchema).optional(),

  // HTTP Request
  httpMethod: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
  httpUrl: z.string().optional(),
  httpHeaders: z.record(z.string()).optional(),
  httpBody: z.string().optional(),
  httpTimeoutMs: z.number().int().min(1000).max(30000).optional(),
  httpResponseMapping: z.array(HttpResponseMappingSchema).optional(),

  // Notify Team
  notifyChannel: z.enum(['in_app', 'telegram', 'email', 'webhook']).optional(),
  notifyTarget: z.string().optional(),
  notifyMessage: z.string().optional(),

  // Save Lead
  leadListId: z.string().optional(),
  leadTags: z.array(z.string()).optional(),
  leadNameVar: z.string().optional(),
  leadPhoneVar: z.string().optional(),

  // Control Handoff
  handoffMessage: z.string().optional(),
  autoResumeHours: z.number().min(0).max(168).optional(),
  assignee: z.string().optional(),

  // Control Opt-Out
  optOutReason: z.string().optional(),
  optOutMessage: z.string().optional(),

  // Control End
  endReason: z.enum(['completed', 'abandoned', 'error']).optional(),
  endMessage: z.string().optional(),

  // Note & Group
  noteText: z.string().optional(),
  noteColor: z.string().optional(),
  groupLabel: z.string().optional(),
  groupWidth: z.number().optional(),
  groupHeight: z.number().optional(),
}).passthrough();

export type NodeConfig = z.infer<typeof NodeConfigSchema>;

// React Flow Canvas Node Data
export const FlowNodeDataSchema = z.object({
  label: z.string().default('New Node'),
  nodeType: FlowNodeType,
  config: NodeConfigSchema.default({}),
  isValid: z.boolean().default(true).optional(),
  validationErrors: z.array(z.string()).default([]).optional(),
  stats: z.object({
    visits: z.number().default(0),
    dropoffs: z.number().default(0),
    avgTimeMs: z.number().default(0),
  }).optional(),
}).passthrough();

export type FlowNodeData = z.infer<typeof FlowNodeDataSchema>;

export const FlowNodeSchema = z.object({
  id: z.string(),
  type: z.string().default('flowNode'),
  position: z.object({ x: z.number(), y: z.number() }),
  data: FlowNodeDataSchema,
  width: z.number().optional(),
  height: z.number().optional(),
});
export type FlowNode = z.infer<typeof FlowNodeSchema>;

export const FlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  label: z.string().optional(),
  animated: z.boolean().optional(),
  type: z.string().default('customEdge'),
  style: z.record(z.any()).optional(),
});
export type FlowEdge = z.infer<typeof FlowEdgeSchema>;

export const FlowDefinitionSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  nodes: z.array(FlowNodeSchema),
  edges: z.array(FlowEdgeSchema),
  viewport: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    zoom: z.number().default(1),
  }).default({ x: 0, y: 0, zoom: 1 }),
  metadata: z.object({
    name: z.string().default('Untitled Bot'),
    description: z.string().default(''),
    category: z.string().default('general'),
    version: z.number().default(1),
  }).default({ name: 'Untitled Bot', description: '', category: 'general', version: 1 }),
});
export type FlowDefinition = z.infer<typeof FlowDefinitionSchema>;

// =========================================================
// RUNTIME ENGINE ACTION & SESSION SCHEMAS
// =========================================================

export const EngineActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('send_text'),
    text: z.string(),
    typingDelayMs: z.number().default(0),
  }),
  z.object({
    type: z.literal('send_media'),
    mediaType: z.enum(['image', 'video', 'document', 'audio']),
    mediaUrl: z.string(),
    caption: z.string().optional(),
    fileName: z.string().optional(),
  }),
  z.object({
    type: z.literal('set_timer'),
    timerKey: z.string(),
    delaySeconds: z.number(),
    resumeNodeId: z.string(),
  }),
  z.object({
    type: z.literal('call_http'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
    url: z.string(),
    headers: z.record(z.string()),
    body: z.string().optional(),
    responseMapping: z.array(HttpResponseMappingSchema).optional(),
    successNodeId: z.string().optional(),
    failureNodeId: z.string().optional(),
  }),
  z.object({
    type: z.literal('call_ai'),
    prompt: z.string(),
    systemPrompt: z.string(),
    knowledgeSource: z.string().optional(),
    maxTokens: z.number(),
    confidenceThreshold: z.number(),
    answerNodeId: z.string().optional(),
    fallbackNodeId: z.string().optional(),
  }),
  z.object({
    type: z.literal('handoff'),
    message: z.string().optional(),
    autoResumeHours: z.number().optional(),
    assignee: z.string().optional(),
  }),
  z.object({
    type: z.literal('notify'),
    channel: z.enum(['in_app', 'telegram', 'email', 'webhook']),
    target: z.string().optional(),
    message: z.string(),
  }),
  z.object({
    type: z.literal('save_lead'),
    listId: z.string().optional(),
    tags: z.array(z.string()).default([]),
    name: z.string().optional(),
    phone: z.string().optional(),
  }),
  z.object({
    type: z.literal('opt_out'),
    reason: z.string().optional(),
    confirmationText: z.string().optional(),
  }),
  z.object({
    type: z.literal('end'),
    reason: z.enum(['completed', 'abandoned', 'error']),
    message: z.string().optional(),
  }),
]);
export type EngineAction = z.infer<typeof EngineActionSchema>;

export const EngineSessionSchema = z.object({
  id: z.string(),
  flowId: z.string(),
  versionId: z.string().nullable().optional(),
  instanceId: z.string(),
  contactId: z.string().nullable().optional(),
  phone: z.string(),
  status: z.enum(['active', 'waiting', 'handoff', 'completed', 'expired', 'error']),
  currentNodeId: z.string().nullable().optional(),
  vars: z.record(z.any()).default({}),
  stepSeq: z.number().default(0),
  retryCount: z.number().default(0),
  startedAt: z.string().or(z.date()),
  lastInboundAt: z.string().or(z.date()),
  lastOutboundAt: z.string().or(z.date()).nullable().optional(),
  expiresAt: z.string().or(z.date()).nullable().optional(),
  endReason: z.string().nullable().optional(),
});
export type EngineSession = z.infer<typeof EngineSessionSchema>;

export const InboundEventSchema = z.object({
  messageId: z.string(),
  instanceId: z.string(),
  phone: z.string(),
  pushName: z.string().nullable().optional(),
  text: z.string().default(''),
  mediaType: z.string().optional(),
  timestamp: z.number().default(Date.now()),
});
export type InboundEvent = z.infer<typeof InboundEventSchema>;
