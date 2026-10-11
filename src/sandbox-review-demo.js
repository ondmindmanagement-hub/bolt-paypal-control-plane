import { normalizeSandboxOrder, compareSandboxEvidence } from './sandbox-readonly.js';

const id='5O190127TN364715T'; // EXAMPLE ONLY; not a real verified order.
const mock=(status,value='18.00')=>({
  id, status,
  purchase_units:[{amount:{currency_code:'EUR',value}}],
  payer:{ email_address:'example-private@invalid.test' }
});
const before=normalizeSandboxOrder(mock('CREATED'),id);
const after=normalizeSandboxOrder(mock('APPROVED'),id);
const review=compareSandboxEvidence(before,after);
const output={
  mode:'OFFLINE_SYNTHETIC_NO_PAYPAL_API',
  source:'LOCAL_TEST_FIXTURE_NOT_VERIFIED_PAYPAL',
  prior:before,
  current:after,
  review
};
console.log(JSON.stringify(output,null,2));
