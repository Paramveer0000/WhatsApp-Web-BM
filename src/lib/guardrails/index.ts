import { db } from '../db';
import {
  GuardrailConfig,
  GuardrailConfigSchema,
  DEFAULT_GUARDRAIL_CONFIG,
  GUARDRAIL_PRESETS,
  resolveEffectiveConfig,
  calculateRiskScore,
  simulatePacing,
} from './types';

export * from './types';
export * from './rules';

// In-process cache for effective configs
const effectiveCache = new Map<string, { config: GuardrailConfig; timestamp: number }>();
const CACHE_TTL_MS = 10000; // 10 seconds

export function invalidateGuardrailCache(key?: string) {
  if (key) {
    effectiveCache.delete(key);
  } else {
    effectiveCache.clear();
  }
}

/**
 * Fetches the raw profile from DB by scope and scopeId
 */
export async function getGuardrailProfile(scope: 'global' | 'instance' | 'campaign', scopeId: string = '') {
  try {
    const profile = await db.guardrailProfile.findUnique({
      where: {
        scope_scopeId: {
          scope,
          scopeId,
        },
      },
    });

    if (!profile) return null;

    return {
      ...profile,
      config: JSON.parse(profile.config) as GuardrailConfig,
    };
  } catch (err) {
    console.error('Error fetching guardrail profile:', err);
    return null;
  }
}

/**
 * Resolves the effective GuardrailConfig for a specific run or scope
 * Follows: Campaign override > Instance override > Global default > Built-in Safe preset
 */
export async function getEffectiveGuardrails(params: {
  campaignId?: string;
  instanceName?: string;
  scope?: 'global' | 'instance' | 'campaign';
  scopeId?: string;
}): Promise<{
  effective: GuardrailConfig;
  sources: Record<string, 'campaign' | 'instance' | 'global' | 'builtin'>;
  strictMode: boolean;
  version: number;
}> {
  const cacheKey = `${params.campaignId || ''}:${params.instanceName || ''}:${params.scope || ''}:${params.scopeId || ''}`;
  const cached = effectiveCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    const { sources } = resolveEffectiveConfig({ global: cached.config });
    return {
      effective: cached.config,
      sources,
      strictMode: cached.config.riskPolicy.strictMode,
      version: 1,
    };
  }

  // 1. Fetch Global
  const globalProfile = await getGuardrailProfile('global', '');

  // 2. Fetch Instance override (if instanceName provided)
  let instanceProfile = null;
  if (params.instanceName) {
    instanceProfile = await getGuardrailProfile('instance', params.instanceName);
  } else if (params.scope === 'instance' && params.scopeId) {
    instanceProfile = await getGuardrailProfile('instance', params.scopeId);
  }

  // 3. Fetch Campaign override (if campaignId provided)
  let campaignProfile = null;
  if (params.campaignId) {
    campaignProfile = await getGuardrailProfile('campaign', params.campaignId);
  } else if (params.scope === 'campaign' && params.scopeId) {
    campaignProfile = await getGuardrailProfile('campaign', params.scopeId);
  }

  const isStrict = Boolean(
    globalProfile?.strictMode ||
    instanceProfile?.strictMode ||
    campaignProfile?.strictMode
  );

  const { effective, sources } = resolveEffectiveConfig({
    global: globalProfile?.config || null,
    instance: instanceProfile?.config || null,
    campaign: campaignProfile?.config || null,
    strict: isStrict,
  });

  effectiveCache.set(cacheKey, { config: effective, timestamp: Date.now() });

  const maxVersion = Math.max(
    globalProfile?.version || 1,
    instanceProfile?.version || 1,
    campaignProfile?.version || 1
  );

  return {
    effective,
    sources,
    strictMode: isStrict,
    version: maxVersion,
  };
}
