import assert from 'node:assert';
import { db, getSettings, updateSettings } from '../server/db.js';
import { parseSpintax, substituteVariables, renderMessage, cleanPhoneNumber } from '../server/spintax.js';
import { EvolutionClient } from '../server/evolution.js';
import { queueManager } from '../server/queue.js';
import { evaluateTaskQuality } from '../server/quality.js';

console.log('--- RUNNING IN-MEMORY TESTS ---');

// 1. Test Spintax & Personalization
console.log('Testing Spintax parser...');
const spintaxStr = '{Hi|Hello|Dear} {name}, special discount of 20% for {company}!';
const rendered = renderMessage(spintaxStr, {
  name: 'Aarav',
  custom_variables: { company: 'TechCorp' }
});
console.log('Rendered message:', rendered);
assert(rendered.includes('Aarav'), 'Rendered message must include name');
assert(rendered.includes('TechCorp'), 'Rendered message must include company');
assert(rendered.startsWith('Hi') || rendered.startsWith('Hello') || rendered.startsWith('Dear'), 'Spintax must resolve');

// 2. Test Phone Cleaner & Deduplication
console.log('Testing Phone Cleaner...');
const testPhones = [
  { raw: '98765 43210', expected: '919876543210' },
  { raw: '+91-98765-43210', expected: '919876543210' },
  { raw: '09876543210', expected: '919876543210' },
  { raw: '00919876543210', expected: '919876543210' },
  { raw: '123', expectedValid: false }
];

for (const t of testPhones) {
  const result = cleanPhoneNumber(t.raw, '91');
  if (t.expectedValid === false) {
    assert.strictEqual(result.isValid, false, `Phone ${t.raw} should be invalid`);
  } else {
    assert.strictEqual(result.isValid, true, `Phone ${t.raw} should be valid`);
    assert.strictEqual(result.phone, t.expected, `Phone ${t.raw} expected ${t.expected}, got ${result.phone}`);
  }
}
console.log('Phone Cleaner tests passed!');

// 3. Test Database & Settings
console.log('Testing SQLite Database & Settings...');
const initialSettings = getSettings();
assert(initialSettings.default_country_code === '91', 'Default country code should be 91');

updateSettings({ test_key: 'test_val' });
const updated = getSettings();
assert.strictEqual(updated.test_key, 'test_val', 'Settings update should persist in SQLite');
console.log('Database settings tests passed!');

// 4. Test Evolution API Circuit Breaker Detection
console.log('Testing Evolution API Circuit Breaker Detection...');
const err401 = new Error('Unauthorized');
err401.status = 401;
assert(EvolutionClient.isCircuitBreakerError(err401), '401 status should trip circuit breaker');

const errClosed = new Error('Session closed: Connection lost with device');
assert(EvolutionClient.isCircuitBreakerError(errClosed), 'Session closed should trip circuit breaker');

const errStateClose = new Error('Instance connection state: close');
assert(EvolutionClient.isCircuitBreakerError(errStateClose), 'State close should trip circuit breaker');

const normalErr = new Error('Invalid number format for JID');
normalErr.status = 400;
assert(!EvolutionClient.isCircuitBreakerError(normalErr), '400 normal validation error should not trip circuit breaker');
console.log('Circuit breaker detection tests passed!');

// 5. Test Campaign Creation and SQLite Storage
console.log('Testing Campaign Queue Storage...');
const campId = 'test_camp_' + Date.now();
db.prepare(`
  INSERT INTO campaigns (id, name, instance_name, status, total_count, min_delay, max_delay, message_template, created_at)
  VALUES (?, 'Test Bulk 1', 'inst-main', 'draft', 2, 10, 20, 'Hello {name}', ?)
`).run(campId, new Date().toISOString());

db.prepare(`
  INSERT INTO recipients (campaign_id, phone, name, status)
  VALUES (?, '919876543210', 'Rahul', 'pending'),
         (?, '919876543211', 'Priya', 'pending')
`).run(campId, campId);

const stats = queueManager.getCampaignStats(campId);
assert.strictEqual(stats.total, 2, 'Total recipients should be 2');
assert.strictEqual(stats.pending, 2, 'Pending recipients should be 2');
assert.strictEqual(stats.sent, 0, 'Sent recipients should be 0');
console.log('Campaign Queue Storage tests passed!');

// 6. Test Evaluation & Quality Layer
console.log('Testing Evaluation & Quality Layer...');
const spamMessage = 'Congratulations! You won the lottery prize! Transfer money now for 100% free cash.';
const spamEval = evaluateTaskQuality(spamMessage, { name: 'Bob' }, {
  enable_spam_filter: '1',
  spam_blacklist: 'lottery, prize, free cash'
});
assert.strictEqual(spamEval.hasSpamRisk, true, 'Spam risk should be detected');
assert(spamEval.qualityScore < 70, 'Quality score should be penalized for spam triggers');

const cleanMessage = '{Hi|Hello} {name}, your monthly statement is ready for review.';
const cleanEval = evaluateTaskQuality(cleanMessage, { name: 'Alice' }, {
  enable_spam_filter: '1',
  spam_blacklist: 'lottery, prize, free cash'
});
assert.strictEqual(cleanEval.hasSpamRisk, false, 'Clean message should have no spam risk');
assert(cleanEval.qualityScore >= 80, 'Quality score should be high for good message');
assert.strictEqual(cleanEval.isQualityPassed, true, 'Clean message should pass quality');
console.log('Evaluation & Quality Layer tests passed!');

console.log('\n--- ALL UNIT TESTS PASSED SUCCESSFULLY! ---');

