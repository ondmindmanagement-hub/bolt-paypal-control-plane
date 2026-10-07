import http from 'node:http';
import { evaluatePaymentAction } from './policy.js';
import { createSandboxOrder } from './paypal.js';
const port = Number(process.env.PORT || 8787);
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'GET' && req.url === '/health') { res.end(JSON.stringify({ok:true,service:'bolt-paypal-control-plane'})); return; }
  if (req.method === 'POST' && req.url === '/actions/payment') {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const action = JSON.parse(raw || '{}');
    const policy = evaluatePaymentAction(action);
    if (policy.decision !== 'allow') { res.statusCode = policy.decision === 'deny' ? 403 : 202; res.end(JSON.stringify({policy,executed:false})); return; }
    if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) { const order = await createSandboxOrder(action); res.end(JSON.stringify({policy,executed:true,order})); return; }
    res.end(JSON.stringify({policy,executed:false,sandbox:'credentials-not-configured',proposedPayPalOrder:{amount:action.amount,currency:action.currency || 'USD'}})); return;
  }
  res.statusCode = 404; res.end(JSON.stringify({error:'not_found'}));
});
server.listen(port, () => console.log('BOLT PayPal Control Plane listening on http://localhost:' + port));
