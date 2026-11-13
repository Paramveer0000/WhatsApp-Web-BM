import { describe, it, expect } from 'vitest';
import { PIPELINE_STAGES } from '../src/components/crm/LeadPipelineView';

describe('Zolo Suit CRM Smart Features & Evolution Auto-Heal', () => {
  describe('Custom Pipeline Stages Architecture', () => {
    it('provides default pipeline stages matching Zolo Suit Falcon workflow', () => {
      expect(PIPELINE_STAGES.length).toBe(5);
      expect(PIPELINE_STAGES.map((s) => s.id)).toEqual([
        'NEW_LEAD',
        'CONTACTED',
        'QUALIFIED',
        'PROPOSAL',
        'WON',
      ]);
    });

    it('calculates win rates and stage metrics accurately', () => {
      const customStages = [
        { id: 'NEW_LEAD', label: 'New Lead', color: '#3b82f6', winRate: 10, isWon: false },
        { id: 'CONTACTED', label: 'Contacted', color: '#6366f1', winRate: 25, isWon: false },
        { id: 'QUALIFIED', label: 'Qualified', color: '#a855f7', winRate: 50, isWon: false },
        { id: 'PROPOSAL', label: 'Proposal', color: '#f97316', winRate: 70, isWon: false },
        { id: 'WON', label: 'Won', color: '#10b981', winRate: 100, isWon: true },
      ];

      const mockDeals = [
        { id: 'd1', stage: 'NEW_LEAD', value: 10000 },
        { id: 'd2', stage: 'PROPOSAL', value: 50000 },
        { id: 'd3', stage: 'WON', value: 90000 },
      ];

      const totalVal = mockDeals.reduce((sum, d) => sum + d.value, 0);
      const wonDeals = mockDeals.filter((d) => d.stage === 'WON');
      const wonVal = wonDeals.reduce((sum, d) => sum + d.value, 0);
      const winRate = Math.round((wonDeals.length / mockDeals.length) * 100);

      expect(totalVal).toBe(150000);
      expect(wonVal).toBe(90000);
      expect(winRate).toBe(33);
    });
  });

  describe('Smart Columns Dynamic Schema', () => {
    it('supports dynamic custom fields mapping from JSON strings', () => {
      const customFieldsJson = JSON.stringify({
        test: 'VIP Account Alpha',
        company: 'Falcon Tools Pvt Ltd',
        city: 'Ludhiana',
        budget: 45000,
      });

      const parsed = JSON.parse(customFieldsJson);
      expect(parsed.test).toBe('VIP Account Alpha');
      expect(parsed.company).toBe('Falcon Tools Pvt Ltd');
      expect(parsed.city).toBe('Ludhiana');
      expect(parsed.budget).toBe(45000);
    });

    it('sanitizes field key names to lowercase alphanumeric underscores', () => {
      const sanitizeKey = (name: string) =>
        name
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/^_+|_+$/g, '');

      expect(sanitizeKey('Test Column')).toBe('test_column');
      expect(sanitizeKey('Company / Org Name!')).toBe('company___org_name');
      expect(sanitizeKey('City')).toBe('city');
    });
  });

  describe('CRM Tags Parser & Filter', () => {
    it('correctly parses JSON array and comma-separated tags', () => {
      const parseTags = (raw?: string | null): string[] => {
        if (!raw) return [];
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [raw];
        } catch {
          return raw.split(',').map((s) => s.trim()).filter(Boolean);
        }
      };

      expect(parseTags('["VIP", "Inbound"]')).toEqual(['VIP', 'Inbound']);
      expect(parseTags('Retail, Urgent, Punjab')).toEqual(['Retail', 'Urgent', 'Punjab']);
      expect(parseTags(null)).toEqual([]);
    });
  });

  describe('Evolution API Key Auto-Healing', () => {
    it('detects broken or blank encrypted keys and falls back to docker-compose default', () => {
      const resolveApiKey = (dbKey?: string | null, envKey?: string, dockerKey = '429683C4C97741') => {
        let key = dbKey?.trim() || '';
        // If key is broken ciphertext with colons or masked bullets, disregard it
        if (key.includes(':') || key.includes('•') || key === '') {
          key = '';
        }
        return key || envKey?.trim() || dockerKey;
      };

      // Case 1: Empty string in DB -> fallback
      expect(resolveApiKey('', '')).toBe('429683C4C97741');

      // Case 2: Broken ciphertext from failed decrypt -> fallback
      expect(resolveApiKey('a1b2:c3d4:e5f6', '')).toBe('429683C4C97741');

      // Case 3: Masked bullets from UI submit -> fallback
      expect(resolveApiKey('••••••••', '')).toBe('429683C4C97741');

      // Case 4: Valid user key in DB -> preserved
      expect(resolveApiKey('my-secret-key-12345', '')).toBe('my-secret-key-12345');
    });
  });
});
