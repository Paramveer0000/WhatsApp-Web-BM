import { EventEmitter } from 'node:events';

class CampaignEventsBus extends EventEmitter {
  private static instance: CampaignEventsBus;

  private constructor() {
    super();
    this.setMaxListeners(200);
  }

  static getInstance(): CampaignEventsBus {
    if (!CampaignEventsBus.instance) {
      CampaignEventsBus.instance = new CampaignEventsBus();
    }
    return CampaignEventsBus.instance;
  }

  broadcast(event: string, data: any) {
    this.emit('sse', { event, data, timestamp: new Date().toISOString() });
  }

  emitLog(campaignId: string, log: any) {
    this.broadcast('log', { campaignId, ...log });
  }

  emitProgress(campaignId: string, stats: any) {
    this.broadcast('progress', { campaignId, stats });
  }

  emitJitter(campaignId: string, countdown: number, totalWait: number, nextPhone?: string) {
    this.broadcast('jitter', { campaignId, countdown, totalWait, nextPhone });
  }

  emitCircuitBreaker(campaignId: string, reason: string) {
    this.broadcast('circuit_breaker', { campaignId, reason });
  }
}

export const eventBus = CampaignEventsBus.getInstance();

