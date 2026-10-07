import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePaymentAction } from './policy.js';
test('allows low-value payment', () => assert.equal(evaluatePaymentAction({kind:'payment',amount:20,currency:'USD'}).decision, 'allow'));
test('requires approval for mid-value payment', () => assert.equal(evaluatePaymentAction({kind:'payment',amount:100,currency:'EUR'}).decision, 'approval_required'));
test('denies high-value payment', () => assert.equal(evaluatePaymentAction({kind:'payment',amount:1000,currency:'USD'}).decision, 'deny'));
