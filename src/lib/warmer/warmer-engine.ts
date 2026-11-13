import { db, ensureDbSchema } from '@/lib/db';
import { EvolutionClient } from '@/lib/evolution';
import { logger } from '@/lib/logger';
import { getRandomDialogue, resolveSpintax } from './dialogues';

export interface WarmerExchangeLog {
  id: string;
  timestamp: string;
  topic: string;
  instanceA: string;
  instanceB: string;
  phoneA: string;
  phoneB: string;
  messageA: string;
  messageB: string;
  delaySeconds: number;
  status: 'DELIVERED' | 'FAILED';
  error?: string;
}

// Clean phone number to E.164 without @s.whatsapp.net
function cleanPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits : null;
}

// Helper to look up connected phone number for an instance
async function resolveInstancePhone(instanceName: string): Promise<string | null> {
  try {
    const evo = await EvolutionClient.fromDatabase();
    const instances = await evo.fetchInstances();
    const target = instances.find(
      (i: any) =>
        i.name?.toLowerCase() === instanceName.toLowerCase() ||
        i.id?.toLowerCase() === instanceName.toLowerCase()
    );

    if (!target) return null;

    // Check common Evolution API phone metadata locations
    const rawNumber =
      target.ownerJid ||
      target.owner ||
      target.number ||
      target.phone ||
      target.connectionStatus?.phoneNumber;

    return cleanPhone(rawNumber);
  } catch (err: any) {
    logger.warn({ err: err.message, instanceName }, 'Failed to resolve instance phone');
    return null;
  }
}

// Execute 1 complete two-way dialogue exchange between Instance A and Instance B
export async function executeWarmerTurn(sessionId: string): Promise<{
  success: boolean;
  log?: WarmerExchangeLog;
  error?: string;
}> {
  await ensureDbSchema();

  const session = await db.numberWarmerSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return { success: false, error: 'Warmer session not found' };
  }

  if (session.todayExchanges >= session.dailyCap) {
    await db.numberWarmerSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED' },
    });
    return { success: false, error: 'Daily exchange target reached for today' };
  }

  // 1. Resolve phone numbers if missing
  let phoneA = session.phoneA || (await resolveInstancePhone(session.instanceA));
  let phoneB = session.phoneB || (await resolveInstancePhone(session.instanceB));

  if (!phoneA || !phoneB) {
    const missing = !phoneA && !phoneB ? 'both instances' : !phoneA ? session.instanceA : session.instanceB;
    const errorMsg = `Unable to detect registered phone number for ${missing}. Please ensure both WhatsApp accounts are paired & online.`;
    
    await db.numberWarmerSession.update({
      where: { id: sessionId },
      data: { status: 'PAUSED' },
    });

    return { success: false, error: errorMsg };
  }

  // 2. Select authentic dialogue script
  const script = getRandomDialogue(session.topic);
  const textA = resolveSpintax(script.turns[0]?.text || 'Hi! Are you free for a quick chat?');
  const textB = resolveSpintax(script.turns[1]?.text || 'Hey there! Yes, doing well. What is up?');

  const randomDelay = Math.floor(
    Math.random() * (session.maxDelaySeconds - session.minDelaySeconds + 1) + session.minDelaySeconds
  );

  const logEntry: WarmerExchangeLog = {
    id: `wlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    topic: session.topic,
    instanceA: session.instanceA,
    instanceB: session.instanceB,
    phoneA,
    phoneB,
    messageA: textA,
    messageB: textB,
    delaySeconds: randomDelay,
    status: 'DELIVERED',
  };

  try {
    const evo = await EvolutionClient.fromDatabase();

    // 3. Instance A sends to Phone B
    try {
      await evo.sendPresence(session.instanceA, phoneB, 'composing', 2000);
    } catch {}

    await evo.sendText(session.instanceA, phoneB, textA, { delay: 1500 });

    // Short simulated inter-reply pause (simulates realistic reading/thinking time)
    await new Promise((res) => setTimeout(res, 3500));

    // 4. Instance B replies to Phone A
    try {
      await evo.sendPresence(session.instanceB, phoneA, 'composing', 2500);
    } catch {}

    await evo.sendText(session.instanceB, phoneA, textB, { delay: 2000 });

    // 5. Update session history and scheduling
    let currentLogs: WarmerExchangeLog[] = [];
    try {
      currentLogs = JSON.parse(session.logs || '[]');
    } catch {
      currentLogs = [];
    }

    // Keep last 50 logs for live UI stream
    const updatedLogs = [logEntry, ...currentLogs].slice(0, 50);
    const nextScheduled = new Date(Date.now() + randomDelay * 1000);

    const nextCount = session.todayExchanges + 1;
    const nextStatus = nextCount >= session.dailyCap ? 'COMPLETED' : session.status;

    await db.numberWarmerSession.update({
      where: { id: sessionId },
      data: {
        phoneA,
        phoneB,
        todayExchanges: nextCount,
        status: nextStatus,
        lastExchangedAt: new Date(),
        nextScheduledAt: nextScheduled,
        logs: JSON.stringify(updatedLogs),
      },
    });

    logger.info(
      {
        sessionId,
        instanceA: session.instanceA,
        instanceB: session.instanceB,
        count: nextCount,
        delay: randomDelay,
      },
      'Warmer exchange turn executed successfully'
    );

    return { success: true, log: logEntry };
  } catch (err: any) {
    logger.error({ err: err.message, sessionId }, 'Warmer turn failed');
    logEntry.status = 'FAILED';
    logEntry.error = err.message || 'WhatsApp message dispatch failed';

    let currentLogs: WarmerExchangeLog[] = [];
    try {
      currentLogs = JSON.parse(session.logs || '[]');
    } catch {}
    const updatedLogs = [logEntry, ...currentLogs].slice(0, 50);

    await db.numberWarmerSession.update({
      where: { id: sessionId },
      data: {
        logs: JSON.stringify(updatedLogs),
      },
    });

    return { success: false, log: logEntry, error: err.message };
  }
}
