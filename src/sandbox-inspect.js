import { inspectSandboxOrder } from './sandbox-readonly.js';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--order-id') {
  console.error('Usage: node src/sandbox-inspect.js --order-id <sandbox-order-ID>');
  process.exitCode = 2;
} else {
  try {
    const evidence = await inspectSandboxOrder(args[1], {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET
    });
    // Print only allowlisted non-customer fields; no raw response or secrets.
    console.log(JSON.stringify({ ...evidence, executed: false }, null, 2));
  } catch (error) {
    // Error messages are internal fixed codes. Never print credentials or a
    // provider's raw response containing customer/order details.
    const safe = new Set(['INVALID_ORDER_ID','SANDBOX_CREDENTIALS_REQUIRED',
      'INVALID_TIMEOUT','SANDBOX_AUTH_FAILED','SANDBOX_READ_FAILED',
      'INVALID_SANDBOX_ORDER','ORDER_ID_MISMATCH',
      'INVALID_SANDBOX_STATUS','INVALID_PURCHASE_UNITS','INVALID_PURCHASE_AMOUNT']);
    console.error(safe.has(error?.message) ? error.message : 'SANDBOX_REQUEST_FAILED');
    process.exitCode = 1;
  }
}
