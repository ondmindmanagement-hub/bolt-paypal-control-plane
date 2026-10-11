import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { normalizeSandboxOrder, compareSandboxEvidence,
         inspectSandboxOrder } from './sandbox-readonly.js';

const ORDER = '5O190127TN364715T';
const rawOrder = ({
  id=ORDER, status='APPROVED', currency='EUR', value='18.00'
}={}) => ({
  id, status, purchase_units: [{amount: {currency_code: currency,value}}],
  payer: { email_address: 'private-customer@example.org' },
  payment_source: {paypal: {account_id: 'PERSONAL_ID'}},
  links: [{href: 'https://do-not-publish.invalid/private'}]
});

test('normalization removes payer details and produces stable digest', () => {
  const a=normalizeSandboxOrder(rawOrder(),ORDER);
  const b=normalizeSandboxOrder({...rawOrder(), secret: 'UNTRUSTED_SECRET'}, ORDER);
  assert.deepEqual(a,b);
  assert.equal(a.status,'APPROVED');
  assert.equal(a.source,'SYNTHETIC_UNVERIFIED');
  assert.match(a.evidenceSHA256,/^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(a).includes('private-customer'));
  assert.ok(!JSON.stringify(a).includes('PERSONAL_ID'));
  assert.ok(!JSON.stringify(a).includes('UNTRUSTED_SECRET'));
});
test('rejects fake order id and mismatched server order', () => {
  assert.throws(()=>normalizeSandboxOrder(rawOrder({id:'DIFFERENT'}),ORDER),/ORDER_ID_MISMATCH/);
  assert.throws(()=>normalizeSandboxOrder(rawOrder(), '../../other'),/ORDER_ID_MISMATCH/);
});
test('rejects unexpected statuses and malformed purchase amounts', () => {
  assert.throws(()=>normalizeSandboxOrder(rawOrder({status:'CAPTURED_WITHOUT_PROOF'}),ORDER),/INVALID_SANDBOX_STATUS/);
  assert.throws(()=>normalizeSandboxOrder(rawOrder({value:'18.001'}),ORDER),/INVALID_PURCHASE_AMOUNT/);
  assert.throws(()=>normalizeSandboxOrder(rawOrder({currency:'EURO'}),ORDER),/INVALID_PURCHASE_AMOUNT/);
});
test('rejects missing purchase units', () => {
  assert.throws(()=>normalizeSandboxOrder({...rawOrder(),purchase_units:[]},ORDER),/INVALID_PURCHASE_UNITS/);
});
test('evidence comparison flags order-state changes but never executes', () => {
  const approved=normalizeSandboxOrder(rawOrder(),ORDER);
  const completed=normalizeSandboxOrder(rawOrder({status:'COMPLETED'}),ORDER);
  assert.deepEqual(compareSandboxEvidence(approved,completed),{
    orderId:ORDER,previousStatus:'APPROVED',currentStatus:'COMPLETED',
    statusChanged:true,amountChanged:false,reviewRequired:true,executed:false
  });
});
test('evidence comparison ignores identical snapshots', () => {
  const snapshot=normalizeSandboxOrder(rawOrder(),ORDER);
  assert.equal(compareSandboxEvidence(snapshot,snapshot).reviewRequired,false);
});
test('evidence comparison flags changed amounts for human review', () => {
  const a=normalizeSandboxOrder(rawOrder(),ORDER);
  const b=normalizeSandboxOrder(rawOrder({value:'99.00'}),ORDER);
  const review=compareSandboxEvidence(a,b);
  assert.equal(review.amountChanged,true);
  assert.equal(review.reviewRequired,true);
  assert.equal(review.executed,false);
});
test('evidence comparison refuses other order IDs', () => {
  const a=normalizeSandboxOrder(rawOrder(),ORDER);
  const b=normalizeSandboxOrder(rawOrder({id:'5O190127TN364716T'}),'5O190127TN364716T');
  assert.throws(()=>compareSandboxEvidence(a,b),/INVALID_EVIDENCE_PAIR/);
});
test('invalid id cannot send requests even when credentials configured', async () => {
  let calls=0;
  await assert.rejects(inspectSandboxOrder('../../etc/passwd',{
    clientId:'FAKE',clientSecret:'FAKE',transport:()=>{calls++;}
  }),/INVALID_ORDER_ID/);
  assert.equal(calls,0);
});
test('absence of credentials never calls network', async () => {
  let calls=0;
  await assert.rejects(inspectSandboxOrder(ORDER,{
    transport:()=>{calls++;}
  }),/SANDBOX_CREDENTIALS_REQUIRED/);
  assert.equal(calls,0);
});
test('read-only request uses only sandbox OAuth POST then sandbox order GET', async () => {
  const calls=[];
  const transport=async (url, init)=>{
    calls.push({url,method:init.method, headers:init.headers});
    assert.match(url,/^https:\/\/api-m\.sandbox\.paypal\.com\//);
    if(calls.length===1) return {ok:true,json:async()=>({access_token:'FAKE-ACCESS-TOKEN'})};
    return {ok:true,json:async()=>rawOrder()};
  };
  const result=await inspectSandboxOrder(ORDER,{
    clientId:'FAKE_ID',clientSecret:'FAKE_SECRET',transport
  });
  assert.equal(calls.length,2);
  assert.deepEqual(calls.map(x=>x.method),['POST','GET']);
  assert.match(calls[0].url,/\/v1\/oauth2\/token$/);
  assert.match(calls[1].url,/\/v2\/checkout\/orders\/5O190127TN364715T$/);
  assert.equal(calls[1].headers.Authorization,'Bearer FAKE-ACCESS-TOKEN');
  assert.equal(result.orderId,ORDER);
  assert.equal(result.status,'APPROVED');
  assert.equal(result.source,'SANDBOX_API_READ');
  assert.ok(!JSON.stringify(result).includes('FAKE_SECRET'));
  assert.ok(!JSON.stringify(result).includes('FAKE-ACCESS-TOKEN'));
});
test('authorization failure does not inspect orders', async () => {
  let calls=0;
  await assert.rejects(inspectSandboxOrder(ORDER,{
    clientId:'FAKE',clientSecret:'FAKE',
    transport:async()=>{calls++;return {ok:false,status:401};}
  }),/SANDBOX_AUTH_FAILED/);
  assert.equal(calls,1);
});
test('order read failure denies, not returns placeholder evidence', async () => {
  let calls=0;
  await assert.rejects(inspectSandboxOrder(ORDER,{
    clientId:'FAKE',clientSecret:'FAKE',
    transport:async()=>{
      calls++;
      if(calls===1)return {ok:true,json:async()=>({access_token:'FAKE_TOKEN'})};
      return {ok:false,status:404};
    }
  }),/SANDBOX_READ_FAILED/);
  assert.equal(calls,2);
});
test('invalid timeout fails without contacting sandbox', async () => {
  let calls=0;
  await assert.rejects(inspectSandboxOrder(ORDER,{
    clientId:'FAKE',clientSecret:'FAKE',timeoutMs:60000,
    transport:async()=>{calls++;}
  }),/INVALID_TIMEOUT/);
  assert.equal(calls,0);
});

test('CLI missing sandbox credentials safely fails without network', () => {
  const env={...process.env};
  delete env.PAYPAL_CLIENT_ID;
  delete env.PAYPAL_CLIENT_SECRET;
  const command=spawnSync(process.execPath,
    ['src/sandbox-inspect.js','--order-id',ORDER], {encoding:'utf8',env});
  assert.equal(command.status,1);
  assert.match(command.stderr,/SANDBOX_CREDENTIALS_REQUIRED/);
  assert.equal(command.stdout,'');
});
test('CLI refuses missing/extra arguments without reading sandbox', () => {
  const command=spawnSync(process.execPath,
    ['src/sandbox-inspect.js'], {encoding:'utf8'});
  assert.equal(command.status,2);
  assert.match(command.stderr,/Usage:/);
  assert.equal(command.stdout,'');
});

test('synthetic reports cannot be reconciled against network-sandbox reports', () => {
  const fake=normalizeSandboxOrder(rawOrder(),ORDER);
  const realShape=normalizeSandboxOrder(rawOrder(),ORDER,'SANDBOX_API_READ');
  assert.notEqual(fake.evidenceSHA256,realShape.evidenceSHA256);
  assert.throws(()=>compareSandboxEvidence(fake,realShape),/INVALID_EVIDENCE_PAIR/);
});
test('provenance outside the internal allowlist is refused', () => {
  assert.throws(()=>normalizeSandboxOrder(rawOrder(),ORDER,'PAYPAL_LIVE'),/INVALID_PROVENANCE/);
});
