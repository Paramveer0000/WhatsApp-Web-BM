/**
 * Edge-compatible JWT verification utility.
 * Pure Web standard API (crypto.subtle, TextEncoder, atob) with ZERO Node.js runtime dependencies.
 * Designed specifically for Next.js Middleware and Edge runtime execution.
 */

export interface UserSessionEdge {
  id: string;
  email: string;
  name?: string | null;
  role: 'ADMIN' | 'OPERATOR' | 'RESELLER' | 'CLIENT';
  clientId?: string | null;
  companyName?: string | null;
  planName?: string | null;
  maxInstances?: number;
  monthlyMsgCap?: number;
  hasCrmPipeline?: boolean;
  hasChatbot?: boolean;
  hasMultiWarmup?: boolean;
  hasDamMedia?: boolean;
  hasAiResponder?: boolean;
  isImpersonating?: boolean;
  originalAdminId?: string | null;
  exp?: number;
  iat?: number;
}

export function getJwtSecretEdge(): string {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0) {
      return process.env.JWT_SECRET.trim();
    }
    if (process.env.APP_SECRET && process.env.APP_SECRET.trim().length > 0) {
      return process.env.APP_SECRET.trim();
    }
  }
  return 'bulkflow-production-jwt-stable-secret-2026-v2';
}

/**
 * Verify a JWT string using Web Crypto API.
 * 100% Edge-safe: No Node.js 'crypto', 'fs', 'path', or external packages required.
 */
export async function verifyTokenEdge(
  token: string,
  secret: string = getJwtSecretEdge()
): Promise<UserSessionEdge | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    // Resolve Web Crypto SubtleCrypto
    const subtle =
      typeof crypto !== 'undefined' && crypto.subtle
        ? crypto.subtle
        : (globalThis as any).crypto?.subtle;

    if (!subtle) {
      return null;
    }

    const enc = new TextEncoder();
    const key = await subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = enc.encode(`${headerB64}.${payloadB64}`);
    const sigStr = sigB64.replace(/-/g, '+').replace(/_/g, '/');
    const sigPad = sigStr.padEnd(sigStr.length + ((4 - (sigStr.length % 4)) % 4), '=');
    const sigBytes = Uint8Array.from(atob(sigPad), (c) => c.charCodeAt(0));

    const isValid = await subtle.verify('HMAC', key, sigBytes, data);
    if (!isValid) return null;

    const payloadPad = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const payloadJson = atob(payloadPad.padEnd(payloadPad.length + ((4 - (payloadPad.length % 4)) % 4), '='));
    const payload = JSON.parse(payloadJson);

    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    return payload as UserSessionEdge;
  } catch {
    return null;
  }
}
