import test from 'node:test';
import assert from 'node:assert/strict';
import { createSandboxOrder } from './paypal.js';

// All tests replace global fetch BEFORE calling the helper. No real PayPal
// API, payment credentials, or real Sandbox order creation is involved.
const BAD_AMOUNTS = [
  true, false, [20], {value:20}, '20', '0x10', '1e2', '1.005',
  'not a number', -1, 0, 0.001, 500.01, 1e9,
  NaN, Infinity, -Infinity, null, undefined, 0.30000000000000004
];

for (const amount of BAD_AMOUNTS) {
  test('sandbox helper blocks invalid input before OAuth: '+String(amount), async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error('NETWORK_MUST_NOT_BE_CALLED'); };
    try {
      await assert.rejects(createSandboxOrder({ amount, currency: 'EUR' }),
        { message: 'SANDBOX_ORDER_POLICY_DENIED' });
      assert.equal(calls, 0);
    } finally { globalThis.fetch = original; }
  });
}

test('sandbox helper never calls valueOf() on a hostile amount object', async () => {
  let touched = false;
  const amount = {valueOf() { touched = true; throw Error('side effect'); }};
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error('NETWORK_MUST_NOT_BE_CALLED'); };
  try {
    await assert.rejects(createSandboxOrder({amount}), {message:'SANDBOX_ORDER_POLICY_DENIED'});
    assert.equal(touched, false);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

for (const currency of [null, true, 2, ['EUR'], {}, '', 'JPY', 'EURO']) {
  test('sandbox helper blocks invalid currency before OAuth: '+String(currency), async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error('NETWORK_MUST_NOT_BE_CALLED'); };
    try {
      await assert.rejects(createSandboxOrder({amount:20, currency}),
        {message:'SANDBOX_ORDER_POLICY_DENIED'});
      assert.equal(calls, 0);
    } finally { globalThis.fetch = original; }
  });
}

test('valid synthetic order only reaches hardcoded sandbox OAuth and order creation', async () => {
  const original = globalThis.fetch;
  const originalId = process.env.PAYPAL_CLIENT_ID;
  const originalSecret = process.env.PAYPAL_CLIENT_SECRET;
  process.env.PAYPAL_CLIENT_ID = 'FAKE_TEST_CLIENT_ID';
  process.env.PAYPAL_CLIENT_SECRET = 'FAKE_TEST_CLIENT_SECRET';
  const calls = [];
  globalThis.fetch = async (url, config) => {
    calls.push({url, method:config.method, headers:config.headers, body:config.body});
    if (calls.length === 1) return {
      ok:true, json:async () => ({ access_token:'FAKE_TOKEN' })
    };
    return {ok:true, json:async () => ({ id:'FAKE_SANDBOX_ORDER', status:'CREATED' })};
  };
  try {
    const order = await createSandboxOrder({amount:20.55,currency:'eur'});
    assert.equal(order.id,'FAKE_SANDBOX_ORDER');
    assert.deepEqual(calls.map(c=>c.url),[
      'https://api-m.sandbox.paypal.com/v1/oauth2/token',
      'https://api-m.sandbox.paypal.com/v2/checkout/orders'
    ]);
    assert.deepEqual(calls.map(c=>c.method),['POST','POST']);
    const body=JSON.parse(calls[1].body);
    assert.equal(body.purchase_units[0].amount.value,'20.55');
    assert.equal(body.purchase_units[0].amount.currency_code,'EUR');
    assert.equal(body.intent,'CAPTURE');
    assert.equal(calls[1].headers.Authorization,'Bearer FAKE_TOKEN');
  } finally {
    globalThis.fetch=original;
    if(originalId===undefined)delete process.env.PAYPAL_CLIENT_ID;
    else process.env.PAYPAL_CLIENT_ID=originalId;
    if(originalSecret===undefined)delete process.env.PAYPAL_CLIENT_SECRET;
    else process.env.PAYPAL_CLIENT_SECRET=originalSecret;
  }
});

test('valid inputs without Sandbox credentials never call network',async()=>{
  const original=globalThis.fetch;
  const originalId=process.env.PAYPAL_CLIENT_ID;
  const originalSecret=process.env.PAYPAL_CLIENT_SECRET;
  delete process.env.PAYPAL_CLIENT_ID; delete process.env.PAYPAL_CLIENT_SECRET;
  let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('NETWORK_MUST_NOT_BE_CALLED');};
  try {
    await assert.rejects(createSandboxOrder({amount:20}),
      {message:'SANDBOX_CREDENTIALS_REQUIRED'});
    assert.equal(calls,0);
  }finally{
    globalThis.fetch=original;
    if(originalId!==undefined)process.env.PAYPAL_CLIENT_ID=originalId;
    if(originalSecret!==undefined)process.env.PAYPAL_CLIENT_SECRET=originalSecret;
  }
});

test('Sandbox HTTP errors do not leak raw response bodies into exceptions',async()=>{
  const original=globalThis.fetch;
  const originalId=process.env.PAYPAL_CLIENT_ID;
  const originalSecret=process.env.PAYPAL_CLIENT_SECRET;
  process.env.PAYPAL_CLIENT_ID='FAKE_ID';
  process.env.PAYPAL_CLIENT_SECRET='FAKE_SECRET';
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;
    if(calls===1)return {ok:true,json:async()=>({access_token:'FAKE_TOKEN'})};
    return {ok:false,status:403,json:async()=>({customer:'SENSITIVE_PII'})};
  };
  try {
    await assert.rejects(createSandboxOrder({amount:20}),
      {message:'SANDBOX_ORDER_CREATE_FAILED'});
    assert.equal(calls,2);
  }finally{
    globalThis.fetch=original;
    if(originalId===undefined)delete process.env.PAYPAL_CLIENT_ID;
    else process.env.PAYPAL_CLIENT_ID=originalId;
    if(originalSecret===undefined)delete process.env.PAYPAL_CLIENT_SECRET;
    else process.env.PAYPAL_CLIENT_SECRET=originalSecret;
  }
});
