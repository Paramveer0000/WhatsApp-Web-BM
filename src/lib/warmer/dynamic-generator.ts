import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { resolveSpintax, SCRIPTED_DIALOGUES, DialogueScript } from './dialogues';

export interface WarmerHistoryTurn {
  messageA: string;
  messageB: string;
  topic?: string;
  timestamp?: string;
}

export interface DialogueTurnMessage {
  sender: 'A' | 'B';
  text: string;
}

export interface GenerateTurnOptions {
  topic: string;
  useAi: boolean;
  aiPrompt?: string | null;
  clientId?: string | null;
  historyLogs?: WarmerHistoryTurn[];
}

export interface GeneratedTurnResult {
  messageA: string;
  messageB: string;
  topicTitle: string;
  source: 'ai_dynamic' | 'time_contextual' | 'smart_spintax';
  messages: DialogueTurnMessage[];
}

/**
 * Retrieves the effective AI API key and model:
 * 1. Client-specific key from ResellerClient (if tenant)
 * 2. System setting AI_PROVIDER_SETTINGS
 * 3. Environment variables (OPENROUTER_API_KEY, OPENAI_API_KEY)
 */
async function resolveAiCredentials(clientId?: string | null): Promise<{
  apiKey: string | null;
  model: string;
  provider: 'openrouter' | 'openai';
}> {
  // 1. Client-specific key
  if (clientId) {
    try {
      const client = await db.resellerClient.findUnique({
        where: { id: clientId },
        select: { aiApiKey: true, aiModel: true },
      });
      if (client?.aiApiKey?.trim()) {
        const key = client.aiApiKey.trim();
        const isDirectOpenAi = key.startsWith('sk-proj-') || (key.startsWith('sk-') && !key.includes('or-v1'));
        return {
          apiKey: key,
          model: client.aiModel || 'anthropic/claude-3.5-haiku',
          provider: isDirectOpenAi ? 'openai' : 'openrouter',
        };
      }
    } catch {}
  }

  // 2. Global AI_PROVIDER_SETTINGS
  try {
    const settingRow = await db.setting.findUnique({
      where: { key: 'AI_PROVIDER_SETTINGS' },
    });
    if (settingRow?.value) {
      const parsed = JSON.parse(settingRow.value);
      if (parsed?.apiKey?.trim()) {
        const key = parsed.apiKey.trim();
        const isDirectOpenAi = key.startsWith('sk-proj-') || (key.startsWith('sk-') && !key.includes('or-v1'));
        return {
          apiKey: key,
          model: parsed.model || 'anthropic/claude-3.5-haiku',
          provider: isDirectOpenAi ? 'openai' : 'openrouter',
        };
      }
    }
  } catch {}

  // 3. Environment variable fallback
  const envKey = (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '').trim();
  if (envKey) {
    const isDirectOpenAi = envKey.startsWith('sk-proj-') || (envKey.startsWith('sk-') && !envKey.includes('or-v1'));
    return {
      apiKey: envKey,
      model: isDirectOpenAi ? 'gpt-4o-mini' : 'anthropic/claude-3.5-haiku',
      provider: isDirectOpenAi ? 'openai' : 'openrouter',
    };
  }

  return { apiKey: null, model: 'anthropic/claude-3.5-haiku', provider: 'openrouter' };
}

/**
 * Attempts to generate realistic continuous human conversation using LLM
 */
