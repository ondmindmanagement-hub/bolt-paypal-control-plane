const API = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
export async function getAccessToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required');
  const auth = Buffer.from(id + ':' + secret).toString('base64');
  const res = await fetch(API + '/v1/oauth2/token', {method:'POST',headers:{Authorization:'Basic ' + auth,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
  if (!res.ok) throw new Error('PayPal auth failed: ' + res.status);
  return (await res.json()).access_token;
}
export async function createSandboxOrder({ amount, currency = 'USD' }) {
  const token = await getAccessToken();
  const res = await fetch(API + '/v2/checkout/orders', {method:'POST',headers:{Authorization:'Bearer ' + token,'Content-Type':'application/json'},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{amount:{currency_code:currency,value:Number(amount).toFixed(2)}}]})});
  const body = await res.json();
  if (!res.ok) throw new Error('PayPal order failed: ' + res.status + ' ' + JSON.stringify(body));
  return body;
}
