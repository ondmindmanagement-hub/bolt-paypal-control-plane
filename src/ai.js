const OLLAMA = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';

export async function planPaymentIntent(intent) {
  const prompt = `You convert a user's payment intent into one JSON object only.\nAllowed kind values: payment, refund.\nAllowed currency values: USD, EUR, GBP.\nReturn exactly: {\"kind\":\"payment|refund\",\"amount\":number,\"currency\":\"USD|EUR|GBP\",\"reason\":\"short reason\"}.\nDo not invent an amount. If the amount is missing, use 0.\nUser intent: ${JSON.stringify(String(intent))}`;
  const res = await fetch(OLLAMA + '/api/generate', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({model: MODEL, prompt, stream: false, format: 'json', options: {temperature: 0}})
  });
  if (!res.ok) throw new Error('Ollama planner failed: ' + res.status);
  const data = await res.json();
  return JSON.parse(data.response);
}
