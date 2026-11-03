/**
 * Evolution API v2 (Baileys Engine) Client
 */

export class EvolutionClient {
  constructor(apiUrl, apiKey) {
    this.apiUrl = (apiUrl || 'http://localhost:8080').replace(/\/+$/, '');
    this.apiKey = apiKey || '';
  }

  getHeaders() {
    return {
      'apikey': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  async request(endpoint, options = {}) {
    const url = `${this.apiUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 25000);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...(options.headers || {})
        },
        signal: controller.signal
      });

      const contentType = response.headers.get('content-type') || '';
      let data;
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
        const error = new Error(
          (data && (data.message || data.error || JSON.stringify(data))) ||
          `Evolution API HTTP ${response.status}: ${response.statusText}`
        );
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${options.timeoutMs || 25000}ms to ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fetch all instances
   */
  async fetchInstances() {
    return this.request('/instance/fetchInstances', {
      method: 'GET'
    });
  }

  /**
   * Create a new instance
   */
  async createInstance(instanceName, qrcode = true) {
    return this.request('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        qrcode: !!qrcode,
        integration: 'WHATSAPP-BAILEYS'
      })
    });
  }

  /**
   * Check connection state of an instance
   * Response: { instance: { instanceName: "...", state: "open" | "connecting" | "close" } }
   */
  async getConnectionState(instanceName) {
    return this.request(`/instance/connectionState/${encodeURIComponent(instanceName)}`, {
      method: 'GET'
    });
  }

  /**
   * Connect and fetch QR code
   */
  async getConnectQR(instanceName) {
    return this.request(`/instance/connect/${encodeURIComponent(instanceName)}`, {
      method: 'GET'
    });
  }

  /**
   * Check if phone numbers are registered on WhatsApp (Evaluation Layer)
   * Response: [ { exists: true, jid: "...", number: "..." } ]
   */
  async checkWhatsAppNumbers(instanceName, numbers) {
    const list = Array.isArray(numbers) ? numbers : [numbers];
    return this.request(`/chat/whatsappNumbers/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: JSON.stringify({ numbers: list })
    });
  }

  /**
   * Send typing status / presence
   */
  async sendPresence(instanceName, number, presence = 'composing', delay = 1200) {
    return this.request(`/chat/sendPresence/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: JSON.stringify({
        number,
        presence,
        delay
      })
    });
  }

  /**
   * Send text message (Standard Evolution API v2 schema)
   */
  async sendText(instanceName, number, text, options = {}) {
    const payload = {
      number,
      text,
      options: {
        delay: options.delay || 1200,
        presence: options.presence || 'composing'
      }
    };

    return this.request(`/message/sendText/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Helper to determine if an error triggers the circuit breaker
   */
  static isCircuitBreakerError(error) {
    if (!error) return false;
    
    // Unauthorized / Invalid API Key
    if (error.status === 401 || error.status === 403) return true;
    
    const msg = (error.message || '').toLowerCase();
    const dataMsg = typeof error.data === 'string' ? error.data.toLowerCase() : JSON.stringify(error.data || '').toLowerCase();
    const combined = `${msg} ${dataMsg}`;

    if (
      combined.includes('session closed') ||
      combined.includes('connection closed') ||
      combined.includes('state: close') ||
      combined.includes('not connected') ||
      combined.includes('unauthorized') ||
      combined.includes('instance not found') ||
      combined.includes('bad session') ||
      combined.includes('device disconnected') ||
      combined.includes('conflict')
    ) {
      return true;
    }

    return false;
  }
}