async function generateAiTurn(options: GenerateTurnOptions): Promise<GeneratedTurnResult | null> {
  const { topic, aiPrompt, clientId, historyLogs = [] } = options;
  const { apiKey, model, provider } = await resolveAiCredentials(clientId);

  if (!apiKey) return null;

  // Format recent chat history (up to last 3 exchanges) for conversational continuity
  const recentExchanges = historyLogs.slice(0, 3).reverse();
  const historyText = recentExchanges.length > 0
    ? recentExchanges
        .map((h, i) => `Turn ${i + 1}:\nPerson A: ${h.messageA}\nPerson B: ${h.messageB}`)
        .join('\n\n')
    : 'No previous messages yet. This is the start of the conversation.';

  const topicGuidance = aiPrompt && aiPrompt.trim()
    ? `Custom Scenario: ${aiPrompt.trim()}`
    : `Topic: ${topic.toUpperCase()} casual conversation between friends/colleagues.`;

  const systemPrompt = `You are simulating a 100% authentic, natural, everyday continuous WhatsApp text conversation between two friends or colleagues (Person A and Person B).

STRICT RULES:
1. Generate an ongoing back-and-forth conversation thread of 3 to 4 alternating messages (A -> B -> A -> B, or A -> B -> A).
2. Keep each message short, natural, and conversational (1-2 sentences maximum, under 25 words per message).
3. If chat history is provided, continue the ongoing conversation naturally or transition smoothly to a related everyday thought so it flows like a real human chat.
4. Write like real humans typing on a smartphone: casual punctuation, natural wording, lowercase touches, and occasional emojis (1 max per message).
5. NEVER mention bots, AI, warming, promotions, discounts, links, or marketing jargon.
6. Language: Natural English (or natural conversational Hinglish if topic mentions Hinglish or Indian context).

OUTPUT FORMAT:
Return strictly a valid JSON object matching this schema:
{
  "topicTitle": "Short 2-3 word summary of the exchange",
  "messages": [
    { "sender": "A", "text": "First message from Person A" },
    { "sender": "B", "text": "Reply from Person B" },
    { "sender": "A", "text": "Follow-up response from Person A" },
    { "sender": "B", "text": "Final reaction/wrap-up from Person B" }
  ]
}`;

  const userPrompt = `${topicGuidance}

Recent Chat History:
${historyText}

Generate the next continuous 3-to-4 message WhatsApp dialogue thread:`;

  const endpoint = provider === 'openai'
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://bulkflow.app',
        'X-Title': 'BulkFlow WhatsApp Number Warmer',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.85,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logger.warn({ status: res.status, errText }, 'AI Warmer turn generation request returned error');
      return null;
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) return null;

    const parsed = JSON.parse(rawContent);
    const rawMessages = Array.isArray(parsed.messages) ? parsed.messages : [];

    const validMessages: DialogueTurnMessage[] = [];
    for (const m of rawMessages) {
      if (m && typeof m.text === 'string' && m.text.trim()) {
        validMessages.push({
          sender: m.sender === 'B' ? 'B' : 'A',
          text: m.text.trim(),
        });
      }
    }

    // Fallback if AI returned legacy format { messageA, messageB }
    if (validMessages.length < 2) {
      const msgA = (parsed.messageA || parsed.turnA || parsed.caller || '').trim();
      const msgB = (parsed.messageB || parsed.turnB || parsed.responder || '').trim();
      if (msgA) validMessages.push({ sender: 'A', text: msgA });
      if (msgB) validMessages.push({ sender: 'B', text: msgB });
    }

    if (validMessages.length >= 2) {
      const firstA = validMessages.find((m) => m.sender === 'A')?.text || validMessages[0].text;
      const firstB = validMessages.find((m) => m.sender === 'B')?.text || validMessages[1].text;
      return {
        messageA: firstA,
        messageB: firstB,
        topicTitle: parsed.topicTitle || `${topic} chat`,
        source: 'ai_dynamic',
        messages: validMessages,
      };
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Failed to generate dynamic AI warmer turn, falling back to smart contextual engine');
  } finally {
    clearTimeout(timeout);
  }

  return null;
}

/**
 * Time-of-day & Day-of-week contextual phrase seeds
 */
