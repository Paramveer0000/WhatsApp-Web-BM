import http from 'node:http';

const PORT = 8080;
const instances = new Map<string, { name: string; state: string; owner?: string; webhook?: string }>();

// Seed a mock instance
instances.set('primary-marketing', {
  name: 'primary-marketing',
  state: 'open',
  owner: '919876543210@s.whatsapp.net',
});

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  res.setHeader('Content-Type', 'application/json');

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', async () => {
    let parsedBody: any = {};
    try {
      if (body) parsedBody = JSON.parse(body);
    } catch {}

    console.log(`[Mock Evolution API] ${req.method} ${pathname}`);

    // 1. Fetch Instances
    if (pathname === '/instance/fetchInstances' && req.method === 'GET') {
      const list = Array.from(instances.values()).map((inst) => ({
        instance: {
          instanceName: inst.name,
          state: inst.state,
          owner: inst.owner,
          profileName: 'BulkFlow Marketing',
          profilePicUrl: null,
        },
      }));
      res.writeHead(200);
      return res.end(JSON.stringify(list));
    }

    // 2. Create Instance
    if (pathname === '/instance/create' && req.method === 'POST') {
      const name = parsedBody.instanceName || `inst-${Date.now()}`;
      instances.set(name, {
        name,
        state: 'connecting',
      });
      res.writeHead(201);
      return res.end(
        JSON.stringify({
          instance: { instanceName: name, state: 'connecting' },
          hash: 'mock-hash',
          qrcode: {
            base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            code: '2@MOCK_PAIRING_CODE',
          },
        })
      );
    }

    // 3. Connection State
    if (pathname.startsWith('/instance/connectionState/') && req.method === 'GET') {
      const name = decodeURIComponent(pathname.replace('/instance/connectionState/', ''));
      const inst = instances.get(name) || { name, state: 'open' };
      res.writeHead(200);
      return res.end(JSON.stringify({ instance: { instanceName: name, state: inst.state } }));
    }

    // 4. Connect / QR
    if (pathname.startsWith('/instance/connect/') && req.method === 'GET') {
      const name = decodeURIComponent(pathname.replace('/instance/connect/', ''));
      const inst = instances.get(name);
      if (inst) {
        // Automatically simulate scan and connect after a few seconds!
        setTimeout(() => {
          inst.state = 'open';
          inst.owner = '919876543210@s.whatsapp.net';
        }, 4000);
      }
      res.writeHead(200);
      return res.end(
        JSON.stringify({
          base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          code: '2@MOCK_PAIRING_CODE',
        })
      );
    }

    // 5. Restart / Logout / Delete Instance
    if (pathname.startsWith('/instance/restart/') && (req.method === 'POST' || req.method === 'PUT')) {
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'SUCCESS', message: 'Instance restarted' }));
    }
    if (pathname.startsWith('/instance/logout/') && req.method === 'DELETE') {
      const name = decodeURIComponent(pathname.replace('/instance/logout/', ''));
      const inst = instances.get(name);
      if (inst) inst.state = 'close';
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'SUCCESS', message: 'Logged out' }));
    }
    if (pathname.startsWith('/instance/delete/') && req.method === 'DELETE') {
      const name = decodeURIComponent(pathname.replace('/instance/delete/', ''));
      instances.delete(name);
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'SUCCESS', message: 'Instance deleted' }));
    }

    // 6. Set Webhook
    if (pathname.startsWith('/webhook/set/') && req.method === 'POST') {
      const name = decodeURIComponent(pathname.replace('/webhook/set/', ''));
      const inst = instances.get(name);
      const webhookUrl = parsedBody.webhook?.url || parsedBody.url;
      if (inst) inst.webhook = webhookUrl;
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'SUCCESS', webhook: parsedBody }));
    }

    // 7. Check WhatsApp Numbers
    if (pathname.startsWith('/chat/whatsappNumbers/') && req.method === 'POST') {
      const numbers = Array.isArray(parsedBody.numbers) ? parsedBody.numbers : [parsedBody.numbers];
      const results = numbers.map((num: string) => {
        // Numbers ending in '00' or '999' simulate numbers not registered on WhatsApp for evaluation testing
        const exists = !num.endsWith('00') && !num.endsWith('999');
        return {
          number: num,
          exists,
          jid: exists ? `${num}@s.whatsapp.net` : null,
        };
      });
      res.writeHead(200);
      return res.end(JSON.stringify(results));
    }

    // 8. Presence Simulation
    if (pathname.startsWith('/chat/sendPresence/') && req.method === 'POST') {
      res.writeHead(200);
      return res.end(JSON.stringify({ status: 'SUCCESS', presence: parsedBody.presence }));
    }

    // 9. Send Text Message
    if (pathname.startsWith('/message/sendText/') && req.method === 'POST') {
      const msgId = `MOCK_MSG_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Simulate webhook delivery receipt after 1 second if webhook registered
      const instName = decodeURIComponent(pathname.replace('/message/sendText/', ''));
      const inst = instances.get(instName);
      if (inst?.webhook) {
        setTimeout(async () => {
          try {
            await fetch(inst.webhook!, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'messages.update',
                instance: instName,
                data: [
                  {
                    key: { id: msgId, remoteJid: `${parsedBody.number}@s.whatsapp.net` },
                    update: { status: 'DELIVERY_ACK' },
                  },
                ],
              }),
            });
          } catch {}
        }, 1200);
      }

      res.writeHead(201);
      return res.end(
        JSON.stringify({
          key: {
            remoteJid: `${parsedBody.number}@s.whatsapp.net`,
            fromMe: true,
            id: msgId,
          },
          message: { conversation: parsedBody.text },
          messageTimestamp: Math.floor(Date.now() / 1000),
          status: 'PENDING',
        })
      );
    }

    // 10. Send Media Message
    if (pathname.startsWith('/message/sendMedia/') && req.method === 'POST') {
      const msgId = `MOCK_MEDIA_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      res.writeHead(201);
      return res.end(
        JSON.stringify({
          key: {
            remoteJid: `${parsedBody.number}@s.whatsapp.net`,
            fromMe: true,
            id: msgId,
          },
          message: { imageMessage: { caption: parsedBody.caption } },
          status: 'PENDING',
        })
      );
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: `Mock endpoint ${pathname} not found` }));
  });
});

server.listen(PORT, () => {
  console.log(`[Mock Evolution API v2] Server running on http://localhost:${PORT}`);
  console.log(`Initial mock instance available: "primary-marketing"`);
});

