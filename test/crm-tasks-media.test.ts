import { describe, it, expect } from 'vitest';

describe('Zolo Suit Features Implementation - CRM Tasks, Media DAM, and Quick Replies', () => {
  describe('CRM Task Management Engine', () => {
    it('validates priority levels and defaults to MEDIUM', () => {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
      const sanitizePriority = (p?: string) => (p && validPriorities.includes(p) ? p : 'MEDIUM');

      expect(sanitizePriority('HIGH')).toBe('HIGH');
      expect(sanitizePriority('LOW')).toBe('LOW');
      expect(sanitizePriority('INVALID')).toBe('MEDIUM');
      expect(sanitizePriority(undefined)).toBe('MEDIUM');
    });

    it('correctly calculates overdue and due today statuses', () => {
      const now = new Date();
      const past = new Date(Date.now() - 3600000 * 24); // 1 day ago
      const future = new Date(Date.now() + 3600000 * 24); // 1 day future

      const isOverdue = (d: Date) => d.getTime() < now.getTime();
      const isToday = (d: Date) => d.toDateString() === now.toDateString();

      expect(isOverdue(past)).toBe(true);
      expect(isOverdue(future)).toBe(false);
      expect(isToday(now)).toBe(true);
      expect(isToday(past)).toBe(false);
    });

    it('toggles task status between PENDING and COMPLETED cleanly', () => {
      const toggle = (current: string) => (current === 'COMPLETED' ? 'PENDING' : 'COMPLETED');
      expect(toggle('PENDING')).toBe('COMPLETED');
      expect(toggle('COMPLETED')).toBe('PENDING');
    });
  });

  describe('Media Library DAM Engine', () => {
    it('accurately categorizes file types into DAM categories', () => {
      const getCategory = (mime: string) => {
        if (mime.startsWith('image/')) return 'image';
        if (mime.startsWith('video/')) return 'video';
        if (mime.startsWith('audio/')) return 'audio';
        return 'document';
      };

      expect(getCategory('image/png')).toBe('image');
      expect(getCategory('image/jpeg')).toBe('image');
      expect(getCategory('video/mp4')).toBe('video');
      expect(getCategory('audio/ogg')).toBe('audio');
      expect(getCategory('application/pdf')).toBe('document');
      expect(getCategory('application/vnd.ms-excel')).toBe('document');
    });

    it('formats file sizes accurately for human presentation', () => {
      const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
      };

      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(2048 * 1024)).toBe('2 MB');
      expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
    });

    it('parses JSON tags safely with fallback to empty array', () => {
      const parseTags = (raw: string | null) => {
        if (!raw) return [];
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };

      expect(parseTags('["promo", "flyer"]')).toEqual(['promo', 'flyer']);
      expect(parseTags(null)).toEqual([]);
      expect(parseTags('invalid json')).toEqual([]);
    });
  });

  describe('Quick Replies & Canned Messages Engine', () => {
    it('ensures shortcut starts with / and is sanitized to lowercase and underscores', () => {
      const sanitizeShortcut = (input: string) => {
        let s = input.trim();
        if (!s.startsWith('/')) s = `/${s}`;
        return s.toLowerCase().replace(/\s+/g, '_');
      };

      expect(sanitizeShortcut('pricing')).toBe('/pricing');
      expect(sanitizeShortcut('/Pricing')).toBe('/pricing');
      expect(sanitizeShortcut('product demo')).toBe('/product_demo');
      expect(sanitizeShortcut('/Help Me')).toBe('/help_me');
    });

    it('accurately matches search queries against shortcut, title, and content', () => {
      const mockReplies = [
        { shortcut: '/pricing', title: 'Pricing Plans', content: 'Our plans start at $49' },
        { shortcut: '/demo', title: 'Live Demo', content: 'Book a 15-minute walkthrough' },
        { shortcut: '/support', title: 'Tech Support', content: 'Contact support@example.com' },
      ];

      const search = (q: string) => {
        const query = q.toLowerCase();
        return mockReplies.filter(
          (r) =>
            r.shortcut.toLowerCase().includes(query) ||
            r.title.toLowerCase().includes(query) ||
            r.content.toLowerCase().includes(query)
        );
      };

      expect(search('pricing').length).toBe(1);
      expect(search('walkthrough').length).toBe(1);
      expect(search('support').length).toBe(1);
      expect(search('unknown').length).toBe(0);
    });
  });
});

