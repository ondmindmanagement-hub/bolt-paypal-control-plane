import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';


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

test('synthetic order reconciliation demo clearly excludes PayPal calls', () => {
  assert.match(html, /SYNTHETIC_OFFLINE_ORDER_RECONCILIATION/);
  assert.match(html, /FAKE-DEMO-ORDER/);
  assert.match(html, /paypalApiCalls:0/);
  assert.match(html, /Order-state review/);
  assert.match(html, /PayPal Sandbox order/);
});

test('live browser code compares fictional status changes without external requests', () => {
  const begin=html.indexOf('<script>');
  const end=html.indexOf('</script>', begin);
  const code=html.slice(begin+'<script>'.length,end);
  assert.ok(begin>=0 && end>begin, 'Inline demo script must exist');
  const elements = {
    kind:{value:'payment'}, amount:{value:'20'}, currency:{value:'EUR'},
    run:{onclick:null}, out:{textContent:''},
    previousStatus:{value:'CREATED'}, currentStatus:{value:'APPROVED'},
    compare:{onclick:null}, reviewOut:{textContent:''}
  };
  runInNewContext(code, {
    document:{getElementById:id=>elements[id]},
    JSON, Number, String
  });
  const first = JSON.parse(elements.reviewOut.textContent);
  assert.equal(first.reviewRequired,true);
  assert.equal(first.executed,false);
  assert.equal(first.paypalApiCalls,0);
  assert.equal(typeof elements.compare.onclick,'function');
  elements.currentStatus.value='CREATED';
  elements.compare.onclick();
  const same=JSON.parse(elements.reviewOut.textContent);
  assert.equal(same.reviewRequired,false);
  assert.equal(same.executed,false);
});
