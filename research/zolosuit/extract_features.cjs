const fs = require('fs');
const path = require('path');

const chunksDir = path.join(__dirname, 'raw_chunks');
const files = fs.readdirSync(chunksDir).filter((f) => f.endsWith('.js'));

const apiEndpoints = new Set();
const navLinks = new Set();
const featureFlags = new Set();
const stateKeys = new Set();
const componentNames = new Set();
const mutationKeywords = new Set();

const apiRegex = /["'](\/(?:api|v[0-9]|business|auth|admin)\/[a-zA-Z0-9_\-\/]+)["']/g;
const navRegex = /["'](\/business\/[a-zA-Z0-9_\-\/]+)["']/g;

for (const file of files) {
  const content = fs.readFileSync(path.join(chunksDir, file), 'utf8');

  let match;
  while ((match = apiRegex.exec(content)) !== null) {
    if (match[1].length < 80) apiEndpoints.add(match[1]);
  }

  while ((match = navRegex.exec(content)) !== null) {
    if (match[1].length < 60) navLinks.add(match[1]);
  }

  // Detect query / mutation keys
  const queryMatches = content.matchAll(/(?:useQuery|useMutation|queryKey|mutationKey)\s*[:\(]\s*\[?\s*["']([a-zA-Z0-9_\-]+)["']/g);
  for (const qm of queryMatches) {
    stateKeys.add(qm[1]);
  }

  // Detect feature names
  const featureMatches = content.matchAll(/["']([a-zA-Z0-9_]+_(?:enabled|feature|permission|access|status))["']/gi);
  for (const fm of featureMatches) {
    featureFlags.add(fm[1]);
  }
}

const summary = {
  totalChunksAnalyzed: files.length,
  navigationRoutes: Array.from(navLinks).sort(),
  apiEndpoints: Array.from(apiEndpoints).sort(),
  queryKeys: Array.from(stateKeys).sort(),
  detectedFeatures: Array.from(featureFlags).sort(),
};

fs.writeFileSync(path.join(__dirname, 'extracted_manifest.json'), JSON.stringify(summary, null, 2));
console.log('Manifest written successfully!');
console.log('Discovered routes:', summary.navigationRoutes.length);
console.log('Discovered API endpoints:', summary.apiEndpoints.length);
console.log('Discovered Query/State keys:', summary.queryKeys.length);
