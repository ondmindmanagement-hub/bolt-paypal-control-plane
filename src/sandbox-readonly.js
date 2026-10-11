import { createHash } from 'node:crypto';

const SANDBOX = 'https://api-m.sandbox.paypal.com';
const ORDER_ID = /^[A-Za-z0-9]{17,32}$/;
const STATUSES = new Set(['CREATED','SAVED','APPROVED','VOIDED','COMPLETED','PAYER_ACTION_REQUIRED']);
const CURRENCY = /^[A-Z]{3}$/;
const AMOUNT = /^(?:0|[1-9][0-9]{0,7})\.[0-9]{2}$/;

export function normalizeSandboxOrder(raw, expectedId, provenance = 'SYNTHETIC_UNVERIFIED') {
  if (!['SYNTHETIC_UNVERIFIED','SANDBOX_API_READ'].includes(provenance)) {
    throw new Error('INVALID_PROVENANCE');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('INVALID_SANDBOX_ORDER');
  }
  if (!ORDER_ID.test(expectedId || '') || raw.id !== expectedId) {
    throw new Error('ORDER_ID_MISMATCH');
  }
  if (!STATUSES.has(raw.status)) throw new Error('INVALID_SANDBOX_STATUS');
  if (!Array.isArray(raw.purchase_units) || !raw.purchase_units.length
      || raw.purchase_units.length > 12) throw new Error('INVALID_PURCHASE_UNITS');

  const amounts = raw.purchase_units.map(unit => {
    const amount = unit?.amount;
    if (!CURRENCY.test(amount?.currency_code || '')
        || !AMOUNT.test(amount?.value || '')) throw new Error('INVALID_PURCHASE_AMOUNT');
    return { currency: amount.currency_code, value: amount.value };
  });

  // ALLOWLIST FIELDS ONLY: never return payer email, shipping address,
  // authorization token, links, funding information or personal data.
  const result = { source: provenance, orderId: raw.id, status: raw.status, amounts };
  const digest = createHash('sha256').update(JSON.stringify(result)).digest('hex');
  return { ...result, evidenceSHA256: digest };
}

export function compareSandboxEvidence(previous, current) {
  if (!['SYNTHETIC_UNVERIFIED','SANDBOX_API_READ'].includes(previous?.source)
      || previous.source !== current?.source
      || !ORDER_ID.test(previous.orderId || '')
      || previous.orderId !== current.orderId) throw new Error('INVALID_EVIDENCE_PAIR');
  const statusChanged = previous.status !== current.status;
  const amountChanged = JSON.stringify(previous.amounts) !== JSON.stringify(current.amounts);
  return {
    orderId: current.orderId,
    previousStatus: previous.status,
    currentStatus: current.status,
    statusChanged,
    amountChanged,
    // A person must review anomalies; this demo never changes PayPal state.
    reviewRequired: statusChanged || amountChanged,
    executed: false
  };
}

async function checkedJSON(response, errorCode) {
  if (!response?.ok) throw new Error(errorCode);
  try { return await response.json(); }
  catch { throw new Error(errorCode); }
}

export async function inspectSandboxOrder(orderId, {
  clientId, clientSecret, transport = fetch, timeoutMs = 10000
} = {}) {
  if (!ORDER_ID.test(orderId || '')) throw new Error('INVALID_ORDER_ID');
  if (!clientId || !clientSecret) throw new Error('SANDBOX_CREDENTIALS_REQUIRED');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) {
    throw new Error('INVALID_TIMEOUT');
  }
  const abort = AbortSignal.timeout(timeoutMs);
  const basic = Buffer.from(clientId + ':' + clientSecret).toString('base64');
  // OAuth token retrieval is the only POST made by this read-only command.
  const tokenResponse = await transport(SANDBOX + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + basic,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials',
    signal: abort
  });
  const auth = await checkedJSON(tokenResponse, 'SANDBOX_AUTH_FAILED');
  if (typeof auth.access_token !== 'string' || !auth.access_token) {
    throw new Error('SANDBOX_AUTH_FAILED');
  }
  const response = await transport(SANDBOX + '/v2/checkout/orders/' + orderId, {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + auth.access_token },
    signal: abort
  });
  const order = await checkedJSON(response, 'SANDBOX_READ_FAILED');
  // Provenance means this code path fetched a sandbox response; it is not
  // a signed attestation of PayPal identity, customer or order validity.
  return normalizeSandboxOrder(order, orderId, 'SANDBOX_API_READ');
}
