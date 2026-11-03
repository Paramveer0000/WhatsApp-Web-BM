import { NextRequest, NextResponse } from 'next/server';
import { renderMessage, formatWhatsAppToHtml, countSpintaxVariations } from '@/lib/spintax';
import { getSessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { template, recipient = {}, appendOptOut = false, optOutText } = body;

    const rendered = renderMessage(template, recipient, { appendOptOut, optOutText });
    const html = formatWhatsAppToHtml(rendered);
    const variationsCount = countSpintaxVariations(template);

    return NextResponse.json({
      success: true,
      preview: rendered,
      html,
      variationsCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

