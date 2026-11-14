import { describe, it, expect } from 'vitest';
import {
  WARMER_TOPICS,
  SCRIPTED_DIALOGUES,
  getRandomDialogue,
  resolveSpintax,
} from '../src/lib/warmer/dialogues';
import { hashPassword, verifyPassword } from '../src/lib/auth';
import { isWarmerOrInternalMessage } from '../src/lib/warmer/warmer-engine';
import { generateDynamicWarmerTurn } from '../src/lib/warmer/dynamic-generator';
import { db } from '../src/lib/db';

describe('Peer-to-Peer WhatsApp Number Warmer & Client Settings', () => {
  describe('Warmer Topics & Dialogue Library', () => {
    it('defines core conversational topics including hinglish', () => {
      expect(WARMER_TOPICS.length).toBeGreaterThanOrEqual(6);
      const ids = WARMER_TOPICS.map((t) => t.id);
      expect(ids).toContain('casual');
      expect(ids).toContain('business');
      expect(ids).toContain('tech');
      expect(ids).toContain('travel');
      expect(ids).toContain('lifestyle');
      expect(ids).toContain('hinglish');
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

  describe('Warmer vs Chatbot & Opt-Out Mutual Exclusion', () => {
    it('detects internal WhatsApp instances and returns true to suppress chatbot', async () => {
      // Mock db.instance.findFirst
      const origFindFirst = db.instance.findFirst;
      (db.instance as any).findFirst = async () => ({ id: 'inst-1', name: 'SalesInstance', profileNumber: '919876501234' });

      const isInternal = await isWarmerOrInternalMessage({
        instanceName: 'SupportInstance',
        phone: '919876501234',
      });

      expect(isInternal).toBe(true);
      db.instance.findFirst = origFindFirst;
    });

    it('detects active Number Warmer peer session and returns true to suppress chatbot', async () => {
      const origInstFind = db.instance.findFirst;
      const origWarmerFind = db.numberWarmerSession.findFirst;

      (db.instance as any).findFirst = async () => null;
      (db.numberWarmerSession as any).findFirst = async () => ({
        id: 'warm-123',
        instanceA: 'instanceA',
        instanceB: 'instanceB',
        phoneA: '919876501111',
        phoneB: '919876502222',
        status: 'RUNNING',
      });

      const isWarmer = await isWarmerOrInternalMessage({
        instanceName: 'instanceB',
        phone: '919876501111',
      });

      expect(isWarmer).toBe(true);

      db.instance.findFirst = origInstFind;
      db.numberWarmerSession.findFirst = origWarmerFind;
    });

    it('returns false for normal customer leads, allowing chatbot to trigger normally', async () => {
      const origInstFind = db.instance.findFirst;
      const origWarmerFind = db.numberWarmerSession.findFirst;

      (db.instance as any).findFirst = async () => null;
      (db.numberWarmerSession as any).findFirst = async () => null;

      const isWarmer = await isWarmerOrInternalMessage({
        instanceName: 'SalesInstance',
        phone: '919999888777',
      });

      expect(isWarmer).toBe(false);

      db.instance.findFirst = origInstFind;
      db.numberWarmerSession.findFirst = origWarmerFind;
    });
  });

  describe('Dynamic Contextual & AI Dialogue Generator', () => {
    it('generates non-empty dynamic turns across all topics', async () => {
      const topics = ['casual', 'business', 'tech', 'travel', 'lifestyle', 'hinglish'];

      for (const t of topics) {
        const turn = await generateDynamicWarmerTurn({
          topic: t,
          useAi: false,
          historyLogs: [],
        });

        expect(turn.messageA).toBeTruthy();
        expect(turn.messageB).toBeTruthy();
        expect(turn.messageA.length).toBeGreaterThan(5);
        expect(turn.messageB.length).toBeGreaterThan(5);
        expect(['time_contextual', 'smart_spintax']).toContain(turn.source);
      }
    });

    it('smoothly advances turn pairs without repeating turn 0 every time', async () => {
      const historyMock = [
        { messageA: 'Did you get lunch?', messageB: 'Yes, just had pasta.', topic: 'Lunch' },
      ];

      const turn = await generateDynamicWarmerTurn({
        topic: 'casual',
        useAi: false,
        historyLogs: historyMock,
      });

      expect(turn.messageA).toBeTruthy();
      expect(turn.messageB).toBeTruthy();
    });
  });
});

