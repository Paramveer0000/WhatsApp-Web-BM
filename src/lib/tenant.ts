import { UserSession } from './auth';
import { db } from './db';

/**
 * Checks if the current user session is scoped to a specific tenant/client
 * (either a real client login or an admin in impersonation mode)
 */
export function isTenantScoped(user: UserSession | null): boolean {
  if (!user) return false;
  return user.role === 'CLIENT' || Boolean(user.clientId);
}

/**
 * Gets the active tenant/client identifier for stamping created records
 */
export function getActiveTenantId(user: UserSession | null): string | null {
  if (!user) return null;
  return user.clientId || null;
}

/**
 * Generates Prisma `where` clause for tenant isolation:
 * - If user is CLIENT or impersonating: strictly scopes to `{ [field]: user.clientId }`
 * - If user is Platform Admin (not impersonating): returns `{}` (or platform-level records)
 */
export function getTenantWhere(
  user: UserSession | null,
  field: string = 'clientId',
  options: { allowAdminAll?: boolean } = { allowAdminAll: true }
): Record<string, any> {
  if (!user) return { [field]: '__UNAUTHORIZED__' };

  if (isTenantScoped(user)) {
    return { [field]: user.clientId };
  }

  // Super Admin
  if (options.allowAdminAll) {
    return {};
  }
  return { [field]: null };
}

/**
 * Retrieves the list of WhatsApp instance names owned by the active tenant.
 * - If tenant-scoped: returns `string[]` of only their instances.
 * - If Super Admin: returns `null` (meaning all instances are accessible).
 */
export async function getTenantAllowedInstanceNames(user: UserSession | null): Promise<string[] | null> {
  if (!user) return [];

  if (isTenantScoped(user)) {
    const instances = await db.instance.findMany({
      where: { clientId: user.clientId },
      select: { name: true },
    });
    return instances.map((i) => i.name);
  }

  // Admin has access to all instances
  return null;
}
