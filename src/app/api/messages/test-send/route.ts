import { NextRequest, NextResponse } from 'next/server';
import { EvolutionClient } from '@/lib/evolution';
import { renderMessage } from '@/lib/spintax';
import { normalizePhone } from '@/lib/phone';
import { getSessionUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      instanceName,
      phone,
      content,
      mediaType = 'text',
      mediaUrl,
      fileName,
      caption,
      appendOptOut = false,
      optOutText,
    } = body;

    if (!instanceName || !phone || !content) {
      return NextResponse.json({ error: 'instanceName, phone, and content are required' }, { status: 400 });
    }

    const normPhone = normalizePhone(phone);
    if (!normPhone.isValid) {
      return NextResponse.json({ error: normPhone.error || 'Invalid phone number' }, { status: 400 });
    }

    const client = await EvolutionClient.fromDatabase();

    // Render message
    const rendered = renderMessage(content, { name: 'Test Recipient', phone: normPhone.formatted }, {
      appendOptOut,
      optOutText,
    });

    let result: any;
    if (mediaType && mediaType !== 'text' && mediaUrl) {
      result = await client.sendMedia(instanceName, normPhone.formatted, {
        mediaType,
        mimetype: mediaType === 'image' ? 'image/jpeg' : (mediaType === 'video' ? 'video/mp4' : 'application/pdf'),
        caption: caption ? renderMessage(caption, { name: 'Test Recipient' }) : rendered,
        media: mediaUrl,
        fileName: fileName || 'file',
      });
    } else {
      result = await client.sendText(instanceName, normPhone.formatted, rendered);
    }

    logger.info({ instanceName, phone: normPhone.formatted }, 'Test message dispatched');
    return NextResponse.json({ success: true, message: 'Test message dispatched successfully', result });
  } catch (err: any) {
    logger.error({ err }, 'Error sending test message');
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

