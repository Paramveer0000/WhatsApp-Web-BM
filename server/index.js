import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { db, getSettings, updateSettings } from './db.js';
import { EvolutionClient } from './evolution.js';
import { queueManager } from './queue.js';
import { renderMessage, cleanPhoneNumber } from './spintax.js';
import { evaluateTaskQuality, evaluateWhatsAppNumber } from './quality.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to get an active Evolution Client from settings
function getEvolutionClient() {
  const settings = getSettings();
  return new EvolutionClient(settings.evolution_api_url, settings.global_api_key);
}

// ==========================================
// 1. Settings Routes
// ==========================================
app.get('/api/settings', (req, res) => {
  try {
    const settings = getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const updated = updateSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. Evolution API Routes
// ==========================================
app.get('/api/evolution/instances', async (req, res) => {
  try {
    const client = getEvolutionClient();
    const data = await client.fetchInstances();
    res.json({ success: true, instances: Array.isArray(data) ? data : (data.instances || []) });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message,
      details: err.data || null
    });
  }
});

app.post('/api/evolution/create', async (req, res) => {
  try {
    const { instanceName, qrcode } = req.body;
    if (!instanceName) {
      return res.status(400).json({ success: false, error: 'instanceName is required' });
    }
    const client = getEvolutionClient();
    const data = await client.createInstance(instanceName.trim(), qrcode ?? true);
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message,
      details: err.data || null
    });
  }
});

app.get('/api/evolution/state/:instanceName', async (req, res) => {
  try {
    const { instanceName } = req.params;
    const client = getEvolutionClient();
    const data = await client.getConnectionState(instanceName);
    const state = data?.instance?.state || (typeof data === 'string' ? data : 'unknown');
    res.json({ success: true, state, raw: data });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message,
      state: 'error'
    });
  }
});

app.get('/api/evolution/connect/:instanceName', async (req, res) => {
  try {
    const { instanceName } = req.params;
    const client = getEvolutionClient();
    const data = await client.getConnectQR(instanceName);
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({
      success: false,
      error: err.message
    });
  }
});

