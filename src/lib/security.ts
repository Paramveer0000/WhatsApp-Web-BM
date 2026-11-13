import { URL } from 'url';

/**
 * SSRF Protection Validator
 * Ensures outbound HTTP requests cannot target internal networks, AWS/GCP/Azure metadata services,
 * loopback addresses, or non-http(s) protocols.
 */
export function isSafeUrl(urlString: string): { safe: boolean; reason?: string } {
  if (!urlString || typeof urlString !== 'string') {
    return { safe: false, reason: 'URL must be a non-empty string' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return { safe: false, reason: 'Malformed URL' };
  }

  // 1. Only allow HTTP and HTTPS protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: `Disallowed protocol: ${parsed.protocol}. Only http and https are permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Block Localhost and Loopback Hostnames
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { safe: false, reason: `Access to internal host "${hostname}" is blocked to prevent SSRF.` };
  }

  // 3. Block Cloud Metadata IP (AWS, GCP, Azure, DigitalOcean)
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal' || hostname === 'instance-data') {
    return { safe: false, reason: 'Access to cloud instance metadata service is strictly blocked.' };
  }

  // 4. Block Private RFC1918 and Link-Local IPv4 Ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octet1 = parseInt(ipv4Match[1], 10);
    const octet2 = parseInt(ipv4Match[2], 10);

    // 10.0.0.0/8
    if (octet1 === 10) {
      return { safe: false, reason: 'Private IP range 10.0.0.0/8 is blocked.' };
    }
    // 172.16.0.0/12
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
      return { safe: false, reason: 'Private IP range 172.16.0.0/12 is blocked.' };
    }
    // 192.168.0.0/16
    if (octet1 === 192 && octet2 === 168) {
      return { safe: false, reason: 'Private IP range 192.168.0.0/16 is blocked.' };
    }
    // 127.0.0.0/8 (Loopback)
    if (octet1 === 127) {
      return { safe: false, reason: 'Loopback range 127.0.0.0/8 is blocked.' };
    }
    // 169.254.0.0/16 (Link Local)
    if (octet1 === 169 && octet2 === 254) {
      return { safe: false, reason: 'Link-local range 169.254.0.0/16 is blocked.' };
    }
    // 0.0.0.0/8
    if (octet1 === 0) {
      return { safe: false, reason: 'Current network 0.0.0.0/8 is blocked.' };
    }
  }

  return { safe: true };
}

/**
 * CSV / Excel Formula Injection Sanitizer (CWE-1236)
 * Prepends a single quote to prevent spreadsheet software from evaluating formulas
 * starting with =, +, -, @, \t, or \r.
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (!str) return '';

  const firstChar = str.charAt(0);
  if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@' || firstChar === '\t' || firstChar === '\r') {
    return `'${str}`;
  }

  return str;
}

