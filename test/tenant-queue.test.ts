import { describe, it, expect, beforeEach } from 'vitest';
import {
  acquireInstanceLock,
  releaseInstanceLock,
  recordDispatchTelemetry,
  trackTenantInFlight,
  isTenantConcurrencyAvailable,
  getSystemLoadMetrics,
} from '../src/lib/queue/tenant-queue';

describe('Multi-Tenant Broadcast Queue & Engine Load Distribution', () => {
  beforeEach(() => {
    // Release any lingering locks
    releaseInstanceLock('test_inst_1');
    releaseInstanceLock('test_inst_2');
  });

  it('acquires exclusive instance lock and prevents collision between concurrent campaigns', () => {
    const acquired1 = acquireInstanceLock('test_inst_1', 'campaign_A', 'tenant_1', 10000);
    expect(acquired1).toBe(true);

    // Another campaign trying to use the same instance simultaneously must be blocked
    const acquired2 = acquireInstanceLock('test_inst_1', 'campaign_B', 'tenant_2', 10000);
    expect(acquired2).toBe(false);

    // Same campaign re-acquiring or refreshing lock should succeed
    const refreshed = acquireInstanceLock('test_inst_1', 'campaign_A', 'tenant_1', 10000);
    expect(refreshed).toBe(true);

    // Different instance should be acquirable by campaign B
    const acquiredOtherInst = acquireInstanceLock('test_inst_2', 'campaign_B', 'tenant_2', 10000);
    expect(acquiredOtherInst).toBe(true);
  });

  it('releases instance lock when broadcast or pacing cycle completes', () => {
    acquireInstanceLock('test_inst_1', 'campaign_A', 'tenant_1', 10000);
    releaseInstanceLock('test_inst_1', 'campaign_A');

    // After release, campaign B can now acquire it cleanly
    const acquired = acquireInstanceLock('test_inst_1', 'campaign_B', 'tenant_2', 10000);
    expect(acquired).toBe(true);
  });

  it('enforces fair-share per-tenant in-flight concurrency caps', () => {
    const testTenant = 'tenant_xyz';

    // Initial state: available
    expect(isTenantConcurrencyAvailable(testTenant)).toBe(true);

    // Simulate 5 concurrent in-flight jobs
    trackTenantInFlight(testTenant, 5);
    expect(isTenantConcurrencyAvailable(testTenant)).toBe(false);

    // Decrement by 1 job
    trackTenantInFlight(testTenant, -1);
    expect(isTenantConcurrencyAvailable(testTenant)).toBe(true);

    // Clean up
    trackTenantInFlight(testTenant, -4);
  });

  it('records message telemetry and computes system load metrics', async () => {
    recordDispatchTelemetry('test_inst_1', 'campaign_A', 'tenant_1');

    const metrics = await getSystemLoadMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.eventLoopHealth).toMatch(/OPTIMAL|DEGRADED|HIGH_LOAD/);
    expect(metrics.memory).toBeDefined();
    expect(metrics.memory.rssMb).toBeGreaterThan(0);
    expect(metrics.queue).toBeDefined();
    expect(metrics.queue.messagesPerMinute).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(metrics.tenants)).toBe(true);
    expect(Array.isArray(metrics.instances)).toBe(true);
  });
});

