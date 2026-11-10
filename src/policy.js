// BOLT local preview policy. Amounts are monetary numeric values, not coercible objects.
// This module does not approve or execute any PayPal transaction.
const MONETARY_AMOUNT = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/;

export function evaluatePaymentAction(action) {
  // Never coerce user/LLM input with Number(value) or String(value): booleans,
  // arrays, hexadecimal/scientific strings and objects can otherwise become
  // plausible amounts or payment/refund kinds.
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    return { decision: 'deny', reason: 'A structured payment proposal is required.' };
  }

  const amount = action.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0.01
      || !MONETARY_AMOUNT.test(String(amount))) {
    return { decision: 'deny', reason: 'Amount must be a monetary number with up to two decimal places.' };
  }

  // Preserve the prototype's existing omitted-currency default, while
  // rejecting non-string values rather than coercing arrays or objects.
  const currency = action.currency === undefined ? 'USD'
    : (typeof action.currency === 'string' ? action.currency.toUpperCase() : null);
  if (!['USD', 'EUR', 'GBP'].includes(currency)) {
    return { decision: 'deny', reason: 'Currency is outside the demo policy.' };
  }

  const kind = action.kind;
  if (kind !== 'payment' && kind !== 'refund') {
    return { decision: 'deny', reason: 'Unsupported action type.' };
  }

  if (amount > 500) {
    return { decision: 'deny', reason: 'Amount exceeds configured demo limit.' };
  }

  return {
    decision: 'approval_required',
    reason: kind === 'payment'
      ? 'Human approval is required before any payment execution.'
      : 'Human approval is required before any refund execution.'
  };
}
