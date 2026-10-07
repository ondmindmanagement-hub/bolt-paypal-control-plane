# BOLT Agentic Payments Control Plane

Hackathon project for the PayPal AI Hackathon 2026.

BOLT Agentic Payments Control Plane explores how AI-assisted payment workflows can stay useful without turning model output into unrestricted financial authority.

## Core idea

An AI system may propose a payment, refund, or other PayPal action. Before anything is executed, BOLT evaluates the proposed action against explicit policy:

- allow: low-risk actions may proceed;
- approval_required: consequential actions pause for a human;
- deny: actions outside configured policy are blocked.

Every decision can be logged so a reviewer can understand what was proposed, why it was allowed or blocked, and what ultimately executed.

## Current prototype

This repository contains a small Node.js service with a policy gate, autonomous limits, human-approval decisions, hard deny thresholds, PayPal Sandbox order creation when credentials are configured, and tests for the policy layer.

## Run

npm test
npm start

Health endpoint: GET http://localhost:8787/health
Payment proposal endpoint: POST http://localhost:8787/actions/payment

To enable PayPal Sandbox execution set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET before starting the service.

## Hackathon roadmap

- add an AI planner that converts natural-language intent into structured PayPal actions;
- add explicit human approval UI;
- persist audit events;
- add refund and capture flows;
- add a public demo;
- record a demonstration video under three minutes.

## Safety scope

This is a hackathon prototype. It is not a financial institution, production payment processor, or certified compliance product. The demo is intended for PayPal Sandbox and representative test data.

## License

MIT

## AI planner

The full prototype includes an Ollama-based local planner using qwen2.5:1.5b. It converts natural-language payment intent into a structured action before the deterministic BOLT policy gate evaluates authority.

Endpoint: POST /actions/from-intent

Example JSON body: {"intent":"Refund 18 EUR to the customer for the duplicate charge"}

## Public demo

A browser-based policy demo is published with GitHub Pages from the docs folder. It intentionally does not execute real payments.
