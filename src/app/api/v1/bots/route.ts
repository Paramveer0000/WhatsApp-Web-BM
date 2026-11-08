export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { withApi } from '@/lib/api-wrapper';
import { logger } from '@/lib/logger';
import { PREBUILT_TEMPLATES } from '@/lib/flow/templates';

// GET /api/v1/bots - List all bots with live status and assigned numbers
export const GET = withApi(async function (req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const bots = await db.flow.findMany({
    where: { status: { not: 'archived' } },
    include: {
      assignments: true,
      versions: {
        select: { id: true, version: true, publishedAt: true },
        orderBy: { version: 'desc' },
        take: 1,
      },
      _count: {
        select: { sessions: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Calculate daily session stats per bot
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const formattedBots = await Promise.all(
    bots.map(async (b) => {
      let draftData: any = null;
      try {
        draftData = JSON.parse(b.currentDraft);
      } catch {}

      const todaySessions = await db.botSession.count({
        where: {
          flowId: b.id,
          startedAt: { gte: todayStart },
        },
      });

      const completedSessions = await db.botSession.count({
        where: {
          flowId: b.id,
          status: 'completed',
        },
      });

      const totalSessions = b._count.sessions || 1;
      const completionRate = Math.round((completedSessions / totalSessions) * 100);

      return {
        id: b.id,
        name: b.name,
        description: b.description || '',
        status: b.status,
        nodeCount: draftData?.nodes?.length || 0,
        assignedInstances: b.assignments.map((a) => a.instanceId),
        latestVersion: b.versions[0]?.version || null,
        todayConversations: todaySessions,
        completionRate: isNaN(completionRate) ? 0 : completionRate,
        updatedAt: b.updatedAt.toISOString(),
      };
    })
  );

  return NextResponse.json({
    success: true,
    bots: formattedBots,
  });
});

// POST /api/v1/bots - Create new bot (Blank or from Template)
export const POST = withApi(async function (req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, templateKey, description } = body;

  let initialFlow: any = null;
  let botName = (name || '').trim();

  if (templateKey) {
    const tpl = PREBUILT_TEMPLATES.find((t) => t.key === templateKey);
    if (tpl) {
      initialFlow = tpl.flow;
      if (!botName) botName = tpl.name;
    }
  }

  if (!initialFlow) {
    botName = botName || 'New WhatsApp Bot';
    initialFlow = {
      schemaVersion: 1,
      metadata: {
        name: botName,
        description: description || 'Visual WhatsApp Chatbot',
        category: 'general',
        version: 1,
      },
      viewport: { x: 100, y: 100, zoom: 1 },
      nodes: [
        {
          id: 'trigger_1',
          type: 'flowNode',
          position: { x: 250, y: 100 },
          data: {
            label: 'Keyword Trigger',
            nodeType: 'trigger_keyword',
            config: {
              keywords: ['hello', 'hi', 'start'],
              matchMode: 'contains',
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'welcome_1',
          type: 'flowNode',
          position: { x: 250, y: 260 },
          data: {
            label: 'Welcome Message',
            nodeType: 'message_text',
            config: {
              text: 'Hello! How can we help you today?',
              typingSimulation: true,
            },
            isValid: true,
            validationErrors: [],
          },
        },
        {
          id: 'end_1',
          type: 'flowNode',
          position: { x: 250, y: 420 },
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
        { id: 'e1-2', source: 'trigger_1', target: 'welcome_1', type: 'customEdge' },
        { id: 'e2-3', source: 'welcome_1', target: 'end_1', type: 'customEdge' },
      ],
    };
  }

  const created = await db.flow.create({
    data: {
      name: botName,
      description: description || 'Visual conversational chatbot',
      status: 'draft',
      currentDraft: JSON.stringify(initialFlow),
      createdBy: user.email,
    },
  });

  return NextResponse.json({
    success: true,
    botId: created.id,
    bot: created,
  });
});

