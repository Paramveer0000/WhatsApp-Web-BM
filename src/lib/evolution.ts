import { db } from './db';
import { decrypt } from './crypto';
import { logger } from './logger';
import { evolutionErrorsCounter, circuitStateGauge } from './metrics';
import { resolveMediaUrlForEvolution } from './media';

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
}

export interface SendTextOptions {
  delay?: number;
  presence?: 'composing' | 'available';
  quoted?: any;
}

export interface SendMediaOptions {
  mediaType: 'image' | 'video' | 'document' | 'audio';
  mimetype: string;
  caption?: string;
  media: string; // URL or base64
  fileName?: string;
  delay?: number;
}

// -------------------------------------------------------------
// Error Taxonomy (Section 5)
// -------------------------------------------------------------
export class EvolutionError extends Error {
  public status?: number;
  public data?: any;
  public code?: string;
  public number?: string;
  public jid?: string;
  public isPermanent: boolean = false;

  constructor(
    message: string,
    status?: number,
    data?: any,
    options?: { code?: string; number?: string; jid?: string; isPermanent?: boolean }
  ) {
    super(message);
    this.name = 'EvolutionError';
    this.status = status;
    this.data = data;
    this.code = options?.code;
    this.number = options?.number;
    this.jid = options?.jid;
    this.isPermanent = options?.isPermanent ?? false;
  }
}

export class AuthError extends EvolutionError {
  constructor(message: string, status = 401, data?: any) {
    super(message, status, data, { code: 'AUTH_ERROR', isPermanent: true });
    this.name = 'AuthError';
  }
}

export class InstanceNotFoundError extends EvolutionError {
  constructor(message: string, status = 404, data?: any) {
    super(message, status, data, { code: 'INSTANCE_NOT_FOUND', isPermanent: true });
    this.name = 'InstanceNotFoundError';
  }
}

export class SessionClosedError extends EvolutionError {
  constructor(message: string, status = 400, data?: any) {
    super(message, status, data, { code: 'SESSION_CLOSED', isPermanent: true });
    this.name = 'SessionClosedError';
  }
}

export class InvalidRecipientError extends EvolutionError {
  constructor(
    message: string,
    status = 400,
    data?: any,
    options?: { number?: string; jid?: string; code?: string }
  ) {
    super(message, status, data, {
      code: options?.code || 'NOT_ON_WHATSAPP',
      number: options?.number,
      jid: options?.jid,
      isPermanent: true,
    });
    this.name = 'InvalidRecipientError';
  }
}

export class PermanentError extends EvolutionError {
  constructor(message: string, status = 400, data?: any) {
    super(message, status, data, { code: 'PERMANENT_ERROR', isPermanent: true });
    this.name = 'PermanentError';
  }
}

export class RateLimitedError extends EvolutionError {
  constructor(message: string, status = 429, data?: any) {
    super(message, status, data, { code: 'RATE_LIMITED', isPermanent: false });
    this.name = 'RateLimitedError';
  }
}

export class TransientError extends EvolutionError {
  constructor(message: string, status = 500, data?: any) {
    super(message, status, data, { code: 'TRANSIENT_ERROR', isPermanent: false });
    this.name = 'TransientError';
  }
}

export class UnknownError extends EvolutionError {
  constructor(message: string, status = 500, data?: any) {
    super(message, status, data, { code: 'UNKNOWN_ERROR', isPermanent: false });
    this.name = 'UnknownError';
  }
}

// -------------------------------------------------------------
// Circuit Breaker State Machine per Instance
// -------------------------------------------------------------
export class CircuitBreaker {
  private static states = new Map<
    string,
    { state: 'closed' | 'open' | 'half-open'; failures: number; lastProbe: number }
  >();

  static getState(instance: string): 'closed' | 'open' | 'half-open' {
    const record = this.states.get(instance) || { state: 'closed', failures: 0, lastProbe: 0 };
    // Half-open probe after 30 seconds
    if (record.state === 'open' && Date.now() - record.lastProbe > 30000) {
      record.state = 'half-open';
      record.lastProbe = Date.now();
      this.states.set(instance, record);
    }

    try {
      circuitStateGauge.set(
        { instance },
        record.state === 'closed' ? 0 : record.state === 'half-open' ? 1 : 2
      );
    } catch {}

    return record.state;
  }

  static recordSuccess(instance: string) {
    this.states.set(instance, { state: 'closed', failures: 0, lastProbe: Date.now() });
    try {
      circuitStateGauge.set({ instance }, 0);
    } catch {}
  }

  static recordFailure(instance: string, isSessionClosed = false) {
    const record = this.states.get(instance) || { state: 'closed', failures: 0, lastProbe: 0 };
    record.failures += 1;
    record.lastProbe = Date.now();
    if (isSessionClosed || record.failures >= 3) {
      record.state = 'open';
    }
    this.states.set(instance, record);
    try {
      circuitStateGauge.set({ instance }, record.state === 'open' ? 2 : 1);
    } catch {}
  }
}

