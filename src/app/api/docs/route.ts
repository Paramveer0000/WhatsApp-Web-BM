export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'BulkFlow Enterprise WhatsApp Campaign API',
    version: '2.0.0',
    description:
      'High-throughput, crash-safe, observable REST API for consent-based WhatsApp campaigns on Evolution API v2.',
  },
  servers: [{ url: '/', description: 'Current Server' }],
  paths: {
    '/api/campaigns': {
      get: {
        summary: 'List Campaigns',
        responses: { 200: { description: 'Array of campaigns with real-time aggregates' } },
      },
      post: {
        summary: 'Create Campaign',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  instanceIds: { type: 'array', items: { type: 'string' } },
                  contactListIds: { type: 'array', items: { type: 'string' } },
                  variants: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        content: { type: 'string' },
                        mediaType: { type: 'string', enum: ['text', 'image', 'video', 'document'] },
                        mediaUrl: { type: 'string' },
                        fileName: { type: 'string' },
                      },
                    },
                  },
                  minDelay: { type: 'integer', default: 12 },
                  maxDelay: { type: 'integer', default: 25 },
                  simulateTyping: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created campaign record' } },
      },
    },
    '/api/campaigns/{id}/control': {
      post: {
        summary: 'Pause, Resume, or Abort Campaign',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  action: { type: 'string', enum: ['start', 'pause', 'resume', 'abort'] },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Status updated' } },
      },
    },
    '/api/evolution/instances': {
      get: { summary: 'List WhatsApp Instances and connection states' },
      post: {
        summary: 'Create and pair WhatsApp Instance via QR Code',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { instanceName: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    '/api/contacts/import': {
      post: {
        summary: 'Stream-import contacts from CSV/XLSX with E.164 normalization',
      },
    },
    '/api/contacts/sample': {
      get: {
        summary: 'Download sample contact file template (.csv or .xlsx)',
        parameters: [{ name: 'format', in: 'query', schema: { type: 'string', enum: ['csv', 'xlsx'] } }],
      },
    },
    '/api/replies': {
      get: { summary: 'List conversation threads or specific contact history' },
      post: {
        summary: 'Send manual WhatsApp reply to contact',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  phone: { type: 'string' },
                  text: { type: 'string' },
                  instanceName: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    '/api/metrics': {
      get: { summary: 'Prometheus metrics exporter' },
    },
    '/api/health': {
      get: { summary: 'Liveness probe' },
    },
    '/api/ready': {
      get: { summary: 'Readiness probe (Database & Redis)' },
    },
  },
};

export async function GET() {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>BulkFlow WhatsApp API Docs</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0b141a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .topbar { display: none; }
    .swagger-ui .info .title { color: #10b981; }
    .swagger-ui { filter: invert(88%) hue-rotate(180deg); }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        spec: ${JSON.stringify(OPENAPI_SPEC)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
      });
    };
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
