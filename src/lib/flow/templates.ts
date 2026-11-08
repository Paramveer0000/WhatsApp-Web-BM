import { FlowDefinition } from './schema';

export interface PrebuiltTemplate {
  key: string;
  name: string;
  description: string;
  category: 'lead_gen' | 'support' | 'sales' | 'utility';
  flow: FlowDefinition;
}

export const PREBUILT_TEMPLATES: PrebuiltTemplate[] = [
  // 1. LEAD CAPTURE
  {
    key: 'lead_capture',
    name: 'Lead Capture & Qualification',
    description: 'Ask for customer name, phone/email, and requirements, then save lead and alert your team.',
    category: 'lead_gen',
    flow: {
      schemaVersion: 1,
      metadata: {
        name: 'Lead Capture Bot',
        description: 'Qualify inbound inquiries and collect contact details',
        category: 'lead_gen',
        version: 1,
      },
      viewport: { x: 50, y: 50, zoom: 0.9 },
      nodes: [
        {
          id: 'n1',
          type: 'flowNode',
          position: { x: 100, y: 100 },
          data: {
            label: 'Keyword Trigger',
            nodeType: 'trigger_keyword',
            config: {
              title: 'Entry Keywords',
              keywords: ['hi', 'hello', 'interested', 'info', 'inquiry', 'namaste'],
              matchMode: 'contains',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n2',
          type: 'flowNode',
          position: { x: 100, y: 250 },
          data: {
            label: 'Welcome Greeting',
            nodeType: 'message_text',
            config: {
              text: '{Namaste|Hello|Welcome}! Thanks for reaching out to us. We would love to help you today.',
              typingSimulation: true,
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n3',
          type: 'flowNode',
          position: { x: 100, y: 400 },
          data: {
            label: 'Ask Full Name',
            nodeType: 'input_ask',
            config: {
              questionText: 'May I know your full name?',
              variableName: 'name',
              validationType: 'text',
              retryMessage: 'Please type your name so our team knows how to address you.',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n4',
          type: 'flowNode',
          position: { x: 100, y: 580 },
          data: {
            label: 'Ask Requirement',
            nodeType: 'input_ask',
            config: {
              questionText: 'Nice to meet you, {{name}}! What product or service are you looking for?',
              variableName: 'requirement',
              validationType: 'text',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n5',
          type: 'flowNode',
          position: { x: 100, y: 760 },
          data: {
            label: 'Save Lead & Tag',
            nodeType: 'action_save_lead',
            config: {
              leadNameVar: 'name',
              leadTags: ['whatsapp-lead', 'qualified'],
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n6',
          type: 'flowNode',
          position: { x: 100, y: 920 },
          data: {
            label: 'Confirmation Message',
            nodeType: 'message_text',
            config: {
              text: 'Thank you, *{{name}}*! Our executive will get in touch with you shortly on this number regarding *{{requirement}}*. Have a great day!',
              typingSimulation: true,
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n7',
          type: 'flowNode',
          position: { x: 100, y: 1080 },
          data: {
            label: 'End Session',
            nodeType: 'control_end',
            config: { endReason: 'completed' },
            isValid: true,
            validationErrors: [],
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: 'n1', target: 'n2', type: 'customEdge' },
        { id: 'e2-3', source: 'n2', target: 'n3', type: 'customEdge' },
        { id: 'e3-4', source: 'n3', target: 'n4', type: 'customEdge' },
        { id: 'e4-5', source: 'n4', target: 'n5', type: 'customEdge' },
        { id: 'e5-6', source: 'n5', target: 'n6', type: 'customEdge' },
        { id: 'e6-7', source: 'n6', target: 'n7', type: 'customEdge' },
      ],
    },
  },

  // 2. FAQ MENU
  {
    key: 'faq_menu',
    name: 'Interactive FAQ Menu',
    description: 'Numbered navigation menu for Pricing, Services, Location, and Agent handoff with instant answers.',
    category: 'support',
    flow: {
      schemaVersion: 1,
      metadata: {
        name: 'FAQ Menu Bot',
        description: 'Instant answers for common customer questions',
        category: 'support',
        version: 1,
      },
      viewport: { x: 50, y: 50, zoom: 0.8 },
      nodes: [
        {
          id: 'n1',
          type: 'flowNode',
          position: { x: 250, y: 50 },
          data: {
            label: 'Menu Keyword Trigger',
            nodeType: 'trigger_keyword',
            config: {
              keywords: ['menu', 'help', 'start', 'pricing', 'options', 'info'],
              matchMode: 'contains',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n2',
          type: 'flowNode',
          position: { x: 250, y: 200 },
          data: {
            label: 'Main Options Menu',
            nodeType: 'message_menu',
            config: {
              menuTitle: 'Welcome to our WhatsApp Assistant! How can we assist you today?',
              menuOptions: [
                { id: 'opt_1', index: 1, label: 'Plans & Pricing', keywords: ['price', 'pricing', 'cost', 'plan'] },
                { id: 'opt_2', index: 2, label: 'Our Services', keywords: ['service', 'services', 'features'] },
                { id: 'opt_3', index: 3, label: 'Office Location & Timings', keywords: ['location', 'address', 'timing', 'hours'] },
                { id: 'opt_4', index: 4, label: 'Talk to an Agent', keywords: ['agent', 'human', 'support', 'help'] },
              ],
              invalidReplyText: 'Please reply with 1, 2, 3, or 4 to choose an option.',
              maxRetries: 3,
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n3',
          type: 'flowNode',
          position: { x: -50, y: 440 },
          data: {
            label: 'Pricing Info',
            nodeType: 'message_text',
            config: {
              text: '💰 *Plans & Pricing*\n\n• Starter: ₹999/mo (Up to 10k messages)\n• Growth: ₹2,499/mo (Multi-instance + AI)\n• Enterprise: Custom dedicated setup\n\nVisit our pricing page for more details!',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n4',
          type: 'flowNode',
          position: { x: 150, y: 440 },
          data: {
            label: 'Services Info',
            nodeType: 'message_text',
            config: {
              text: '🚀 *Our Services*\n\n1. WhatsApp Bulk Broadcasts\n2. Automated Chatbots & Auto-Replies\n3. CRM & API Integrations\n4. Verified WhatsApp Blue Tick Support',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n5',
          type: 'flowNode',
          position: { x: 350, y: 440 },
          data: {
            label: 'Location & Hours',
            nodeType: 'message_text',
            config: {
              text: '📍 *Office Location*\nTower B, Cyber City, Sector 24, Gurugram, India.\n\n⏰ *Working Hours*\nMonday to Saturday: 9:30 AM to 6:30 PM IST.',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n6',
          type: 'flowNode',
          position: { x: 550, y: 440 },
          data: {
            label: 'Agent Handoff',
            nodeType: 'control_handoff',
            config: {
              handoffMessage: 'Connecting you with a team representative right now. Please hold on!',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n7',
          type: 'flowNode',
          position: { x: 200, y: 650 },
          data: {
            label: 'Ask for More Help',
            nodeType: 'input_ask',
            config: {
              questionText: 'Do you need help with anything else? Reply *YES* to see the menu again or *NO* to exit.',
              variableName: 'more_help',
              validationType: 'choice',
              choiceOptions: ['yes', 'no'],
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n8',
          type: 'flowNode',
          position: { x: 200, y: 820 },
          data: {
            label: 'Check More Help',
            nodeType: 'logic_condition',
            config: {
              conditionRules: [{ variable: 'more_help', operator: 'equals', value: 'yes' }],
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n9',
          type: 'flowNode',
          position: { x: 400, y: 960 },
          data: {
            label: 'Goodbye Message',
            nodeType: 'control_end',
            config: {
              endMessage: 'Thank you for contacting us! Have a wonderful day ahead.',
            },
            isValid: true,
            validationErrors: [],
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: 'n1', target: 'n2', type: 'customEdge' },
        { id: 'e2-3', source: 'n2', target: 'n3', sourceHandle: 'opt_1', type: 'customEdge', label: '1. Pricing' },
        { id: 'e2-4', source: 'n2', target: 'n4', sourceHandle: 'opt_2', type: 'customEdge', label: '2. Services' },
        { id: 'e2-5', source: 'n2', target: 'n5', sourceHandle: 'opt_3', type: 'customEdge', label: '3. Location' },
        { id: 'e2-6', source: 'n2', target: 'n6', sourceHandle: 'opt_4', type: 'customEdge', label: '4. Agent' },
        { id: 'e3-7', source: 'n3', target: 'n7', type: 'customEdge' },
        { id: 'e4-7', source: 'n4', target: 'n7', type: 'customEdge' },
        { id: 'e5-7', source: 'n5', target: 'n7', type: 'customEdge' },
        { id: 'e7-8', source: 'n7', target: 'n8', type: 'customEdge' },
        { id: 'e8-2', source: 'n8', target: 'n2', sourceHandle: 'true', type: 'customEdge', label: 'Yes (Loop)' },
        { id: 'e8-9', source: 'n8', target: 'n9', sourceHandle: 'false', type: 'customEdge', label: 'No (Exit)' },
      ],
    },
  },

  // 3. BUSINESS HOURS AUTO-REPLY
  {
    key: 'business_hours',
    name: 'Business Hours Auto-Reply',
    description: 'Routes open hours to your welcome menu and out-of-hours to a polite message capturing callback details.',
    category: 'utility',
    flow: {
      schemaVersion: 1,
      metadata: {
        name: 'Business Hours Bot',
        description: 'Auto-reply based on working schedule',
        category: 'utility',
        version: 1,
      },
      viewport: { x: 50, y: 50, zoom: 0.9 },
      nodes: [
        {
          id: 'n1',
          type: 'flowNode',
          position: { x: 200, y: 50 },
          data: {
            label: 'Any Inbound Message',
            nodeType: 'trigger_fallback',
            config: { title: 'Catch-all Trigger' },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n2',
          type: 'flowNode',
          position: { x: 200, y: 200 },
          data: {
            label: 'Check Business Hours',
            nodeType: 'logic_business_hours',
            config: {
              timezone: 'Asia/Kolkata',
              daysOpen: [1, 2, 3, 4, 5, 6],
              openTime: '09:30',
              closeTime: '18:30',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n3',
          type: 'flowNode',
          position: { x: 50, y: 380 },
          data: {
            label: 'Open: Welcome Message',
            nodeType: 'message_text',
            config: {
              text: '👋 Hello! We are currently online. An agent will be right with you or reply with *MENU* to browse options.',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n4',
          type: 'flowNode',
          position: { x: 350, y: 380 },
          data: {
            label: 'Closed: Offline Notice',
            nodeType: 'message_text',
            config: {
              text: '🌙 Hello! Our office is currently closed. Our working hours are Mon-Sat from 9:30 AM to 6:30 PM IST.',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n5',
          type: 'flowNode',
          position: { x: 350, y: 540 },
          data: {
            label: 'Ask for Callback Note',
            nodeType: 'input_ask',
            config: {
              questionText: 'Please leave a brief message with your query, and we will get back to you first thing tomorrow:',
              variableName: 'offline_query',
              validationType: 'text',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n6',
          type: 'flowNode',
          position: { x: 350, y: 700 },
          data: {
            label: 'Notify Support Team',
            nodeType: 'action_notify',
            config: {
              notifyChannel: 'in_app',
              notifyMessage: 'New offline query from {{contact.phone}}: {{offline_query}}',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n7',
          type: 'flowNode',
          position: { x: 350, y: 860 },
          data: {
            label: 'Closing Note',
            nodeType: 'control_end',
            config: {
              endMessage: 'Thank you! We have recorded your note and will contact you promptly.',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n8',
          type: 'flowNode',
          position: { x: 50, y: 540 },
          data: {
            label: 'Handover to Agent',
            nodeType: 'control_handoff',
            config: {
              handoffMessage: 'An agent has been notified and will reply shortly.',
            },
            isValid: true,
            validationErrors: [],
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: 'n1', target: 'n2', type: 'customEdge' },
        { id: 'e2-3', source: 'n2', target: 'n3', sourceHandle: 'open', label: 'Open', type: 'customEdge' },
        { id: 'e2-4', source: 'n2', target: 'n4', sourceHandle: 'closed', label: 'Closed', type: 'customEdge' },
        { id: 'e3-8', source: 'n3', target: 'n8', type: 'customEdge' },
        { id: 'e4-5', source: 'n4', target: 'n5', type: 'customEdge' },
        { id: 'e5-6', source: 'n5', target: 'n6', type: 'customEdge' },
        { id: 'e6-7', source: 'n6', target: 'n7', type: 'customEdge' },
      ],
    },
  },

  // 4. APPOINTMENT / CONSULTATION REQUEST
  {
    key: 'appointment_booking',
    name: 'Appointment & Consultation Booking',
    description: 'Capture service category, preferred date, and time slot, then send confirmation.',
    category: 'sales',
    flow: {
      schemaVersion: 1,
      metadata: {
        name: 'Appointment Booking',
        description: 'Schedule appointments and consultations on WhatsApp',
        category: 'sales',
        version: 1,
      },
      viewport: { x: 50, y: 50, zoom: 0.85 },
      nodes: [
        {
          id: 'n1',
          type: 'flowNode',
          position: { x: 150, y: 50 },
          data: {
            label: 'Booking Keyword',
            nodeType: 'trigger_keyword',
            config: {
              keywords: ['book', 'appointment', 'consultation', 'slot', 'demo', 'meeting'],
              matchMode: 'contains',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n2',
          type: 'flowNode',
          position: { x: 150, y: 200 },
          data: {
            label: 'Ask Service Type',
            nodeType: 'message_menu',
            config: {
              menuTitle: 'Please select the consultation service you wish to schedule:',
              menuOptions: [
                { id: 'opt_1', index: 1, label: 'Product Demo & Onboarding' },
                { id: 'opt_2', index: 2, label: 'Technical Architecture Review' },
                { id: 'opt_3', index: 3, label: 'Sales & Commercial Negotiation' },
              ],
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n3',
          type: 'flowNode',
          position: { x: 150, y: 400 },
          data: {
            label: 'Ask Preferred Date',
            nodeType: 'input_ask',
            config: {
              questionText: 'What date works best for you? (Please specify e.g. YYYY-MM-DD or Tomorrow)',
              variableName: 'booking_date',
              validationType: 'text',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n4',
          type: 'flowNode',
          position: { x: 150, y: 560 },
          data: {
            label: 'Ask Time Slot',
            nodeType: 'input_ask',
            config: {
              questionText: 'Which time slot do you prefer?\n\n1. Morning (10:00 AM - 12:00 PM)\n2. Afternoon (02:00 PM - 04:00 PM)\n3. Evening (05:00 PM - 07:00 PM)',
              variableName: 'booking_slot',
              validationType: 'choice',
              choiceOptions: ['Morning', 'Afternoon', 'Evening', '1', '2', '3'],
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n5',
          type: 'flowNode',
          position: { x: 150, y: 720 },
          data: {
            label: 'Booking Confirmation',
            nodeType: 'message_text',
            config: {
              text: '🎉 *Booking Request Received!*\n\n• Service: {{last_menu_choice}}\n• Date: {{booking_date}}\n• Slot: {{booking_slot}}\n\nOur coordinator will send your Google Meet invite shortly.',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n6',
          type: 'flowNode',
          position: { x: 150, y: 880 },
          data: {
            label: 'End Booking',
            nodeType: 'control_end',
            config: { endReason: 'completed' },
            isValid: true,
            validationErrors: [],
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: 'n1', target: 'n2', type: 'customEdge' },
        { id: 'e2-3_1', source: 'n2', target: 'n3', sourceHandle: 'opt_1', type: 'customEdge' },
        { id: 'e2-3_2', source: 'n2', target: 'n3', sourceHandle: 'opt_2', type: 'customEdge' },
        { id: 'e2-3_3', source: 'n2', target: 'n3', sourceHandle: 'opt_3', type: 'customEdge' },
        { id: 'e3-4', source: 'n3', target: 'n4', type: 'customEdge' },
        { id: 'e4-5', source: 'n4', target: 'n5', type: 'customEdge' },
        { id: 'e5-6', source: 'n5', target: 'n6', type: 'customEdge' },
      ],
    },
  },

  // 5. CAMPAIGN REPLY FOLLOW-UP
  {
    key: 'campaign_followup',
    name: 'Campaign Reply Follow-up',
    description: 'Triggered when a contact replies to a bulk outreach campaign, giving options to buy or opt out.',
    category: 'sales',
    flow: {
      schemaVersion: 1,
      metadata: {
        name: 'Campaign Follow-up Bot',
        description: 'Automated response to campaign replies',
        category: 'sales',
        version: 1,
      },
      viewport: { x: 50, y: 50, zoom: 0.85 },
      nodes: [
        {
          id: 'n1',
          type: 'flowNode',
          position: { x: 200, y: 50 },
          data: {
            label: 'Campaign Reply Trigger',
            nodeType: 'trigger_campaign_reply',
            config: {
              title: 'Any Campaign Reply',
              windowDays: 7,
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n2',
          type: 'flowNode',
          position: { x: 200, y: 200 },
          data: {
            label: 'Interest Menu',
            nodeType: 'message_menu',
            config: {
              menuTitle: 'Thanks for replying to our special offer! How would you like to proceed?',
              menuOptions: [
                { id: 'opt_1', index: 1, label: 'I want to claim the discount' },
                { id: 'opt_2', index: 2, label: 'Tell me more details' },
                { id: 'opt_3', index: 3, label: 'Unsubscribe / Stop messages' },
              ],
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n3',
          type: 'flowNode',
          position: { x: 0, y: 400 },
          data: {
            label: 'Discount Voucher Code',
            nodeType: 'message_text',
            config: {
              text: '🎁 Here is your coupon code: *SAVE20* for 20% off at checkout!\n\nAn agent will assist you to complete your order.',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n4',
          type: 'flowNode',
          position: { x: 200, y: 400 },
          data: {
            label: 'Agent Handoff',
            nodeType: 'control_handoff',
            config: {
              handoffMessage: 'Our sales advisor is joining this chat to share complete details.',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n5',
          type: 'flowNode',
          position: { x: 420, y: 400 },
          data: {
            label: 'Opt Out',
            nodeType: 'control_opt_out',
            config: {
              optOutReason: 'Customer opted out via campaign follow-up',
              optOutMessage: 'You have been unsubscribed from our broadcast list. You will not receive future promotional messages.',
            },
            isValid: true,
            validationErrors: [],
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: 'n1', target: 'n2', type: 'customEdge' },
        { id: 'e2-3', source: 'n2', target: 'n3', sourceHandle: 'opt_1', type: 'customEdge' },
        { id: 'e2-4', source: 'n2', target: 'n4', sourceHandle: 'opt_2', type: 'customEdge' },
        { id: 'e2-5', source: 'n2', target: 'n5', sourceHandle: 'opt_3', type: 'customEdge' },
        { id: 'e3-4', source: 'n3', target: 'n4', type: 'customEdge' },
      ],
    },
  },

  // 6. SUPPORT TRIAGE WITH AI
  {
    key: 'ai_support_triage',
    name: 'AI Support Triage & Knowledge Bot',
    description: 'Uses OpenRouter AI to answer customer questions from your FAQ knowledge base with fallback to human agents.',
    category: 'support',
    flow: {
      schemaVersion: 1,
      metadata: {
        name: 'AI Support Assistant',
        description: 'Intelligent answers powered by OpenRouter',
        category: 'support',
        version: 1,
      },
      viewport: { x: 50, y: 50, zoom: 0.85 },
      nodes: [
        {
          id: 'n1',
          type: 'flowNode',
          position: { x: 200, y: 50 },
          data: {
            label: 'Customer Inbound',
            nodeType: 'trigger_fallback',
            config: { title: 'AI Assistant Entry' },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n2',
          type: 'flowNode',
          position: { x: 200, y: 200 },
          data: {
            label: 'AI Knowledge Reply',
            nodeType: 'ai_reply',
            config: {
              systemPrompt: 'You are a polite, concise customer support assistant. Answer the customer query accurately based strictly on the knowledge base provided. If unsure or if the customer expresses frustration, respond that an agent will take over.',
              knowledgeBaseText: 'Our platform supports WhatsApp marketing, automated replies, contact imports, and analytics. Support email: support@bulkflow.io. Standard refund window: 7 days.',
              confidenceThreshold: 0.75,
              maxAiTokens: 300,
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'n3',
          type: 'flowNode',
          position: { x: 350, y: 380 },
          data: {
            label: 'Human Escalation',
            nodeType: 'control_handoff',
            config: {
              handoffMessage: 'I am connecting you with a human support specialist to resolve this for you.',
            },
            isValid: true,
            validationErrors: [],
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: 'n1', target: 'n2', type: 'customEdge' },
        { id: 'e2-3', source: 'n2', target: 'n3', sourceHandle: 'fallback', label: 'Uncertain / Handoff', type: 'customEdge' },
      ],
    },
  },
];
