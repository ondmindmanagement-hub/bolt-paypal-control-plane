// Sandbox-only experimental helper. Never accept an environment override to live PayPal.
// This exported helper is NOT invoked by HTTP routes. Call it only after
// explicit authorization to create a synthetic test order in your own Sandbox.
import { evaluatePaymentAction } from './policy.js';

const API = 'https://api-m.sandbox.paypal.com';

export async function getAccessToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('SANDBOX_CREDENTIALS_REQUIRED');
  const auth = Buffer.from(id + ':' + secret).toString('base64');
  const res = await fetch(API + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + auth,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) throw new Error('SANDBOX_AUTH_FAILED');
  const body = await res.json();
  if (typeof body?.access_token !== 'string' || !body.access_token)
    throw new Error('SANDBOX_AUTH_FAILED');
  return body.access_token;
}

export async function createSandboxOrder({ amount, currency = 'USD' } = {}) {
  const normalizedCurrency = typeof currency === 'string'
    ? currency.toUpperCase() : currency;

  // Validate BEFORE OAuth or network access. Number(...).toFixed(2) alone
  // silently coerces true, arrays and hexadecimal strings, or rounds
  // fractional cents into different amounts.
  const policy = evaluatePaymentAction({
    kind: 'payment', amount, currency: normalizedCurrency
  });
  if (policy.decision !== 'approval_required') {
    throw new Error('SANDBOX_ORDER_POLICY_DENIED');
  }

  const token = await getAccessToken();
  const res = await fetch(API + '/v2/checkout/orders', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: normalizedCurrency,
          value: amount.toFixed(2)
        }
      }]
    })
  });
  // Do not echo raw provider responses into logs; they may contain PII.
  if (!res.ok) throw new Error('SANDBOX_ORDER_CREATE_FAILED');
  return await res.json();
}
