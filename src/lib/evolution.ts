import { db } from './db';
import { decrypt } from './crypto';
import { logger } from './logger';

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

export class EvolutionClient {
  private apiUrl: string;
  private apiKey: string;

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
    // In Docker, localhost:8080 or 127.0.0.1 is unreachable - fall back to evolution container
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
    };
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

    let lastError: any;

    // Try up to 2 passes with a brief pause between rounds if all hosts failed initially
    for (let round = 1; round <= 2; round++) {
      for (const host of candidateHosts) {
        const url = `${host}${ep}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

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
            const msg = (data && (data.message || data.error || JSON.stringify(data))) || `HTTP ${response.status}: ${response.statusText}`;
            const err: any = new Error(msg);
            err.status = response.status;
            err.data = data;
            throw err;
          }

          this.apiUrl = host;
          return data as T;
        } catch (err: any) {
          lastError = err;
          // If server returned an HTTP error code (e.g. 400 Bad Request, 401 Unauthorized), don't retry other hosts
          if (err.status) throw err;
        } finally {
          clearTimeout(timeout);
        }
      }

      if (round === 1) {
        // Brief 1.5s pause before second attempt in case container is completing healthcheck or boot
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    throw lastError || new Error(`Failed to connect to Evolution API at ${this.apiUrl}`);
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
    return this.request(`/instance/restart/${encodeURIComponent(instanceName)}`, {
      method: 'PUT',
    });
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

  // 2. Webhook Registration
  async setWebhook(instanceName: string, webhookUrl: string, secret?: string): Promise<any> {
    return this.request(`/webhook/set/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: JSON.stringify({
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        events: [
          'CONNECTION_UPDATE',
          'MESSAGES_UPDATE',
          'MESSAGES_UPSERT',
        ],
        headers: secret ? { 'x-webhook-secret': secret } : undefined,
      }),
    });
  }

  // 3. Message Dispatch (supporting flat delay and options wrapper)
  async sendText(instanceName: string, number: string, text: string, options: SendTextOptions = {}): Promise<any> {
    const payload = {
      number,
      text,
      delay: options.delay || 1200,
      options: {
        delay: options.delay || 1200,
        presence: options.presence || 'composing',
      },
    };

    return this.request(`/message/sendText/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendMedia(instanceName: string, number: string, options: SendMediaOptions): Promise<any> {
    const payload = {
      number,
      mediatype: options.mediaType,
      mimetype: options.mimetype,
      caption: options.caption || '',
      media: options.media,
      fileName: options.fileName || 'file',
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

  // 4. Circuit Breaker Helper
  static isCircuitBreakerError(error: any): boolean {
    if (!error) return false;
    if (error.status === 401 || error.status === 403) return true;

    const msg = (error.message || '').toLowerCase();
    const dataMsg = typeof error.data === 'string' ? error.data.toLowerCase() : JSON.stringify(error.data || '').toLowerCase();
    const combined = `${msg} ${dataMsg}`;

    return (
      combined.includes('session closed') ||
      combined.includes('connection closed') ||
      combined.includes('state: close') ||
      combined.includes('not connected') ||
      combined.includes('unauthorized') ||
      combined.includes('bad session') ||
      combined.includes('device disconnected') ||
      combined.includes('instance not found')
    );
  }
}
