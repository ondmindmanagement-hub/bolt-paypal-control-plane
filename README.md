# BOLT Agentic Payments Control Plane

Hackathon project for the PayPal AI Hackathon 2026.

BOLT Agentic Payments Control Plane explores how AI-assisted payment workflows can stay useful without turning model output into unrestricted financial authority.

## Current state: local-only preview, not a payment processor

The project has two components:
- a browser policy preview served as a static GitHub Pages document;
- a local Node.js HTTP server for manually proposed payments and optional
  local Ollama planning. All proposal endpoints return executed:false.

Every positive in-policy payment/refund proposal requires human approval, which
is **not yet implemented as an authenticated server-side action**. The server
never creates a PayPal order, captures or refunds money. The separate
sandbox-only helper in src/paypal.js is **not invoked** by any HTTP route;
setting PayPal credentials does **not** enable execution.

### Run locally

    npm test
    npm start

The server listens only at http://127.0.0.1:8787, not on other devices.
Check GET /health. POST /actions/payment with a JSON object to preview
the policy decision. POST /actions/from-intent requires a running local
Ollama model (qwen2.5:1.5b by default), and returns a preview only.
Malformed JSON returns 400, oversized payloads 413, non-JSON payloads 415,
and unavailable local AI 503. It does not return stack traces or secrets.

Example without contacting PayPal:

    curl -s -X POST http://127.0.0.1:8787/actions/payment \
      -H 'Content-Type: application/json' \
      -d '{"kind":"payment","amount":20,"currency":"EUR"}'

Expected: approval_required, executed:false.

## Hackathon verification gaps

PayPal AI Hackathon's official rules require a real usable PayPal developer
platform integration and accessible functional demo, public licensed source
and demo video. The browser-only policy preview is *not* a PayPal Sandbox
integration. The local service is not a production authorization layer. Do
not claim that API calls or AI inference occurred unless a specific log
shows successful, authorized sandbox calls and an actual local model reply.

This entry is different in structure from the submitted CLI PayFlow Guard,
but both concern approval of PayPal-related actions. Two same-hackathon
entries must be substantially different; organizer/judges decide if they
are distinct. Do not claim separate eligibility has been certified.

## Technical constraints

- No external payments, captures, refunds or PayPal live API access.
- No independent authenticated operators, approval UI or durable audit logs.
- No network exposure beyond loopback by default.
- No automatic emails, customer records or paid APIs.
- Timeouts, rate limits, secure key handling, customer security review and
  real integration validation are future tasks, not implemented features.

## License

MIT

## AI planner

The full prototype includes an Ollama-based local planner using qwen2.5:1.5b. It converts natural-language payment intent into a structured action before the deterministic BOLT policy gate evaluates authority.

Endpoint: POST /actions/from-intent

Example JSON body: {"intent":"Refund 18 EUR to the customer for the duplicate charge"}

## Public demo

A browser-based policy demo is published with GitHub Pages from the docs folder. It intentionally does not execute real payments.
