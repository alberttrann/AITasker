const axios = require('axios');

async function run({ baseUrl }) {
  const results = [];
  const http = axios.create({ baseURL: baseUrl, validateStatus: () => true, timeout: 100_000 });

  // Register + login a fresh CEO via REAL endpoints
  const testEmail = `sim-elicit-${Date.now()}@aitasker.test`;
  await http.post('/auth/register', {
    email: testEmail, password: 'Str0ng!SimPass123', fullName: 'Elicitation Sim CEO', roles: 'CLIENT_CEO',
  });
  const loginRes = await http.post('/auth/login', { email: testEmail, password: 'Str0ng!SimPass123' });
  const token = loginRes.data.access_token;
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  // Create session
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

  // Stage 1 — REAL ai-service call 
  const stage1Res = await http.put(`/elicitation/sessions/${sessionId}/stage1`, {
    symptomText:
      'Our customer support chatbot keeps giving wrong answers about our product ' +
      'catalogue. We have 50,000 daily users and no system to measure accuracy.',
  }, auth);
  results.push({
    name: 'PUT .../stage1 — real ai-service call, advances to stage 2 with symptoms+voids',
    status: stage1Res.status === 200
      && stage1Res.data.currentStage === 2
      && Array.isArray(stage1Res.data.stage1SymptomsJson)
      && stage1Res.data.stage1SymptomsJson.length > 0
      ? 'PASS' : 'FAIL',
    detail: `HTTP ${stage1Res.status}: ${JSON.stringify(stage1Res.data)}`,
  });

  // Stage 2
  const stage2Res = await http.put(`/elicitation/sessions/${sessionId}/stage2`, {
    archetype: '1', acknowledgedVoidCodes: [],
  }, auth);
  results.push({
    name: 'PUT .../stage2 — archetype locked, advances to stage 3',
    status: stage2Res.status === 200 && stage2Res.data.currentStage === 3 && stage2Res.data.archetype === '1' ? 'PASS' : 'FAIL',
    detail: `HTTP ${stage2Res.status}: ${JSON.stringify(stage2Res.data)}`,
  });

  // Stage 3
  const stage3Res = await http.put(`/elicitation/sessions/${sessionId}/stage3`, {
    probeResponses: {
      'What does success look like in 90 days?': 'Chatbot correct 90% of the time, escalation under 15%.',
      'What systems does this need to integrate with?': 'Zendesk REST API and our PostgreSQL catalogue.',
    },
  }, auth);
  results.push({
    name: 'PUT .../stage3 — probes saved, advances to stage 4',
    status: stage3Res.status === 200 && stage3Res.data.currentStage === 4 ? 'PASS' : 'FAIL',
    detail: `HTTP ${stage3Res.status}: ${JSON.stringify(stage3Res.data)}`,
  });

  // Stage 4
  const stage4Res = await http.put(`/elicitation/sessions/${sessionId}/stage4`, {
    current_stack: 'Python FastAPI, PostgreSQL, AWS ECS',
    data_available: '200k Zendesk conversation logs, 50k SKU catalogue',
    latency_requirement: 'Under 3 seconds end-to-end',
  }, auth);
  results.push({
    name: 'PUT .../stage4 — tech context saved, advances to stage 5',
    status: stage4Res.status === 200 && stage4Res.data.currentStage === 5 ? 'PASS' : 'FAIL',
    detail: `HTTP ${stage4Res.status}: ${JSON.stringify(stage4Res.data)}`,
  });

  // Confirm — REAL ai-service stage5-synthesize call
  console.log('    (calling real ai-service stage5-synthesize — this can take up to 90s...)');
  const confirmRes = await http.post(`/elicitation/sessions/${sessionId}/confirm`, {}, auth);
  const score = confirmRes.data.completeness_score;
  results.push({
    name: 'POST .../confirm — real ai-service synthesis, returns completeness_score [0,1]',
    status: confirmRes.status === 201 && typeof score === 'number' && score >= 0 && score <= 1 ? 'PASS' : 'FAIL',
    detail: `HTTP ${confirmRes.status}: ${JSON.stringify(confirmRes.data)}`,
  });

  if (confirmRes.data.gate_passed) {
    results.push({
      name: 'Gate passed branch — project_id returned',
      status: confirmRes.data.project_id ? 'PASS' : 'FAIL',
      detail: `project_id: ${confirmRes.data.project_id}`,
    });
  } else {
    results.push({
      name: 'Gate failed branch — return_to_stage in [1,4] and advisory_note present',
      status: confirmRes.data.return_to_stage >= 1
        && confirmRes.data.return_to_stage <= 4
        && !!confirmRes.data.advisory_note
        ? 'PASS' : 'FAIL',
      detail: JSON.stringify(confirmRes.data),
    });
  }

  // Re-confirm same session — must NOT 500, must be 400 or 409 
  const reConfirmRes = await http.post(`/elicitation/sessions/${sessionId}/confirm`, {}, auth);
  results.push({
    name: 'POST .../confirm (second call) — returns 400/409, never a raw 500',
    status: [400, 409].includes(reConfirmRes.status) ? 'PASS' : 'FAIL',
    detail: `HTTP ${reConfirmRes.status}: ${JSON.stringify(reConfirmRes.data)}`,
  });

  // Ownership — a second CEO cannot read this session
  const otherEmail = `sim-elicit-other-${Date.now()}@aitasker.test`;
  await http.post('/auth/register', {
    email: otherEmail, password: 'Str0ng!SimPass123', fullName: 'Other CEO', roles: 'CLIENT_CEO',
  });
  const otherLoginRes = await http.post('/auth/login', { email: otherEmail, password: 'Str0ng!SimPass123' });
  const otherAuth = { headers: { Authorization: `Bearer ${otherLoginRes.data.access_token}` } };

  const intrusionRes = await http.get(`/elicitation/sessions/${sessionId}`, otherAuth);
  results.push({
    name: 'GET .../sessions/:id — a different CEO cannot read this session (403)',
    status: intrusionRes.status === 403 ? 'PASS' : 'FAIL',
    detail: `HTTP ${intrusionRes.status}: ${JSON.stringify(intrusionRes.data)}`,
  });

  return results;
}

module.exports = { run };