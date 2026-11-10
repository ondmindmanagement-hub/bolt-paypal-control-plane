// Server-level regression: untrusted JSON must never trigger an approval-like
// decision through JavaScript coercion. These tests use local ephemeral sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeServer } from './server.js';

async function withServer(planner, body) {
  const server = makeServer({ planner });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  try { await body('http://127.0.0.1:'+server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

const attacks=[
  ['boolean', true],['array', [20]], ['string numeric', '20'],
  ['hex numeric', '0x20'], ['scientific notation', '1e2'],
  ['fractional cent', 0.001], ['three decimals', 20.555],
  ['negative amount', -10],['over policy cap', 500.01],
  ['object coercion', {value:20}]
];
for (const [label,amount] of attacks) {
  test(`HTTP policy denies ${label} and executes no action`,async()=>{
    await withServer(async()=>({}),async base=>{
      const response=await fetch(base+'/actions/payment',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({kind:'payment',amount,currency:'EUR'})
      });
      assert.equal(response.status,403);
      const result=await response.json();
      assert.equal(result.policy.decision,'deny');
      assert.equal(result.executed,false);
    });
  });
}
test('HTTP strictly requires human review for a valid cent amount',async()=>{
  await withServer(async()=>({}),async base=>{
    const response=await fetch(base+'/actions/payment',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({kind:'payment',amount:20.55,currency:'EUR'})
    });
    assert.equal(response.status,202);
    const result=await response.json();
    assert.equal(result.policy.decision,'approval_required');
    assert.equal(result.executed,false);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  });
});
test('HTTP AI planner returning malformed proposal is denied without executing',async()=>{
  await withServer(async()=>({kind:'payment',amount:'20',currency:'EUR'}),async base=>{
    const response=await fetch(base+'/actions/from-intent',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({intent:'Propose 20 EUR payment'})
    });
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.policy.decision,'deny');
    assert.equal(result.executed,false);
  });
});
