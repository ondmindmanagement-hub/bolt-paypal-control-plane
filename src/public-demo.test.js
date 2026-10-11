import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
const paypal = readFileSync(new URL('./paypal.js', import.meta.url), 'utf8');

test('public browser demo does not claim autonomous execution or allow payment', () => {
  assert.match(html, /approval_required/);
  assert.doesNotMatch(html, /decision:'allow'/);
  assert.match(html, /executed:false/);
  assert.match(html, /PayPal Sandbox is not contacted/);
});
test('PayPal helper is hard-coded to sandbox endpoint and never a dynamic host', () => {
  assert.match(paypal,/https:\/\/api-m\.sandbox\.paypal\.com/);
  assert.doesNotMatch(paypal,/PAYPAL_API_BASE/);
});
