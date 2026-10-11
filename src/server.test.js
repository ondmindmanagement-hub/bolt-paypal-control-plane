import test from 'node:test';
import assert from 'node:assert/strict';
import { makeServer } from './server.js';

async function withServer(planner, callback) {
  const server = makeServer({ planner });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port, address } = server.address();
  try {
    assert.equal(address, '127.0.0.1');
    await callback('http://127.0.0.1:' + port);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}
const json = value => JSON.stringify(value);
const post = (base, route, body, type='application/json') => fetch(base+route, {
  method:'POST',
  headers:{'Content-Type':type},
  body
});

test('healthy loopback preview includes non-payment mode', async () => {
  await withServer(async()=>({}), async base => {
    const r=await fetch(base+'/health');
    assert.equal(r.status,200);
    assert.equal((await r.json()).mode,'local-policy-preview');
  });
});
test('a payment request never executes even with simulated credentials', async () => {
  await withServer(async()=>({}), async base => {
    const r=await post(base,'/actions/payment',json({kind:'payment',amount:1,currency:'USD'}));
    assert.equal(r.status,202);
    assert.deepEqual((await r.json()).executed,false);
  });
});
test('denied payment cannot execute', async () => {
  await withServer(async()=>({}), async base => {
    const r=await post(base,'/actions/payment',json({kind:'payment',amount:10000,currency:'USD'}));
    assert.equal(r.status,403);
    assert.equal((await r.json()).executed,false);
  });
});
test('invalid JSON fails closed without killing server', async () => {
  await withServer(async()=>({}), async base => {
    const r=await post(base,'/actions/payment','{malformed');
    assert.equal(r.status,400);
    const again=await fetch(base+'/health');
    assert.equal(again.status,200);
  });
});
test('oversize JSON input receives 413', async () => {
  await withServer(async()=>({}), async base => {
    const r=await post(base,'/actions/payment',json({value:'a'.repeat(20000)}));
    assert.equal(r.status,413);
  });
});
test('missing JSON content type rejected', async () => {
  await withServer(async()=>({}), async base => {
    const r=await post(base,'/actions/payment','{}','text/plain');
    assert.equal(r.status,415);
  });
});
test('AI planner failure responds safely and server continues', async () => {
  await withServer(async()=>{throw Error('Unreachable local LLM / private details');}, async base => {
    const r=await post(base,'/actions/from-intent',json({intent:'Refund 5 euros'}));
    assert.equal(r.status,503);
    const result=await r.json();
    assert.equal(result.executed,false);
    assert.ok(!json(result).includes('private details'));
    assert.equal((await fetch(base+'/health')).status,200);
  });
});
test('AI preview gets plan and does not execute', async () => {
  await withServer(async()=>({kind:'payment',amount:15,currency:'EUR'}), async base => {
    const r=await post(base,'/actions/from-intent',json({intent:'Plan 15 EUR payment'}));
    assert.equal(r.status,200);
    const result=await r.json();
    assert.equal(result.policy.decision,'approval_required');
    assert.equal(result.executed,false);
  });
});
test('oversized or missing intent rejected before contacting AI', async () => {
  let n=0;
  await withServer(async()=>{n++;return {};}, async base => {
    assert.equal((await post(base,'/actions/from-intent',json({intent:''}))).status,400);
    assert.equal((await post(base,'/actions/from-intent',json({intent:'x'.repeat(1400)}))).status,400);
  });
  assert.equal(n,0);
});
