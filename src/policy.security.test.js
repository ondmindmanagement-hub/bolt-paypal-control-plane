import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePaymentAction as evaluate } from './policy.js';

const propose = (amount, overrides={}) => ({kind:'payment',amount,currency:'EUR',...overrides});
const decision = x => evaluate(x).decision;

for (const amount of [true, false, null, '20', '0x10', '1e2', ' 20 ', [20], {valueOf:()=>20},
                       Number.NaN, Infinity, -Infinity, -0.01, 0, 0.001, 1.005, 1.234]) {
  test('reject coercible/invalid amount: '+String(amount),()=>{
    assert.equal(decision(propose(amount)), 'deny');
  });
}
test('reject invalid currency types instead of coercing objects',()=>{
  for (const currency of [['EUR'],{},true,null,20])
    assert.equal(decision(propose(20,{currency})), 'deny');
});
test('reject missing, coercible or unsupported action kinds',()=>{
  for (const kind of [undefined,['payment'],{toString:()=> 'payment'},'transfer','PAYMENT',null])
    assert.equal(decision(propose(20,{kind})), 'deny');
});
test('reject null, arrays and non-objects',()=>{
  for (const candidate of [null,[],10,'payment'])
    assert.equal(decision(candidate),'deny');
});
test('allow valid decimal amounts, only as numeric JSON values',()=>{
  for (const amount of [0.01,0.1,1.2,20,499.99,500])
    assert.equal(decision(propose(amount)),'approval_required');
});
test('still fails closed on over-limit valid amount',()=>{
  assert.equal(decision(propose(500.01)),'deny');
});
test('keep existing omitted-currency USD fallback',()=>{
  assert.equal(decision({kind:'payment',amount:20}),'approval_required');
});
test('do not invoke hostile valueOf during validation',()=>{
  let touched=false;
  const amount={ valueOf(){ touched=true;throw Error('side effect'); } };
  assert.equal(decision(propose(amount)),'deny');
  assert.equal(touched,false);
});
test('no action ever returns allow/approved/executed',()=>{
  for (const amount of [0.01,20,500,500.01]) {
    const obj=evaluate(propose(amount));
    assert.ok(['deny','approval_required'].includes(obj.decision));
    assert.ok(!Object.hasOwn(obj,'executed'));
  }
});
