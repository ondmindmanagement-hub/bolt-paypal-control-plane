export function evaluatePaymentAction(action) {
  const amount = Number(action.amount ?? 0);
  const currency = String(action.currency ?? 'USD').toUpperCase();
  const kind = String(action.kind ?? 'payment');
  if (!Number.isFinite(amount) || amount <= 0) return { decision: 'deny', reason: 'Amount must be positive.' };
  if (!['USD', 'EUR', 'GBP'].includes(currency)) return { decision: 'deny', reason: 'Currency is outside the demo policy.' };
  if (kind === 'refund' && amount <= 50) return { decision: 'allow', reason: 'Low-value refund within policy.' };
  if (amount <= 25) return { decision: 'allow', reason: 'Low-value action within autonomous limit.' };
  if (amount <= 500) return { decision: 'approval_required', reason: 'Human approval required above autonomous limit.' };
  return { decision: 'deny', reason: 'Amount exceeds configured demo limit.' };
}
