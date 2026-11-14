import { describe, it, expect } from 'vitest';
import { isTenantScoped, getTenantWhere, getTenantAllowedInstanceNames } from '../src/lib/tenant';
import { UserSession } from '../src/lib/auth';

describe('Multi-Tenant Database & Session Isolation', () => {
  const superAdminUser: UserSession = {
    id: 'admin_1',
    email: 'admin@platform.com',
    role: 'ADMIN',
  };

  const clientUserA: UserSession = {
    id: 'client_user_a',
    email: 'tenant_a@company.com',
    role: 'CLIENT',
    clientId: 'client_A',
    companyName: 'Company A',
    maxInstances: 2,
  };

  const clientUserB: UserSession = {
    id: 'client_user_b',
    email: 'tenant_b@company.com',
    role: 'CLIENT',
    clientId: 'client_B',
    companyName: 'Company B',
    maxInstances: 5,
  };

  const impersonatedClientSession: UserSession = {
    id: 'client_user_a',
    email: 'tenant_a@company.com',
    role: 'CLIENT',
    clientId: 'client_A',
    companyName: 'Company A',
    isImpersonating: true,
    originalAdminId: 'admin_1',
  };

  it('correctly identifies whether session is scoped to a client tenant', () => {
    expect(isTenantScoped(superAdminUser)).toBe(false);
    expect(isTenantScoped(clientUserA)).toBe(true);
    expect(isTenantScoped(clientUserB)).toBe(true);
    expect(isTenantScoped(impersonatedClientSession)).toBe(true);
  });

  it('generates strictly isolated where clauses for client tenants', () => {
    const whereA = getTenantWhere(clientUserA);
    expect(whereA).toEqual({ clientId: 'client_A' });

    const whereB = getTenantWhere(clientUserB);
    expect(whereB).toEqual({ clientId: 'client_B' });

    const whereImpersonated = getTenantWhere(impersonatedClientSession);
    expect(whereImpersonated).toEqual({ clientId: 'client_A' });

    const whereAdmin = getTenantWhere(superAdminUser);
    expect(whereAdmin).toEqual({});
  });

  it('enforces tenant instance boundary check', async () => {
    // Admin has access to all (returns null)
    const adminAllowed = await getTenantAllowedInstanceNames(superAdminUser);
    expect(adminAllowed).toBeNull();

    // Client returns a filtered array (or empty array if no instances yet)
    const clientAllowed = await getTenantAllowedInstanceNames(clientUserA);
    expect(Array.isArray(clientAllowed)).toBe(true);
  });
});