export class EvolutionClient {
  private apiUrl: string;
  private apiKey: string;
  private serverVersion: string = 'v2';

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = (apiUrl || 'http://evolution:8080').replace(/\/+$/, '');
    this.apiKey = apiKey || '';
  }

  getApiUrl(): string {
    return this.apiUrl;
  }

  static async fromDatabase(): Promise<EvolutionClient> {
    const urlSetting = await db.setting.findUnique({ where: { key: 'EVOLUTION_API_URL' } });
    const keySetting = await db.setting.findUnique({ where: { key: 'GLOBAL_API_KEY' } });

    let apiUrl = urlSetting?.value;
    if (!apiUrl || apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
      apiUrl = process.env.EVOLUTION_API_URL || 'http://evolution:8080';
    }

    let apiKey = keySetting?.value;
    if (keySetting?.isEncrypted && apiKey) {
      apiKey = decrypt(apiKey);
    }
    if (!apiKey) {
      apiKey = process.env.GLOBAL_API_KEY || '429683C4C97741';
    }

    return new EvolutionClient(apiUrl, apiKey);
  }

  private getHeaders(): Record<string, string> {
    return {
      apikey: this.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'BulkFlow-Manager/2.0',
    };
  }

  static classifyError(status?: number, data?: any, originalMessage?: string): EvolutionError {
    let cleanMsg = '';
    let extractedNumber: string | undefined;
    let extractedJid: string | undefined;

    // Check array in data.message or data.response.message
    const msgArray = Array.isArray(data?.message)
      ? data.message
      : Array.isArray(data?.response?.message)
      ? data.response.message
      : null;

    if (msgArray) {
      cleanMsg = msgArray
        .map((m: any) => {
          if (typeof m === 'object' && m !== null) {
            if (m.exists === false) {
              extractedNumber = m.number || (m.jid ? String(m.jid).split('@')[0] : undefined);
              extractedJid = m.jid;
              return `Phone ${extractedNumber || ''} is not registered on WhatsApp`;
            }
            return JSON.stringify(m);
          }
          return String(m);
        })
        .join(', ');
    } else if (typeof data?.message === 'string') {
      cleanMsg = data.message;
    } else if (typeof data?.response?.message === 'string') {
      cleanMsg = data.response.message;
    } else if (data?.error) {
      cleanMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    }

    if (!cleanMsg || cleanMsg === '[object Object]') {
      if (typeof data?.error === 'string') {
        cleanMsg = data.error;
      } else {
        cleanMsg = originalMessage || 'Evolution API request failed';
      }
    }

    const msg = cleanMsg;
    const lower = msg.toLowerCase();
    const dataStr = JSON.stringify(data || '').toLowerCase();
    const combined = `${lower} ${dataStr}`;

    // 1. Auth Error
    if (status === 401 || status === 403) {
      return new AuthError(msg, status, data);
    }

    // 2. Instance Not Found
    if (
      status === 404 ||
      combined.includes('instance not found') ||
      combined.includes('instance does not exist')
    ) {
      return new InstanceNotFoundError(msg, status || 404, data);
    }

    // 3. Rate Limited
    if (status === 429 || combined.includes('rate limit') || combined.includes('too many requests')) {
      return new RateLimitedError(msg, status, data);
    }

    // 4. Session Closed
    if (
      status === 428 ||
      combined.includes('device_removed') ||
      combined.includes('session closed') ||
      combined.includes('connection closed') ||
      combined.includes('not connected') ||
      combined.includes('device disconnected') ||
      combined.includes('bad session')
    ) {
      return new SessionClosedError(msg, status || 400, data);
    }

    // 5. Invalid Recipient (Not on WhatsApp)
    if (
      extractedNumber ||
      combined.includes('exists:false') ||
      combined.includes('exists: false') ||
      combined.includes('exists":false') ||
      combined.includes('exists": false') ||
      combined.includes('is not on whatsapp') ||
      combined.includes('not registered on whatsapp') ||
      combined.includes('number not exists') ||
      combined.includes('does not exist on whatsapp') ||
      combined.includes('invalid number') ||
      combined.includes('not on whatsapp') ||
      combined.includes('contact not found')
    ) {
      return new InvalidRecipientError(msg, status || 400, data, {
        number: extractedNumber,
        jid: extractedJid,
      });
    }

    // 6. Transient Server Errors & Timeouts
    if (
      (status && status >= 500) ||
      combined.includes('timeout') ||
      combined.includes('timed out') ||
      combined.includes('aborted') ||
      combined.includes('econnreset') ||
      combined.includes('fetch failed')
    ) {
      return new TransientError(msg, status || 500, data);
    }

    // 7. Unknown 400 Client Errors are Permanent by default
    if (status && status >= 400 && status < 500) {
      logger.warn({ status, data, msg }, 'Unrecognized 400 client error from Evolution API treated as permanent');
      return new PermanentError(msg, status, data);
    }

    return new UnknownError(msg, status, data);
  }

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    const candidateHosts: string[] = [];
    const pushHost = (h: string) => {
      const trimmed = (h || '').replace(/\/+$/, '');
      if (trimmed && !candidateHosts.includes(trimmed)) candidateHosts.push(trimmed);
    };

    pushHost(this.apiUrl);
    if (this.apiUrl.includes('evolution-api:8080')) {
      pushHost(this.apiUrl.replace('evolution-api:8080', 'evolution:8080'));
      pushHost(this.apiUrl.replace('evolution-api:8080', 'whatsapp_evolution_api:8080'));
    } else if (this.apiUrl.includes('evolution:8080')) {
      pushHost(this.apiUrl.replace('evolution:8080', 'evolution-api:8080'));
      pushHost(this.apiUrl.replace('evolution:8080', 'whatsapp_evolution_api:8080'));
    }
    pushHost('http://evolution:8080');
    pushHost('http://evolution-api:8080');
    pushHost('http://whatsapp_evolution_api:8080');

    // Only add host/localhost fallbacks if running outside Docker (local dev)
    const isDocker = process.env.NODE_ENV === 'production' || this.apiUrl.includes('evolution');
    if (!isDocker) {
      pushHost('http://host.docker.internal:8081');
      pushHost('http://host.docker.internal:8080');
      pushHost('http://172.17.0.1:8081');
      pushHost('http://172.17.0.1:8080');
      pushHost('http://localhost:8081');
      pushHost('http://localhost:8080');
      pushHost('http://127.0.0.1:8081');
      pushHost('http://127.0.0.1:8080');
    }

    let lastError: any;

    for (let round = 1; round <= 2; round++) {
      for (const host of candidateHosts) {
        const url = `${host}${ep}`;
        const isMediaOrLarge =
          ep.includes('sendMedia') || (typeof options.body === 'string' && options.body.length > 30000);
        const timeoutMs = isMediaOrLarge ? 60000 : 15000;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          logger.debug({ url, method: options.method || 'GET', round }, 'Evolution API request');

          const response = await fetch(url, {
            ...options,
            headers: {
              ...this.getHeaders(),
              ...(options.headers as Record<string, string> || {}),
            },
            signal: controller.signal,
          });

          const contentType = response.headers.get('content-type') || '';
          let data: any;

          if (contentType.includes('application/json')) {
            data = await response.json();
          } else {
            const text = await response.text();
            try {
              data = JSON.parse(text);
            } catch {
              data = { text };
            }
          }

          if (!response.ok) {
            const classified = EvolutionClient.classifyError(response.status, data);
            try {
              evolutionErrorsCounter.inc({ class: classified.name, instance: host });
            } catch {}
            throw classified;
          }

          this.apiUrl = host;
          return data as T;
        } catch (err: any) {
          lastError = err instanceof EvolutionError ? err : EvolutionClient.classifyError(undefined, undefined, err.message);
          // If permanent client error, throw immediately and do not loop other hosts
          if (
            err?.isPermanent ||
            err instanceof AuthError ||
            err instanceof InvalidRecipientError ||
            err instanceof InstanceNotFoundError ||
            err instanceof PermanentError ||
            err instanceof SessionClosedError
          ) {
            throw err;
          }
        } finally {
          clearTimeout(timeout);
        }
      }

      if (round === 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    throw lastError || new TransientError(`Failed to reach Evolution API at ${this.apiUrl}`);
  }

  // 1. Instance Operations
  async fetchInstances(): Promise<any[]> {
    const res = await this.request('/instance/fetchInstances', { method: 'GET' });
    return Array.isArray(res) ? res : (res.instances || []);
  }

  async createInstance(instanceName: string, qrcode: boolean = true): Promise<any> {
    return this.request('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        qrcode,
        integration: 'WHATSAPP-BAILEYS',
      }),
    });
  }

  async getConnectionState(instanceName: string): Promise<string> {
    try {
      const res = await this.request(`/instance/connectionState/${encodeURIComponent(instanceName)}`, {
        method: 'GET',
      });
      return res?.instance?.state || res?.state || 'CLOSE';
    } catch {
      return 'CLOSE';
    }
  }

  async getConnectQR(instanceName: string): Promise<{ base64?: string; code?: string; raw: any }> {
    const data = await this.request(`/instance/connect/${encodeURIComponent(instanceName)}`, {
      method: 'GET',
    });

    let base64: string | undefined;
    let code: string | undefined;

    if (data?.base64) base64 = data.base64;
    else if (data?.qrcode?.base64) base64 = data.qrcode.base64;
    else if (typeof data === 'string' && data.startsWith('data:image')) base64 = data;

    if (data?.code) code = data.code;
    else if (data?.qrcode?.code) code = data.qrcode.code;

    if (base64 && !base64.startsWith('data:image')) {
      base64 = `data:image/png;base64,${base64}`;
    }

    return { base64, code, raw: data };
  }

  async restartInstance(instanceName: string): Promise<any> {
    try {
      return await this.request(`/instance/restart/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
      });
    } catch (err: any) {
      if (err?.message?.includes('Cannot POST') || err?.status === 404) {
        return await this.request(`/instance/restart/${encodeURIComponent(instanceName)}`, {
          method: 'PUT',
        });
      }
      throw err;
    }
  }

  async logoutInstance(instanceName: string): Promise<any> {
    return this.request(`/instance/logout/${encodeURIComponent(instanceName)}`, {
      method: 'DELETE',
    });
  }

  async deleteInstance(instanceName: string): Promise<any> {
    return this.request(`/instance/delete/${encodeURIComponent(instanceName)}`, {
      method: 'DELETE',
    });
  }

  // 2. Webhook Registration (Evolution API v2 nested schema & v1 backward compatibility)
  async setWebhook(instanceName: string, webhookUrl: string, secret?: string): Promise<any> {
    const webhookConfig = {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      events: [
        'CONNECTION_UPDATE',
        'MESSAGES_UPDATE',
        'MESSAGES_UPSERT',
      ],
      headers: secret ? { 'x-webhook-secret': secret } : undefined,
    };

    return this.request(`/webhook/set/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: JSON.stringify({
        webhook: webhookConfig,
        ...webhookConfig,
      }),
    });
  }

  // 3. Message Dispatch (Supporting both flat and nested options adapters)
  async sendText(instanceName: string, number: string, text: string, options: SendTextOptions = {}): Promise<any> {
    const delay = options.delay || 1200;
    const payload = {
      number,
      text,
      delay,
      options: {
        delay,
        presence: options.presence || 'composing',
      },
    };

    return this.request(`/message/sendText/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendMedia(instanceName: string, number: string, options: SendMediaOptions): Promise<any> {
    const ext =
      options.mimetype === 'image/jpeg'
        ? 'jpg'
        : options.mimetype === 'image/png'
        ? 'png'
        : options.mimetype === 'video/mp4'
        ? 'mp4'
        : 'pdf';
    const cleanFileName =
      options.fileName && options.fileName.includes('.') ? options.fileName : `media_${Date.now()}.${ext}`;

    const resolved = await resolveMediaUrlForEvolution(options.media, cleanFileName);

    const payload = {
      number,
      mediatype: options.mediaType,
      mimetype: resolved.mimetype || options.mimetype,
      caption: options.caption || '',
      media: resolved.resolvedUrl,
      fileName: resolved.fileName,
      delay: options.delay || 1200,
    };

    return this.request(`/message/sendMedia/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendPresence(instanceName: string, number: string, presence: 'composing' | 'available' = 'composing', delay: number = 1500): Promise<any> {
    return this.request(`/chat/sendPresence/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: JSON.stringify({
        number,
        presence,
        delay,
      }),
    });
  }

  async checkWhatsAppNumbers(instanceName: string, numbers: string[]): Promise<Array<{ exists: boolean; jid?: string; number: string }>> {
    const res = await this.request(`/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: JSON.stringify({ numbers }),
    });

    return Array.isArray(res) ? res : (res?.numbers || []);
  }

  // 4. Chat & Message History Retrieval
  async findChats(instanceName: string): Promise<any[]> {
    try {
      const res = await this.request(`/chat/findChats/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return Array.isArray(res) ? res : (res?.chats || []);
    } catch (e: any) {
      logger.warn({ err: e.message, instanceName }, 'findChats failed');
      return [];
    }
  }

  async findMessages(instanceName: string, remoteJid: string, page = 1, offset = 50): Promise<any[]> {
    try {
      const res = await this.request(`/chat/findMessages/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        body: JSON.stringify({
          where: {
            key: {
              remoteJid,
            },
          },
          page,
          offset,
        }),
      });
      return Array.isArray(res) ? res : (res?.messages?.records || res?.records || []);
    } catch (e: any) {
      logger.warn({ err: e.message, instanceName, remoteJid }, 'findMessages failed');
      return [];
    }
  }

  // Helper for circuit breaker classification
  static isCircuitBreakerError(error: any): boolean {
    return error instanceof AuthError || error instanceof SessionClosedError;
  }
}
