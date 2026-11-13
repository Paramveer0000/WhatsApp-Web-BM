export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hashPassword, verifyPassword } from '@/lib/auth';
import { db, ensureDbSchema } from '@/lib/db';
import { logger } from '@/lib/logger';

// GET /api/client/settings - Retrieve isolated workspace settings for current tenant/client
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    // Identify target client ID
    const targetId = user.clientId || user.id;

    const client = await db.resellerClient.findUnique({
      where: { id: targetId },
    });

    if (!client) {
      // If user is a platform admin viewing their own profile
      return NextResponse.json({
        success: true,
        isPlatformAdmin: true,
        profile: {
          id: user.id,
          name: user.name || 'Administrator',
          email: user.email,
          role: user.role,
        },
      });
    }

    // Mask AI API key for security
    let maskedKey = '';
    if (client.aiApiKey) {
      const k = client.aiApiKey.trim();
      maskedKey = k.length > 8 ? `${k.slice(0, 4)}••••••••${k.slice(-4)}` : '••••••••';
    }

    return NextResponse.json({
      success: true,
      isPlatformAdmin: false,
      settings: {
        id: client.id,
        companyName: client.companyName,
        slug: client.slug,
        ownerName: client.ownerName,
        ownerEmail: client.ownerEmail,
        ownerPhone: client.ownerPhone,
        planName: client.planName,
        maxInstances: client.maxInstances,
        monthlyMsgCap: client.monthlyMsgCap,
        walletBalance: client.walletBalance,
        hasAiKey: Boolean(client.aiApiKey),
        aiApiKeyMasked: maskedKey,
        aiModel: client.aiModel || 'anthropic/claude-3.5-haiku',
        webhookUrl: client.webhookUrl || '',
        webhookSecret: client.webhookSecret || '',
        customDomain: client.customDomain || '',
        brandColor: client.brandColor || '#0c57e4',
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/client/settings');
    return NextResponse.json({ error: err.message || 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT /api/client/settings - Update tenant profile, AI keys, password, and webhooks
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await ensureDbSchema();

    const body = await req.json();
    const {
      companyName,
      ownerName,
      ownerPhone,
      aiApiKey,
      aiModel,
      webhookUrl,
      webhookSecret,
      currentPassword,
      newPassword,
    } = body;

    const targetId = user.clientId || user.id;

    const client = await db.resellerClient.findUnique({
      where: { id: targetId },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client account not found' }, { status: 404 });
    }

    const updateData: any = {};

    if (companyName && companyName.trim()) updateData.companyName = companyName.trim();
    if (ownerName && ownerName.trim()) updateData.ownerName = ownerName.trim();
    if (ownerPhone !== undefined) updateData.ownerPhone = ownerPhone ? String(ownerPhone).trim() : null;

    if (aiApiKey !== undefined) {
      // If user typed a new key (not empty and not masked)
      if (aiApiKey && !aiApiKey.includes('••••')) {
        updateData.aiApiKey = aiApiKey.trim();
      } else if (aiApiKey === '') {
        updateData.aiApiKey = null;
      }
    }

    if (aiModel) updateData.aiModel = aiModel.trim();
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl.trim() || null;
    if (webhookSecret !== undefined) updateData.webhookSecret = webhookSecret.trim() || null;

    // Password Update Workflow
    if (newPassword && newPassword.trim()) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required to set a new password' }, { status: 400 });
      }

      const isMatch = await verifyPassword(currentPassword, client.passwordHash);
      if (!isMatch) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }

      if (newPassword.trim().length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
      }

      updateData.passwordHash = await hashPassword(newPassword.trim());
    }

    const updated = await db.resellerClient.update({
      where: { id: targetId },
      data: updateData,
    });

    logger.info({ clientId: updated.id, email: updated.ownerEmail }, 'Tenant workspace settings updated');

    return NextResponse.json({
      success: true,
      message: 'Workspace settings saved successfully',
      settings: {
        companyName: updated.companyName,
        ownerName: updated.ownerName,
        ownerPhone: updated.ownerPhone,
        hasAiKey: Boolean(updated.aiApiKey),
        aiModel: updated.aiModel,
        webhookUrl: updated.webhookUrl,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in PUT /api/client/settings');
    return NextResponse.json({ error: err.message || 'Failed to update settings' }, { status: 500 });
  }
}
