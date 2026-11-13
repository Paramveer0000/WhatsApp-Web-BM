const fs = require('fs');
const path = require('path');

const chunksDir = path.join(__dirname, 'raw_chunks');
const files = fs.readdirSync(chunksDir).filter((f) => f.endsWith('.js'));

console.log(`Analyzing ${files.length} JavaScript chunks...`);

const routes = new Set();
const apiCalls = new Set();
const components = new Set();
const hooks = new Set();

for (const file of files) {
  const code = fs.readFileSync(path.join(chunksDir, file), 'utf8');

  // Find routes
  const routeRegex = /\/business\/([a-zA-Z0-9_\-\/]+)/g;
  let match;
  while ((match = routeRegex.exec(code)) !== null) {
    if (match[1].length < 40 && !match[1].includes('.')) {
      routes.add('/business/' + match[1]);
    }
  }

  // Find API endpoints
  const apiRegex = /\/(api|v1|backend)\/([a-zA-Z0-9_\-\/]+)/g;
  while ((match = apiRegex.exec(code)) !== null) {
    if (match[2].length < 50 && !match[2].includes('.')) {
      apiCalls.add('/' + match[1] + '/' + match[2]);
    }
  }

  // Find React components
  const compRegex = /function\s+([A-Z][a-zA-Z0-9]+)\s*\(/g;
  while ((match = compRegex.exec(code)) !== null) {
    if (match[1].length < 35) {
      components.add(match[1]);
    }
  }

  // Find custom hooks
  const hookRegex = /\b(use[A-Z][a-zA-Z0-9]+)\b/g;
  while ((match = hookRegex.exec(code)) !== null) {
    if (match[1].length < 30) {
      hooks.add(match[1]);
    }
  }
}

const report = [
  '# Zolo Suit Deep Extraction & Inventory',
  '',
  '## 1. Discovered Frontend Routes',
  Array.from(routes).sort().map((r) => `- \`${r}\``).join('\n'),
  '',
  '## 2. Discovered API Endpoints & Backends',
  Array.from(apiCalls).sort().map((a) => `- \`${a}\``).join('\n'),
  '',
  '## 3. Discovered React Hooks & State Controllers',
  Array.from(hooks).sort().slice(0, 50).map((h) => `- \`${h}\``).join('\n'),
  '',
  '## 4. Key Discovered Components',
  Array.from(components).sort().slice(0, 50).map((c) => `- \`${c}\``).join('\n'),
].join('\n');

fs.writeFileSync(path.join(__dirname, 'EVIDENCE_INVENTORY.md'), report, 'utf8');
console.log('EVIDENCE_INVENTORY.md generated successfully!');

