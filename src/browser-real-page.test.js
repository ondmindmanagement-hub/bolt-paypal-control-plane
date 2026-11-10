// Regression suite against the complete upstream docs/index.html,
// rather than a separately maintained copy of its JavaScript.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { evaluatePaymentAction } from './policy.js';

const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length, 1, 'Expect exactly one known inline script; fail if the page changes');
assert.ok(!/<script\s[^>]*src\s*=/i.test(html), 'No third-party script');
const code = scripts[0][1];
assert.ok(!/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/.test(code), 'Public offline demo cannot contact PayPal');

function makePage({ amount='20', currency='EUR', kind='payment', prior='CREATED', current='APPROVED' } = {}) {
  const elements = {
    kind: { value: kind }, amount: { value: amount }, currency: { value: currency },
    previousStatus: { value: prior }, currentStatus: { value: current },
    out: { textContent: '' }, reviewOut: { textContent: '' },
    run: { onclick: null }, compare: { onclick: null }
  };
  const context = vm.createContext({
    document: { getElementById(id) { assert.ok(id in elements, `Unknown DOM id: ${id}`); return elements[id]; } },
    JSON, Number, String
  });
  vm.runInContext(code, context, { timeout: 600, filename: 'published-docs/index.html#inline-script' });
  const evaluate = candidate => {
    context.__qa_input = candidate;
    return JSON.parse(vm.runInContext('JSON.stringify(evaluate(__qa_input))', context, {timeout:600}));
  };
  return { elements, context, evaluate, result: () => JSON.parse(elements.out.textContent),
    review: () => JSON.parse(elements.reviewOut.textContent),
    run: () => vm.runInContext('run()', context, {timeout:600}),
    compare: () => vm.runInContext('compareFictionalOrder()',context,{timeout:600}) };
}

// Exact-value, type and failure-path parity between browser code and Node policy.
const amounts = [true,false,null,'20','1e2','0x20',' 20 ',[20],{},0,-1,0.001,1.234,
                 20,0.01,499.99,500,500.01,Infinity,NaN,-Infinity,-0,1.005,19.999,
                 0.1,0.3,0.30000000000000004,1e-7,1e20];
for (const amount of amounts) {
  test(`full HTML parity for amount ${String(amount)}`, () => {
    const candidate = { kind:'payment', amount, currency:'EUR' };
    const b = makePage().evaluate(candidate), n = evaluatePaymentAction(candidate);
    assert.equal(b.decision, n.decision);
    assert.equal(b.reason, n.reason);
  });
}
for (const kind of ['payment','refund','PAYMENT','transfer','',null,undefined,['payment'],{}]) {
  test(`full HTML parity for action kind ${String(kind)}`, () => {
    const candidate={kind,amount:20,currency:'EUR'};
    assert.deepEqual(makePage().evaluate(candidate), evaluatePaymentAction(candidate));
  });
}
for (const currency of ['USD','EUR','GBP','usd','eur','foo',null,22,['EUR'],{},true]) {
  test(`full HTML parity for currency ${String(currency)}`,()=>{
    const candidate={kind:'refund',amount:20,currency};
    assert.deepEqual(makePage().evaluate(candidate), evaluatePaymentAction(candidate));
  });
}
for(const raw of ['20','20.55','1e2','0x20','20.555','001','-1','',' 20 ','500.01','0.01','500','0','Infinity','NaN','0.001','1.005','1e-7']) {
  test(`full HTML run() preserves strict input semantics ${JSON.stringify(raw)}`,()=>{
    const page=makePage({amount:raw});
    const output=page.result();
    const safeAmounts=new Set(['20','20.55','0.01','500']);
    assert.equal(output.policy.decision,safeAmounts.has(raw)?'approval_required':'deny');
    assert.equal(output.executed,false);
  });
}
test('full HTML after button actions never executes payment, refund or PayPal call',()=>{
  const page=makePage();
  page.elements.amount.value='900'; page.run();
  assert.equal(page.result().policy.decision,'deny');
  assert.equal(page.result().executed,false);
  page.elements.amount.value='20'; page.elements.kind.value='refund'; page.run();
  assert.equal(page.result().policy.decision,'approval_required');
  assert.equal(page.result().executed,false);
  page.elements.currentStatus.value='COMPLETED';page.compare();
  assert.equal(page.review().reviewRequired,true);
  assert.equal(page.review().paypalApiCalls,0);
  assert.equal(page.review().executed,false);
  page.elements.currentStatus.value='CREATED';page.compare();
  assert.equal(page.review().reviewRequired,false);
});

test('full-page markup retains truthful Sandbox and fictional-data disclaimers',()=>{
  assert.match(html,/No payments, refunds or PayPal API calls occur on this page/);
  assert.match(html,/Fictional data only/);
  assert.match(html,/not been performed or independently verified/i);
  assert.match(html,/aria-live="polite"/);
});
