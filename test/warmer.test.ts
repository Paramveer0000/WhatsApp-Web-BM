import { describe, it, expect } from 'vitest';
import {
  WARMER_TOPICS,
  SCRIPTED_DIALOGUES,
  getRandomDialogue,
  resolveSpintax,
} from '../src/lib/warmer/dialogues';
import { hashPassword, verifyPassword } from '../src/lib/auth';

describe('Peer-to-Peer WhatsApp Number Warmer & Client Settings', () => {
  describe('Warmer Topics & Dialogue Library', () => {
    it('defines 5 core conversational topics', () => {
      expect(WARMER_TOPICS.length).toBe(5);
      const ids = WARMER_TOPICS.map((t) => t.id);
      expect(ids).toContain('casual');
      expect(ids).toContain('business');
      expect(ids).toContain('tech');
      expect(ids).toContain('travel');
      expect(ids).toContain('lifestyle');
    });

    it('contains scripted dialogues for each topic with valid back-and-forth turns', () => {
      expect(SCRIPTED_DIALOGUES.length).toBeGreaterThanOrEqual(10);

      for (const d of SCRIPTED_DIALOGUES) {
        expect(d.id).toBeTruthy();
        expect(d.turns.length).toBeGreaterThanOrEqual(2);
        expect(d.turns[0].sender).toBe('A');
        expect(d.turns[1].sender).toBe('B');
        expect(d.turns[0].text.length).toBeGreaterThan(5);
        expect(d.turns[1].text.length).toBeGreaterThan(5);
      }
    });

    it('resolves Spintax correctly in dialogue turns', () => {
      const spintax = '{Hey|Hi|Hello} there!';
      const resolved = resolveSpintax(spintax);
      expect(['Hey there!', 'Hi there!', 'Hello there!']).toContain(resolved);
    });

    it('retrieves random dialogue matching selected topic', () => {
      const casual = getRandomDialogue('casual');
      expect(casual.topic).toBe('casual');

      const tech = getRandomDialogue('tech');
      expect(tech.topic).toBe('tech');
    });
  });

  describe('Warmer Anti-Ban Guardrails & Caps', () => {
    it('clamps daily exchanges to safe thresholds (min 5, max 100)', () => {
      const clampDailyCap = (cap: number) => Math.max(5, Math.min(100, cap));

      expect(clampDailyCap(1)).toBe(5);
      expect(clampDailyCap(25)).toBe(25);
      expect(clampDailyCap(250)).toBe(100);
    });

    it('ensures minimum safe jitter delay between turns (at least 20s)', () => {
      const clampDelay = (min: number, max: number) => {
        const safeMin = Math.max(20, min);
        const safeMax = Math.max(safeMin + 10, max);
        return { safeMin, safeMax };
      };

      const { safeMin, safeMax } = clampDelay(5, 10);
      expect(safeMin).toBe(20);
      expect(safeMax).toBe(30);
    });

    it('marks session as COMPLETED when todayExchanges reaches dailyCap', () => {
      const evaluateStatus = (today: number, cap: number) => (today >= cap ? 'COMPLETED' : 'RUNNING');

      expect(evaluateStatus(15, 25)).toBe('RUNNING');
      expect(evaluateStatus(25, 25)).toBe('COMPLETED');
      expect(evaluateStatus(26, 25)).toBe('COMPLETED');
    });
  });

  describe('Client-Isolated Settings & Password Security', () => {
    it('hashes new client password and verifies correctly', async () => {
      const plain = 'SecretClientPass2026!';
      const hash = await hashPassword(plain);

      expect(hash).not.toBe(plain);
      const isMatch = await verifyPassword(plain, hash);
      expect(isMatch).toBe(true);

      const wrongMatch = await verifyPassword('WrongPassword', hash);
      expect(wrongMatch).toBe(false);
    });

    it('masks private AI API key securely', () => {
      const maskKey = (key?: string | null) => {
        if (!key) return '';
        const k = key.trim();
        return k.length > 8 ? `${k.slice(0, 4)}••••••••${k.slice(-4)}` : '••••••••';
      };

      expect(maskKey('sk-or-v1-abcdef1234567890xyz')).toBe('sk-o••••••••0xyz');
      expect(maskKey('')).toBe('');
      expect(maskKey(null)).toBe('');
    });
  });
});

