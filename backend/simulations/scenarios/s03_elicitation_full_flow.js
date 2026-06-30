//   - Stage 1 must return recommended_archetypes now
//   - Stage 2 picks from that recommended set (whatever ai-service returns,
//     not hardcoded '1' anymore — that would fail if ai-service ever
//     recommends something else for this symptom text)
//   - Stage 3 needs the 4 FIXED questions for whichever archetype was picked
//   - Stage 4 itself returns the gate result — no separate /confirm call
//   - inviteTechTeam no longer takes an email body
const axios = require('axios');
const crypto = require('crypto');

// Mirrors hmac-verifier.service.ts's exact algorithm — same pattern as
// s02_wallet_and_webhook.js. Needed here because Phase 1a now gates every
// elicitation route except session creation behind SubscriptionGuard —
// this simulation can't touch Prisma directly (it's a live HTTP test
// against a real running server), so it must go through the REAL
// top-up → webhook → activate flow, same as a real user would.
function signSepayPayload(rawBodyString, secret, timestamp) {
  return 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBodyString}`)
    .digest('hex');
}

// Mirrors ARCHETYPE_PROBE_QUESTIONS in elicitation.service.ts exactly —
// must stay in sync if that table ever changes.
const ARCHETYPE_PROBE_QUESTIONS = {
  '1': [
    'Roughly how many people will search or ask questions per day?',
    'When someone gets a wrong or unhelpful answer, what do you expect to happen next?',
    'Does this need to pull from documents/systems you already have, and which ones?',
    'How quickly does an answer need to appear after someone asks?',
  ],
  '2': [
    'Roughly how many users will see recommendations, and how often?',
    'What should happen if someone ignores or dislikes a recommendation?',
    'Where do you already track what users like/buy/view — any existing system?',
    'How fresh do recommendations need to be (instant, hourly, daily)?',
  ],
  '3': [
    'Roughly how many items need classifying per day?',
    "What should happen when the system isn\u2019t confident about a classification?",
    'Where does the data to classify come from today — any existing system?',
    'How quickly does a classification decision need to be made?',
  ],
  '4': [
    'Roughly how much content needs generating per day/week?',
    'What happens if generated content is wrong or inappropriate — who reviews it?',
    'Does generated content need to match an existing brand voice/system/template?',
    'How long can someone wait for content to be generated?',
  ],
  '5': [
    'How far ahead are you trying to predict, and how often do you need a new prediction?',
    'What happens today when a prediction turns out wrong?',
    'What historical data do you already have to learn from?',
    'How quickly after new data arrives do you need an updated prediction?',
  ],
  '6': [
    'Roughly how many items (images/audio/video) need processing per day?',
    "What should happen when the system can\u2019t confidently interpret an input?",
    'Where does this input data come from today — any existing system?',
    'How quickly does processing need to complete after input arrives?',
  ],
};

async function run({ baseUrl }) {
  const results = [];
  const http = axios.create({ baseURL: baseUrl, validateStatus: () => true, timeout: 100_000 });

  const testEmail = `sim-elicit-${Date.now()}@aitasker.test`;
  await http.post('/auth/register', {
    email: testEmail, password: 'Str0ng!SimPass123', fullName: 'Elicitation Sim CEO', roles: 'CLIENT_CEO',
  });
  const loginRes = await http.post('/auth/login', { email: testEmail, password: 'Str0ng!SimPass123' });
  let token = loginRes.data.access_token;
  let auth = { headers: { Authorization: `Bearer ${token}` } };

  // SubscriptionGuard now gates every elicitation route except
  // session creation — must top up the wallet and activate Client Pro
  // before any stage runs, through the REAL endpoints (top-up QR → signed
  // webhook → activate), exactly as a real CEO would.
  const webhookSecret = process.env.SEPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    results.push({
      name: 'Subscription activation prerequisite',
      status: 'FAIL',
      detail: 'SEPAY_WEBHOOK_SECRET not set — cannot sign webhook payload to fund wallet.',
    });
    return results;
  }

  const topupRes = await http.post('/wallets/virtual-accounts/topup', { amount: 1_000_000 }, auth);
  const vaNumber = topupRes.data.paymentReference;
  if (!vaNumber) {
    results.push({ name: 'Subscription activation prerequisite', status: 'FAIL', detail: 'No VA number returned from topup' });
    return results;
  }

  const referenceCode = `SIM-ELICIT-SUB-${Date.now()}`;
  const payload = { content: `${vaNumber} chuyen tien sim test`, transferAmount: '1000000', referenceCode };
  const rawBody = JSON.stringify(payload);
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
    name: 'Wallet funded via real webhook (prerequisite for subscription activation)',
    status: ipnRes.status === 201 && ipnRes.data.success === true ? 'PASS' : 'FAIL',
    detail: `HTTP ${ipnRes.status}: ${JSON.stringify(ipnRes.data)}`,
  });

  const activateRes = await http.post('/subscriptions/activate', { activeRole: 'CLIENT' }, auth);
  results.push({
    name: 'POST /subscriptions/activate — Client Pro activated, returns fresh access_token (Phase 1a prerequisite)',
    status: activateRes.status === 201 && activateRes.data.access_token ? 'PASS' : 'FAIL',
    detail: `HTTP ${activateRes.status}: ${JSON.stringify(activateRes.data)}`,
  });
  if (activateRes.data.access_token) {
    token = activateRes.data.access_token;
    auth = { headers: { Authorization: `Bearer ${token}` } };
  } else {
    results.push({ name: 'Remaining stages', status: 'SKIP', reason: 'Subscription activation failed — every stage route is now Pro-C gated' });
    return results;
  }

  const sessionRes = await http.post('/elicitation/sessions', {}, auth);
  results.push({
    name: 'POST /elicitation/sessions — creates session at stage 1',
    status: sessionRes.status === 201 && sessionRes.data.currentStage === 1 ? 'PASS' : 'FAIL',
    detail: `HTTP ${sessionRes.status}: ${JSON.stringify(sessionRes.data)}`,
  });
  const sessionId = sessionRes.data.id;
  if (!sessionId) {
    results.push({ name: 'Remaining stages', status: 'SKIP', reason: 'No session ID — cannot proceed' });
    return results;
  }

  // Stage 1 — now also asserts recommended_archetypes 
  const stage1Res = await http.put(`/elicitation/sessions/${sessionId}/stage1`, {
    symptomText:
      'Our customer support chatbot keeps giving wrong answers about our product ' +
      'catalogue. We have 50,000 daily users and no system to measure accuracy.',
  }, auth);
  const recommended = stage1Res.data.recommendedArchetypesJson;
  results.push({
    name: 'PUT .../stage1 — real ai-service call, returns symptoms+voids+recommended_archetypes',
    status: stage1Res.status === 200
      && stage1Res.data.currentStage === 2
      && Array.isArray(stage1Res.data.stage1SymptomsJson)
      && stage1Res.data.stage1SymptomsJson.length > 0
      && Array.isArray(recommended)
      && recommended.length > 0
      ? 'PASS' : 'FAIL',
    detail: `HTTP ${stage1Res.status}: ${JSON.stringify(stage1Res.data)}`,
  });

  if (!Array.isArray(recommended) || recommended.length === 0) {
    results.push({ name: 'Remaining stages', status: 'SKIP', reason: 'No recommended archetypes returned' });
    return results;
  }

  // Stage 2 — pick whatever ai-service actually recommended, not hardcoded
  const archetypeToPick = recommended[0];
  const stage2Res = await http.put(`/elicitation/sessions/${sessionId}/stage2`, {
    archetype: archetypeToPick, acknowledgedVoidCodes: [],
  }, auth);
  results.push({
    name: 'PUT .../stage2 — archetype from recommended set accepted (E5)',
    status: stage2Res.status === 200 && stage2Res.data.currentStage === 3 && stage2Res.data.archetype === archetypeToPick ? 'PASS' : 'FAIL',
    detail: `HTTP ${stage2Res.status}: ${JSON.stringify(stage2Res.data)}`,
  });

  // Negative check: a non-recommended archetype should be rejected.
  // Run against a SEPARATE throwaway session to avoid disturbing the main flow.
  const allCodes = ['1', '2', '3', '4', '5', '6'];
  const rejectedCode = allCodes.find((c) => !recommended.includes(c));
  if (rejectedCode) {
    const throwawaySession = await http.post('/elicitation/sessions', {}, auth);
    // createSession returns the SAME in-progress session (resume semantics) —
    // so this will be the same sessionId, already past stage 2. Instead,
    // just verify the validation logic directly is documented behavior;
    // skip live-firing this specific negative case to avoid disrupting the
    // main flow's session state.
    results.push({
      name: 'PUT .../stage2 — non-recommended archetype rejection (E5)',
      status: 'SKIP',
      reason: 'Validated via unit tests (elicitation.service.spec.ts) — not exercised live to avoid disturbing the shared session',
    });
  }

  // Stage 3 — 4 FIXED questions for whichever archetype was picked 
  const requiredQuestions = ARCHETYPE_PROBE_QUESTIONS[archetypeToPick];
  const probeResponses = Object.fromEntries(
    requiredQuestions.map((q) => [
      q,
      'Around 2,000 per day; escalate to a human on failure; integrates with our ' +
      'existing Zendesk and PostgreSQL systems; needs to respond within 3 seconds.',
    ]),
  );
  const stage3Res = await http.put(`/elicitation/sessions/${sessionId}/stage3`, { probeResponses }, auth);
  results.push({
    name: 'PUT .../stage3 — 4 fixed archetype-tailored questions answered, vagueness check passes',
    status: stage3Res.status === 200 && stage3Res.data.advanced === true && stage3Res.data.currentStage === 4
      ? 'PASS' : 'FAIL',
    detail: `HTTP ${stage3Res.status}: ${JSON.stringify(stage3Res.data)}`,
  });

  // Negative check: a vague answer should NOT advance the stage.
  const vagueProbeResponses = Object.fromEntries(requiredQuestions.map((q) => [q, 'a lot, fast, somehow']));
  // Can't re-test stage3 on the same session (already advanced) — this is
  // covered by the unit test suite instead (processStage3 vagueness tests).
  results.push({
    name: 'PUT .../stage3 — vague answer rejection',
    status: 'SKIP',
    reason: 'Validated via unit tests — session already advanced past stage 3 in this run',
  });

  // Stage 4 — CHANGED: now returns the synthesis gate result DIRECTLY 
  console.log('    (stage4 now auto-chains real ai-service stage5-synthesize — up to 90s...)');
  const stage4Res = await http.put(`/elicitation/sessions/${sessionId}/stage4`, {
    current_stack: 'Python FastAPI, PostgreSQL, AWS ECS',
    data_available: '200k Zendesk conversation logs, 50k SKU catalogue',
    latency_requirement: 'Under 3 seconds end-to-end',
  }, auth);
  const score = stage4Res.data.completeness_score;
  results.push({
    name: 'PUT .../stage4 — auto-chains real ai-service synthesis, returns gate result directly',
    status: stage4Res.status === 200 && typeof score === 'number' && score >= 0 && score <= 1 ? 'PASS' : 'FAIL',
    detail: `HTTP ${stage4Res.status}: ${JSON.stringify(stage4Res.data)}`,
  });

  if (stage4Res.data.gate_passed) {
    results.push({
      name: 'Gate passed branch — project_id returned (E10: all 3 conditions met)',
      status: stage4Res.data.project_id ? 'PASS' : 'FAIL',
      detail: `project_id: ${stage4Res.data.project_id}`,
    });
  } else {
    results.push({
      name: 'Gate failed branch — return_to_stage and advisory_note present',
      status: stage4Res.data.advisory_note ? 'PASS' : 'FAIL',
      detail: JSON.stringify(stage4Res.data),
    });
  }

  // Retry-synthesis — CHANGED: was /confirm, now retry-only
  const retryRes = await http.post(`/elicitation/sessions/${sessionId}/retry-synthesis`, {}, auth);
  results.push({
    name: 'POST .../retry-synthesis (second call) — returns 400/409, never a raw 500',
    status: [400, 409].includes(retryRes.status) ? 'PASS' : 'FAIL',
    detail: `HTTP ${retryRes.status}: ${JSON.stringify(retryRes.data)}`,
  });

  // invite-tech-team — no email body anymore
  const inviteRes = await http.post(`/elicitation/sessions/${sessionId}/generate-handoff-link`, {}, auth);
  results.push({
    name: 'POST .../invite-tech-team — no email required, returns link with jti',
    status: inviteRes.status === 201 && inviteRes.data.invite_link && inviteRes.data.expires_in === '72h'
      ? 'PASS' : 'FAIL',
    detail: `HTTP ${inviteRes.status}: ${JSON.stringify(inviteRes.data)}`,
  });

  // Ownership check: the "other CEO" now ALSO needs an
  // active subscription, otherwise this would incidentally fail at
  // SubscriptionGuard (checking THEIR OWN subscription, not the target
  // session's owner) before ever reaching the real ownership check —
  // same 403, but testing the wrong thing entirely.
  const otherEmail = `sim-elicit-other-${Date.now()}@aitasker.test`;
  await http.post('/auth/register', {
    email: otherEmail, password: 'Str0ng!SimPass123', fullName: 'Other CEO', roles: 'CLIENT_CEO',
  });
  const otherLoginRes = await http.post('/auth/login', { email: otherEmail, password: 'Str0ng!SimPass123' });
  let otherToken = otherLoginRes.data.access_token;
  let otherAuth = { headers: { Authorization: `Bearer ${otherToken}` } };

  const otherTopupRes = await http.post('/wallets/virtual-accounts/topup', { amount: 1_000_000 }, otherAuth);
  const otherVaNumber = otherTopupRes.data.paymentReference;
  if (otherVaNumber) {
    const otherRefCode = `SIM-ELICIT-OTHER-SUB-${Date.now()}`;
    const otherPayload = { content: `${otherVaNumber} chuyen tien sim test`, transferAmount: '1000000', referenceCode: otherRefCode };
    const otherRawBody = JSON.stringify(otherPayload);
    const otherTimestamp = Math.floor(Date.now() / 1000).toString();
    const otherSignature = signSepayPayload(otherRawBody, webhookSecret, otherTimestamp);
    await http.post('/webhooks/sepay/ipn', otherRawBody, {
      headers: { 'Content-Type': 'application/json', 'x-sepay-signature': otherSignature, 'x-sepay-timestamp': otherTimestamp },
    });
    const otherActivateRes = await http.post('/subscriptions/activate', { activeRole: 'CLIENT' }, otherAuth);
    if (otherActivateRes.data.access_token) {
      otherToken = otherActivateRes.data.access_token;
      otherAuth = { headers: { Authorization: `Bearer ${otherToken}` } };
    }
  }

  const intrusionRes = await http.get(`/elicitation/sessions/${sessionId}`, otherAuth);
  results.push({
    name: 'GET .../sessions/:id — a different (also Pro-C) CEO cannot read this session (403, genuine ownership check)',
    status: intrusionRes.status === 403 ? 'PASS' : 'FAIL',
    detail: `HTTP ${intrusionRes.status}: ${JSON.stringify(intrusionRes.data)}`,
  });

  return results;
}

module.exports = { run };