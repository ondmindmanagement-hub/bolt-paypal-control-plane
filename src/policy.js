export function evaluatePaymentAction(action) {
  const amount = Number(action.amount ?? 0);
  const currency = String(action.currency ?? 'USD').toUpperCase();
  const kind = String(action.kind ?? 'payment');

  if (!Number.isFinite(amount) || amount <= 0) {
    return { decision: 'deny', reason: 'Amount must be positive.' };
  }

  if (!['USD', 'EUR', 'GBP'].includes(currency)) {
    return { decision: 'deny', reason: 'Currency is outside the demo policy.' };
  }

  if (kind === 'payment' && amount <= 500) {
    return { decision: 'approval_required', reason: 'Human approval is required before any payment execution.' };
  }

  if (kind === 'refund' && amount <= 500) {
    return { decision: 'approval_required', reason: 'Human approval is required before any refund execution.' };
  }

  return { decision: 'deny', reason: 'Amount exceeds configured demo limit.' };
}
