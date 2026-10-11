# BOLT Agentic Payments Control Plane - Devpost readiness

Verified 11 October 2026. All test inputs and demo outputs are synthetic.
This repository is part of an existing Devpost PayPal AI Hackathon
submission, entry 1223140. Receipt is not approval or prize.

## Distinction versus the separate BOLT PayFlow Guard entry

| Dimension | PayFlow Guard (separate CLI) | Payments Control Plane (this project) |
| --- | --- | --- |
| Primary demo | Exact-amount human consent before generating a test order | Review of proposed actions and comparison of existing order-state snapshots |
| PayPal use | Sandbox order creation (with operator consent and sandbox account) | Read-only API GET for an existing Sandbox order after OAuth |
| AI use | Local Ollama recommendation, or labeled canned demo | Local Ollama intent planner, or separate labeled policy preview |
| User interface | Terminal prompt and approval phrase | Browser policy/reconciliation preview, local HTTP API, read-only CLI |
| State changes | Sandbox test order creation when explicitly authorized | No payment/order action endpoint; order inspection only |
| Judge compliance | Real PayPal Sandbox demo still needs verifying | Real PayPal Sandbox GET and live local inference still need verifying |

These may **still be judged insufficiently different**; official rules give
judges final discretion. Distinct modules do not guarantee eligibility.

## Run and inspect safely

Node.js 20+:

1. npm test (35 mock/offline tests, no PayPal API called)
2. npm run demo:reconcile (fictional status snapshots and hash evidence)
3. npm start (only localhost:8787, proposal preview never executes)
4. Open docs/index.html (static browser demo, no API calls)

Optional REAL Sandbox inspection of an existing test order **only with
explicit permission**: configure a sandbox-only PayPal developer client and
run npm run inspect:sandbox -- --order-id YOUR_EXISTING_SANDBOX_ORDER_ID.

The command retrieves an OAuth token then GETs an existing Sandbox order;
it never creates/captures/refunds a payment, never accesses Live PayPal,
and only returns an allowlist of order status and currency/amount metadata.
Do not use customer personal data, paste keys, or commit environment files.

## Mandatory gap before the Nov 12, 2026 deadline

- PayPal Sandbox developer platform **must actually be exercised** with an
  owner-authorized test account (real API responses, safely redacted).
- Ollama model inference must be verified and accurately differentiated
  from canned browser previews.
- Re-record or update the public <3 min YouTube demo if the current
  submission's claim no longer matches the running implementation.
- Check the Devpost URL, functional judge access, README, MIT license,
  eligible entrant / IP rights and substantial difference from PayFlow.
- Do not fabricate real PayPal use, sandbox transactions, AI calls, real
  merchants or human identities. No live transfers or actual money.

Official rules: https://paypalaihackathon.devpost.com/rules

## Constraints

This is early-stage research, not a commercial payments gateway, audited
security component or independently verified compliance system. It lacks
production identity, true multi-user approval, reliable durable audit
anchors, consent/PII reviews, rate limiting, SSO and real buyer integration.
