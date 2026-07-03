const axios  = require('axios');
const crypto = require('crypto');

// Mirrors hmac-verifier.service.ts's exact algorithm — must match byte-for-byte.
function signSepayPayload(rawBodyString, secret, timestamp) {
  return 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBodyString}`)
    .digest('hex');
}

async function run({ baseUrl }) {
  const results = [];
  const http = axios.create({ baseURL: baseUrl, validateStatus: () => true });

  const webhookSecret = process.env.SEPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    results.push({
      name: 'SEPAY_WEBHOOK_SECRET present in environment',
      status: 'FAIL',
      detail: 'SEPAY_WEBHOOK_SECRET is not set — cannot sign webhook payloads. Check .env.',
    });
    return results;
  }

  // Setup: register + login a fresh CEO
  const testEmail = `sim-wallet-${Date.now()}@aitasker.test`;
  await http.post('/auth/register', {
    email: testEmail, password: 'Str0ng!SimPass123', fullName: 'Wallet Sim User', roles: 'CLIENT_CEO',
  });
  const loginRes = await http.post('/auth/login', { email: testEmail, password: 'Str0ng!SimPass123' });
  const token = loginRes.data.access_token;
  const authHeader = { Authorization: `Bearer ${token}` };

  // ── GET /wallets/me — fresh wallet should be zero balance ──────────────
  const balanceRes = await http.get('/wallets/me', { headers: authHeader });
  results.push({
    name: 'GET /wallets/me — returns wallet with 0 balance for new user',
    status: balanceRes.status === 200 && balanceRes.data.availableBalance === 0 ? 'PASS' : 'FAIL',
    detail: `HTTP ${balanceRes.status}: ${JSON.stringify(balanceRes.data)}`,
  });

  // POST /wallets/virtual-accounts/topup — get VA number + QR
  const topupRes = await http.post(
    '/wallets/virtual-accounts/topup',
    { amount: 50000 },
    { headers: authHeader },
  );
  results.push({
    name: 'POST /wallets/virtual-accounts/topup — returns qrCodeUrl + paymentReference',
    status: topupRes.status === 201 && topupRes.data.paymentReference && topupRes.data.qrCodeUrl ? 'PASS' : 'FAIL',
    detail: `HTTP ${topupRes.status}: ${JSON.stringify(topupRes.data)}`,
  });
  const vaNumber = topupRes.data.paymentReference;

  if (!vaNumber) {
    results.push({
      name: 'Webhook tests',
      status: 'SKIP',
      reason: 'No VA number returned from topup — cannot proceed to webhook tests',
    });
    return results;
  }

  // POST /webhooks/sepay/ipn — correctly signed, should credit wallet
  const referenceCode = `SIM-${Date.now()}`;
  const payload = {
    content: `${vaNumber} chuyen tien sim test`,
    transferAmount: '50000',
    referenceCode,
  };
  const rawBody  = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signSepayPayload(rawBody, webhookSecret, timestamp);

  const ipnRes = await http.post('/webhooks/sepay/ipn', rawBody, {
    headers: {
      'Content-Type': 'application/json',
      'x-sepay-signature': signature,
      'x-sepay-timestamp': timestamp,
    },
  });
  results.push({
    name: 'POST /webhooks/sepay/ipn — valid signature credits wallet (success:true)',
    status: ipnRes.status === 201 && ipnRes.data.success === true ? 'PASS' : 'FAIL',
    detail: `HTTP ${ipnRes.status}: ${JSON.stringify(ipnRes.data)}`,
  });

  // Verify the balance actually went up
  const afterBalanceRes = await http.get('/wallets/me', { headers: authHeader });
  results.push({
    name: 'GET /wallets/me — balance increased by 50000 after IPN',
    status: afterBalanceRes.data.availableBalance === 50000 ? 'PASS' : 'FAIL',
    detail: `Balance is ${afterBalanceRes.data.availableBalance}, expected 50000`,
  });

  // Replay the SAME webhook — idempotency check
  const replayRes = await http.post('/webhooks/sepay/ipn', rawBody, {
    headers: {
      'Content-Type': 'application/json',
      'x-sepay-signature': signature,
      'x-sepay-timestamp': timestamp,
    },
  });
  results.push({
    name: 'POST /webhooks/sepay/ipn — replay of same referenceCode returns "Already processed"',
    status: replayRes.status === 201 && replayRes.data.message === 'Already processed' ? 'PASS' : 'FAIL',
    detail: `HTTP ${replayRes.status}: ${JSON.stringify(replayRes.data)}`,
  });

  const finalBalanceRes = await http.get('/wallets/me', { headers: authHeader });
  results.push({
    name: 'GET /wallets/me — balance NOT double-credited after replay',
    status: finalBalanceRes.data.availableBalance === 50000 ? 'PASS' : 'FAIL',
    detail: `Balance is ${finalBalanceRes.data.availableBalance}, expected still 50000`,
  });

  // Invalid signature — should be rejected with 401
  const badSigRes = await http.post('/webhooks/sepay/ipn',
    JSON.stringify({ ...payload, referenceCode: `SIM-BADSIG-${Date.now()}` }),
    {
      headers: {
        'Content-Type': 'application/json',
        'x-sepay-signature': 'sha256=0000000000000000000000000000000000000000000000000000000000000000',
        'x-sepay-timestamp': timestamp,
      },
    },
  );
  results.push({
    name: 'POST /webhooks/sepay/ipn — invalid signature returns 401',
    status: badSigRes.status === 401 ? 'PASS' : 'FAIL',
    detail: `HTTP ${badSigRes.status}: ${JSON.stringify(badSigRes.data)}`,
  });

  // Stale timestamp (>5 min old) — should be rejected
  const staleTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 400s ago > 300s window
  const stalePayload = { ...payload, referenceCode: `SIM-STALE-${Date.now()}` };
  const staleRawBody = JSON.stringify(stalePayload);
  const staleSignature = signSepayPayload(staleRawBody, webhookSecret, staleTimestamp);

  const staleRes = await http.post('/webhooks/sepay/ipn', staleRawBody, {
    headers: {
      'Content-Type': 'application/json',
      'x-sepay-signature': staleSignature,
      'x-sepay-timestamp': staleTimestamp,
    },
  });
  results.push({
    name: 'POST /webhooks/sepay/ipn — timestamp older than 5 minutes returns 401',
    status: staleRes.status === 401 ? 'PASS' : 'FAIL',
    detail: `HTTP ${staleRes.status}: ${JSON.stringify(staleRes.data)}`,
  });

  return results;
}

module.exports = { run };