// ==========================================
// 3. Campaign Setup & Management Routes
// ==========================================
app.get('/api/campaigns', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM recipients WHERE campaign_id = c.id) as total_recipients,
        (SELECT COUNT(*) FROM recipients WHERE campaign_id = c.id AND status = 'sent') as sent_recipients,
        (SELECT COUNT(*) FROM recipients WHERE campaign_id = c.id AND status = 'failed') as failed_recipients,
        (SELECT COUNT(*) FROM recipients WHERE campaign_id = c.id AND status = 'pending') as pending_recipients
      FROM campaigns c
      ORDER BY datetime(c.created_at) DESC
    `).all();

    res.json({ success: true, campaigns: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/campaigns', (req, res) => {
  try {
    const {
      name,
      instanceName,
      messageTemplate,
      minDelay = 12,
      maxDelay = 25,
      simulateTyping = 1,
      recipients = []
    } = req.body;

    if (!name || !instanceName || !messageTemplate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, instanceName, and messageTemplate are required.'
      });
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one valid recipient is required.'
      });
    }

    const campaignId = 'camp_' + crypto.randomUUID();
    const now = new Date().toISOString();

    // Insert campaign record
    db.prepare(`
      INSERT INTO campaigns (
        id, name, instance_name, status, total_count, sent_count, failed_count,
        min_delay, max_delay, simulate_typing, message_template, created_at
      ) VALUES (?, ?, ?, 'draft', ?, 0, 0, ?, ?, ?, ?, ?)
    `).run(
      campaignId,
      name.trim(),
      instanceName.trim(),
      recipients.length,
      parseInt(minDelay, 10) || 12,
      parseInt(maxDelay, 10) || 25,
      simulateTyping ? 1 : 0,
      messageTemplate,
      now
    );

    // Insert recipients in batch
    const insertRecipient = db.prepare(`
      INSERT INTO recipients (
        campaign_id, phone, name, custom_variables, status
      ) VALUES (?, ?, ?, ?, 'pending')
    `);

    db.exec('BEGIN TRANSACTION');
    for (const r of recipients) {
      const customVarsJson = r.custom_variables
        ? (typeof r.custom_variables === 'string' ? r.custom_variables : JSON.stringify(r.custom_variables))
        : '{}';

      insertRecipient.run(
        campaignId,
        String(r.phone).trim(),
        r.name ? String(r.name).trim() : '',
        customVarsJson
      );
    }
    db.exec('COMMIT');

    const created = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    res.json({ success: true, campaign: created, totalRecipients: recipients.length });
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/campaigns/:id', (req, res) => {
  try {
    const { id } = req.params;
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const stats = queueManager.getCampaignStats(id);
    res.json({ success: true, campaign, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await queueManager.abortCampaign(id);
    db.prepare('DELETE FROM recipients WHERE campaign_id = ?').run(id);
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(id);
    res.json({ success: true, message: 'Campaign and recipients deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Campaign Queue Control endpoints
app.post('/api/campaigns/:id/start', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await queueManager.startCampaign(id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/campaigns/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await queueManager.pauseCampaign(id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/campaigns/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await queueManager.resumeCampaign(id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/campaigns/:id/abort', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await queueManager.abortCampaign(id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Recipients table with search, status filter, and pagination
app.get('/api/campaigns/:id/recipients', (req, res) => {
  try {
    const { id } = req.params;
    const { status, search, limit = 100, offset = 0 } = req.query;

    let query = 'SELECT * FROM recipients WHERE campaign_id = ?';
    const params = [id];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (phone LIKE ? OR name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY id ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const rows = db.prepare(query).all(...params);

    // Total count for filtered view
    let countQuery = 'SELECT COUNT(*) as count FROM recipients WHERE campaign_id = ?';
    const countParams = [id];
    if (status && status !== 'all') {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    if (search) {
      countQuery += ' AND (phone LIKE ? OR name LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }
    const countRes = db.prepare(countQuery).get(...countParams);

    res.json({
      success: true,
      recipients: rows,
      totalCount: countRes.count || 0
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// CSV Delivery Report Export
app.get('/api/campaigns/:id/export', (req, res) => {
  try {
    const { id } = req.params;
    const campaign = db.prepare('SELECT name FROM campaigns WHERE id = ?').get(id);
    const campaignName = campaign ? campaign.name.replace(/[^a-zA-Z0-9_-]/g, '_') : id;

    const rows = db.prepare(`
      SELECT phone, name, status, sent_at, error, evaluation_status, quality_score, quality_notes, rendered_message
      FROM recipients
      WHERE campaign_id = ?
      ORDER BY id ASC
    `).all(id);

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const clean = String(str).replace(/"/g, '""');
      return `"${clean}"`;
    };

    let csv = 'Recipient Name,Phone,Status,Evaluation Status,Quality Score,Quality Notes,Timestamp,Error Details,Rendered Message\n';
    for (const r of rows) {
      csv += [
        escapeCsv(r.name || ''),
        escapeCsv(r.phone),
        escapeCsv(r.status),
        escapeCsv(r.evaluation_status || 'unverified'),
        escapeCsv(r.quality_score ?? 100),
        escapeCsv(r.quality_notes || ''),
        escapeCsv(r.sent_at || ''),
        escapeCsv(r.error || ''),
        escapeCsv(r.rendered_message || '')
      ].join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="campaign_report_${campaignName}_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Message preview endpoint (evaluates spintax and variables for live UI)
app.post('/api/preview', (req, res) => {
  try {
    const { template, sampleRecipient = {} } = req.body;
    const settings = getSettings();
    const rendered = renderMessage(template, sampleRecipient, settings.missing_variable_fallback || 'Valued Customer');
    res.json({ success: true, preview: rendered });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test Evaluation & Quality Layer endpoint
app.post('/api/evaluate/test', async (req, res) => {
  try {
    const { template, recipient = {}, testPhone, instanceName } = req.body;
    const settings = getSettings();

    // 1. Content & Anti-Spam Evaluation
    const contentEval = evaluateTaskQuality(template || 'Hello {name}', recipient, settings);

    // 2. WhatsApp Number Existence Check (if testPhone and instanceName provided)
    let numberEval = null;
    if (testPhone && instanceName) {
      const client = getEvolutionClient();
      numberEval = await evaluateWhatsAppNumber(client, instanceName, testPhone);
    }

    res.json({
      success: true,
      contentEvaluation: contentEval,
      numberEvaluation: numberEval
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Server-Sent Events (SSE) for Real-Time Live Updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial connection handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ connected: true, timestamp: Date.now() })}\n\n`);

  queueManager.registerClient(res);

  // Send periodic keep-alive ping
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(pingInterval);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(pingInterval);
  });
});

// Static files (when built in production)
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Fallback for SPA routing in Express 5
app.use((req, res) => {
  if (!req.path.startsWith('/api') && fs.existsSync(path.join(distPath, 'index.html'))) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
  }
});

export { app };

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`WhatsApp Web Bulk Campaign server running on http://localhost:${PORT}`);
  });
}
