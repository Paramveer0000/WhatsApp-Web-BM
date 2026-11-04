import client from 'prom-client';

// Create a single global Registry to avoid duplicates in development hot reloading
const globalRegistry = (global as any).__prometheus_registry__ || new client.Registry();
if (process.env.NODE_ENV !== 'production') {
  (global as any).__prometheus_registry__ = globalRegistry;
}

// Enable default Node.js runtime metrics (CPU, Memory, Event Loop)
client.collectDefaultMetrics({
  register: globalRegistry,
  prefix: 'whatsapp_campaign_',
});

export const messagesCounter =
  (global as any).__prom_messages_counter__ ||
  new client.Counter({
    name: 'whatsapp_messages_total',
    help: 'Total WhatsApp campaign messages by status and instance',
    labelNames: ['status', 'instance'],
    registers: [globalRegistry],
  });
(global as any).__prom_messages_counter__ = messagesCounter;

export const sendDurationHistogram =
  (global as any).__prom_send_duration__ ||
  new client.Histogram({
    name: 'whatsapp_send_duration_seconds',
    help: 'Duration of WhatsApp send requests in seconds',
    labelNames: ['instance', 'result'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    registers: [globalRegistry],
  });
(global as any).__prom_send_duration__ = sendDurationHistogram;

export const evolutionErrorsCounter =
  (global as any).__prom_evolution_errors__ ||
  new client.Counter({
    name: 'whatsapp_evolution_errors_total',
    help: 'Total Evolution API errors categorized by class',
    labelNames: ['class', 'instance'],
    registers: [globalRegistry],
  });
(global as any).__prom_evolution_errors__ = evolutionErrorsCounter;

export const circuitStateGauge =
  (global as any).__prom_circuit_state__ ||
  new client.Gauge({
    name: 'whatsapp_circuit_state',
    help: 'Circuit breaker state per instance (0 = closed/healthy, 1 = half-open, 2 = open/tripped)',
    labelNames: ['instance'],
    registers: [globalRegistry],
  });
(global as any).__prom_circuit_state__ = circuitStateGauge;

export const queueDepthGauge =
  (global as any).__prom_queue_depth__ ||
  new client.Gauge({
    name: 'whatsapp_queue_depth',
    help: 'Active queue depth per instance or campaign',
    labelNames: ['instance'],
    registers: [globalRegistry],
  });
(global as any).__prom_queue_depth__ = queueDepthGauge;

export const sseClientsGauge =
  (global as any).__prom_sse_clients__ ||
  new client.Gauge({
    name: 'whatsapp_sse_clients',
    help: 'Number of active Server-Sent Events subscribers',
    registers: [globalRegistry],
  });
(global as any).__prom_sse_clients__ = sseClientsGauge;

export { globalRegistry as registry };

