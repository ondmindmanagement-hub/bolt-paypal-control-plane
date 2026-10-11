import http from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluatePaymentAction } from './policy.js';
import { planPaymentIntent } from './ai.js';

const MAX_BODY = 16 * 1024;
const MAX_INTENT = 1200;

function sendJSON(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

async function parseJSONRequest(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    return { error: 'content_type_must_be_json', status: 415 };
  }
  let data = '';
  let total = 0;
  let oversized = false;
  for await (const part of req) {
    total += part.length;
    if (total > MAX_BODY) {
      oversized = true;
      // Drain without accumulating untrusted payloads in memory.
      continue;
    }
    if (!oversized) data += part.toString('utf8');
  }
  if (oversized) return { error: 'request_too_large', status: 413 };
  try {
    const value = JSON.parse(data);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { error: 'json_object_required', status: 400 };
    }
    return { value };
  } catch {
    return { error: 'invalid_json', status: 400 };
  }
}

// This is a LOCAL, read-only policy demonstration. No route may place orders,
// capture payments, issue refunds, or write to a PayPal endpoint.
export function makeServer({ planner = planPaymentIntent } = {}) {
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        return sendJSON(res, 200, { ok: true, service: 'bolt-paypal-control-plane', mode: 'local-policy-preview' });
      }
      if (req.method !== 'POST' || !['/actions/payment', '/actions/from-intent'].includes(req.url)) {
        return sendJSON(res, 404, { error: 'not_found' });
      }
      const parsed = await parseJSONRequest(req);
      if (parsed.error) return sendJSON(res, parsed.status, { error: parsed.error, executed: false });
      if (req.url === '/actions/from-intent') {
        if (typeof parsed.value.intent !== 'string' || !parsed.value.intent.trim()
            || parsed.value.intent.length > MAX_INTENT) {
          return sendJSON(res, 400, { error: 'invalid_intent', executed: false });
        }
        let planned;
        try {
          planned = await planner(parsed.value.intent);
        } catch {
          return sendJSON(res, 503, { error: 'local_ai_unavailable', executed: false });
        }
        const policy = evaluatePaymentAction(planned);
        return sendJSON(res, 200, { planned, policy, executed: false });
      }
      const policy = evaluatePaymentAction(parsed.value);
      // Always fail closed even if a future policy change returns "allow".
      const status = policy.decision === 'deny' ? 403 : 202;
      return sendJSON(res, status, { policy, executed: false });
    } catch {
      return sendJSON(res, 500, { error: 'internal_error', executed: false });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT must be an integer from 1 to 65535');
    process.exitCode = 1;
  } else {
    makeServer().listen(port, '127.0.0.1', () => {
      console.log('BOLT policy preview (no payments) at http://127.0.0.1:' + port);
    });
  }
}