const TIME_CONTEXTUAL_OPENERS = {
  morning: [
    {
      a: '{Good morning|Morning|Hey morning}! {Hope you had a restful evening|Ready for the day?|Up early today?}',
      b: '{Morning!|Good morning!|Hey!} {Yes, having my first coffee now|Feeling energized today|Heading out soon}. {How are things on your end?|You ready for today?|What is your plan?}',
      a2: '{Same here! Just reviewing the schedule for today.|Need another coffee too haha!|All set, gearing up for the tasks.}',
      b2: '{Sounds good, have a productive day ahead!|Catch you in a bit!|Talk to you soon 👍}',
    },
    {
      a: '{Coffee in hand|Just brewed some fresh coffee}! {How is your morning going so far?|Did you beat the morning commute rush?|Ready for our sync later?}',
      b: '{Haha need that coffee too!|Morning going well so far|Traffic was surprisingly light today}. {Talk soon!|Catch you in a bit!|Let us connect soon 👍}',
      a2: '{Awesome, let us catch up around 11 AM then.|Glad traffic was smooth!|Talk soon!}',
      b2: '{Perfect, see you then!|Have a great morning! 👍}',
    },
    {
      a: '{Morning!|Hey}! {Did you get a chance to see that email from earlier?|Did you check the forecast for today?|Free for a quick call before noon?}',
      b: '{Yes just scanning through it now|Looks like sunny weather all day|Yes, 11 AM works perfectly for me}.',
      a2: '{Great, let me know once you review it.|Sunny day sounds lovely!|Sending you the quick link now.}',
      b2: '{Got it, on it now!|Awesome, talk to you shortly 👍}',
    },
  ],
  afternoon: [
    {
      a: '{Hey|Hi|Hello}! {Grabbed lunch yet?|Taking a quick lunch break?|Any good food recommendations around?}',
      b: '{Just finished lunch!|Heading out now for a quick bite|Had some great pasta today}. {Did you eat yet?|Want to grab a quick coffee?|How is your afternoon shaping up?}',
      a2: '{Just grabbing a quick sandwich now.|Enjoy your meal!|Afternoon is looking pretty smooth so far.}',
      b2: '{Nice, eat well!|Catch you later this afternoon 👍}',
    },
    {
      a: '{Afternoon!|Quick check-in}! {How is the progress on the latest task?|How did that client review go?|Wrapping up the presentation deck?}',
      b: '{Going smooth so far|Client was happy with the walkthrough|Almost finished, sharing the draft in 15 mins}.',
      a2: '{Super glad to hear that!|Appreciate the quick turnaround.|Looking forward to reviewing it.}',
      b2: '{Will ping you the moment it is shared! 👍}',
    },
    {
      a: '{Mid-day coffee run time!|Need a 5-minute breather}| {Join for a quick tea?|Are you at your desk?|Fancy a quick walk?}',
      b: '{Definitely need that!|Be right there in 2 mins|Meet at the reception lobby 👍}.',
      a2: '{Sounds like a plan! See you downstairs.}',
      b2: '{Coming down now!}',
    },
  ],
  evening: [
    {
      a: '{Evening!|Hey}! {Wrapping up work for the day?|Done with your meetings for today?|Heading home now?}',
      b: '{Yes, just closing my laptop now|Almost done, 10 more minutes|Already on the way back!}. {You heading home too?|Any evening plans?|Enjoy your evening!}',
      a2: '{Just stepping out too.|Heading home, looking forward to some rest!|Enjoy your evening as well!}',
      b2: '{Have a relaxing evening, talk tomorrow! 👍}',
    },
    {
      a: '{Any dinner plans for tonight?|Thinking of ordering Thai or Mexican tonight|Cooked a nice meal at home today}',
      b: '{Thai sounds fantastic! Go for the green curry|Nice! Enjoy your dinner|I am just making a quick salad tonight}.',
      a2: '{Green curry it is, thanks for the recommendation!|Salad sounds super healthy!}',
      b2: '{Haha enjoy your dinner! Talk tomorrow 👍}',
    },
    {
      a: '{Finally end of the workday!|Long day today but got a lot done|Evening workout time}',
      b: '{Same here, feeling accomplished!|Rest well tonight!|Have a great workout session 💪}.',
      a2: '{Thanks a lot, catch you tomorrow morning!}',
      b2: '{Rest well, see you tomorrow!}',
    },
  ],
  night: [
    {
      a: '{Hey, saw this and thought of you!|Did you catch the match highlights earlier?|Quick ping before wrapping up for tonight}',
      b: '{Haha thanks for sharing!|Yes that finish was crazy!|Catch you tomorrow morning, rest well! 👍}',
      a2: '{Unbelievable finish right? Have a good night!}',
      b2: '{Good night, talk tomorrow!}',
    },
    {
      a: '{Calling it a night now|Shutting down screens for today}. {Catch you tomorrow!|Talk to you in the morning!}',
      b: '{Good night, talk tomorrow!|Sleep well! 👍|Have a good rest!}',
      a2: '{Good night!}',
      b2: '{Sleep well!}',
    },
  ],
};

