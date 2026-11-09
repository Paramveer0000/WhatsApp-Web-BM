import { describe, it, expect } from 'vitest';
import { isSafeUrl, sanitizeCsvCell } from '../src/lib/security';

describe('Security Controls & Hardening', () => {
  describe('SSRF Protection (isSafeUrl)', () => {
    it('allows valid public HTTPS and HTTP URLs', () => {
      expect(isSafeUrl('https://api.github.com/events').safe).toBe(true);
      expect(isSafeUrl('https://webhook.site/my-uuid').safe).toBe(true);
      expect(isSafeUrl('http://example.com/api').safe).toBe(true);
    });

    it('blocks localhost and loopback hostnames', () => {
      expect(isSafeUrl('http://localhost:3000/api').safe).toBe(false);
      expect(isSafeUrl('http://127.0.0.1:8080').safe).toBe(false);
      expect(isSafeUrl('http://0.0.0.0:80').safe).toBe(false);
      expect(isSafeUrl('http://subdomain.localhost').safe).toBe(false);
    });

    it('blocks cloud metadata endpoint 169.254.169.254 and google internal', () => {
      expect(isSafeUrl('http://169.254.169.254/latest/meta-data/').safe).toBe(false);
      expect(isSafeUrl('http://metadata.google.internal/computeMetadata/v1/').safe).toBe(false);
    });

    it('blocks private RFC1918 subnets (10.x, 172.16-31.x, 192.168.x)', () => {
      expect(isSafeUrl('http://10.0.1.5:8080/secret').safe).toBe(false);
      expect(isSafeUrl('http://172.16.0.10:3000').safe).toBe(false);
      expect(isSafeUrl('http://172.24.5.1:5000').safe).toBe(false);
      expect(isSafeUrl('http://192.168.1.1').safe).toBe(false);
    });

    it('rejects disallowed non-http protocols (file, ftp, gopher)', () => {
      expect(isSafeUrl('file:///etc/passwd').safe).toBe(false);
      expect(isSafeUrl('gopher://127.0.0.1:70/').safe).toBe(false);
      expect(isSafeUrl('ftp://example.com/file').safe).toBe(false);
    });
  });

  describe('CSV / Excel Formula Injection (CWE-1236)', () => {
    it('prepends a single quote to cells beginning with dangerous characters', () => {
      expect(sanitizeCsvCell('=1+1')).toBe("'=1+1");
      expect(sanitizeCsvCell('+cmd|/c calc')).toBe("'+cmd|/c calc");
      expect(sanitizeCsvCell('-5+2')).toBe("'-5+2");
      expect(sanitizeCsvCell('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
      expect(sanitizeCsvCell('\tmalicious')).toBe("'\tmalicious");
    });

    it('leaves safe values untouched', () => {
      expect(sanitizeCsvCell('Rahul Sharma')).toBe('Rahul Sharma');
      expect(sanitizeCsvCell('919876543210')).toBe('919876543210');
      expect(sanitizeCsvCell('Acme Corp Ltd')).toBe('Acme Corp Ltd');
      expect(sanitizeCsvCell('')).toBe('');
      expect(sanitizeCsvCell(null)).toBe('');
    });
  });
});