const DAY_SPECIFIC_SPINTAX = {
  monday: '{Happy Monday! Hope your week starts off strong.|Crazy Monday morning, but tackling the to-do list.|Ready for a super productive week ahead!}',
  friday: '{Happy Friday! TGIF!|Weekend is finally here! Any fun plans?|Wrapping up everything so we can enjoy the weekend.}',
  weekend: '{Happy weekend! Hope you are getting good rest.|Enjoying the weekend downtime?|Great weather outside today!}',
  midweek: '{Happy Wednesday, week is flying by!|Halfway through the week already.|Hope your week is moving smoothly!}',
};

/**
 * Detects current local time slot (Morning, Afternoon, Evening, Night)
 */
function getCurrentTimeSlot(): 'morning' | 'afternoon' | 'evening' | 'night' {
  // Use current system hour (supports standard business day cycles)
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function getDayVibe(): string {
  const day = new Date().getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  if (day === 1) return DAY_SPECIFIC_SPINTAX.monday;
  if (day === 5) return DAY_SPECIFIC_SPINTAX.friday;
  if (day === 0 || day === 6) return DAY_SPECIFIC_SPINTAX.weekend;
  return DAY_SPECIFIC_SPINTAX.midweek;
}

/**
 * Generates an organic, contextual turn with time-of-day awareness and multi-turn story progression
 */
function generateContextualTurn(options: GenerateTurnOptions): GeneratedTurnResult {
  const { topic = 'casual', historyLogs = [] } = options;
  const timeSlot = getCurrentTimeSlot();
  const dayVibe = resolveSpintax(getDayVibe());

  // 1. Every 4th turn or when starting empty, try a realistic time-of-day opener
  const turnCount = historyLogs.length;
  if (turnCount % 4 === 0 && Math.random() < 0.6) {
    const list = TIME_CONTEXTUAL_OPENERS[timeSlot];
    const picked = list[Math.floor(Math.random() * list.length)];
    const msgA = resolveSpintax(picked.a);
    const msgB = resolveSpintax(picked.b);
    const msgA2 = resolveSpintax(picked.a2 || '{Sounds great! Catch you later.|Great, have a wonderful day!|Talk soon!}');
    const msgB2 = resolveSpintax(picked.b2 || '{Thanks, you too! 👍|Talk soon!|Catch you in a bit!}');
    const turns: DialogueTurnMessage[] = [
      { sender: 'A', text: msgA },
      { sender: 'B', text: msgB },
      { sender: 'A', text: msgA2 },
      { sender: 'B', text: msgB2 },
    ];
    return {
      messageA: msgA,
      messageB: msgB,
      topicTitle: `${timeSlot.charAt(0).toUpperCase() + timeSlot.slice(1)} check-in`,
      source: 'time_contextual',
      messages: turns,
    };
  }

  // 2. Select matching dialogue script and resolve all turns in the continuous conversation thread
  const matchingScripts = SCRIPTED_DIALOGUES.filter(
    (s) => topic === 'all' || s.topic === topic
  );
  const script: DialogueScript = matchingScripts.length > 0
    ? matchingScripts[Math.floor(Math.random() * matchingScripts.length)]
    : SCRIPTED_DIALOGUES[0];

  const resolvedTurns: DialogueTurnMessage[] = script.turns.map((t, idx) => {
    let text = resolveSpintax(t.text);
    if (idx === 0 && Math.random() < 0.25) {
      text = `${dayVibe} ${text}`;
    }
    return {
      sender: t.sender,
      text,
    };
  });

  return {
    messageA: resolvedTurns[0]?.text || 'Hi! How are things with you?',
    messageB: resolvedTurns[1]?.text || 'Hey! Doing well, thanks for asking.',
    topicTitle: script.title,
    source: 'smart_spintax',
    messages: resolvedTurns,
  };
}

/**
 * Main export: Dynamically generates the next authentic warmer exchange turn.
 * Uses LLM if enabled/available, otherwise falls back smoothly to time-aware organic engine.
 */
export async function generateDynamicWarmerTurn(options: GenerateTurnOptions): Promise<GeneratedTurnResult> {
  // If AI mode is enabled (or user provided custom scenario), try AI first
  if (options.useAi || (options.aiPrompt && options.aiPrompt.trim().length > 3)) {
    const aiResult = await generateAiTurn(options);
    if (aiResult) return aiResult;
  }

  // Fallback / standard dynamic mode
  return generateContextualTurn(options);
}

