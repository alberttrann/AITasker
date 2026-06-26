const axios = require('axios');

async function run({ baseUrl }) {
  const results = [];
  const http = axios.create({ baseURL: baseUrl, validateStatus: () => true });

  const testEmail = `sim-auth-${Date.now()}@aitasker.test`;
  const password   = 'Str0ng!SimPass123';

  // Register
  const registerRes = await http.post('/auth/register', {
    email: testEmail, password, fullName: 'Simulation User', roles: 'CLIENT_CEO',
  });
  results.push({
    name: 'POST /auth/register — returns 201 with id + email',
    status: registerRes.status === 201 && registerRes.data.id && registerRes.data.email ? 'PASS' : 'FAIL',
    detail: `HTTP ${registerRes.status}: ${JSON.stringify(registerRes.data)}`,
  });

  // Register duplicate — should 409
  const dupRes = await http.post('/auth/register', {
    email: testEmail, password, fullName: 'Duplicate', roles: 'CLIENT_CEO',
  });
  results.push({
    name: 'POST /auth/register — duplicate email returns 409',
    status: dupRes.status === 409 ? 'PASS' : 'FAIL',
    detail: `HTTP ${dupRes.status}: ${JSON.stringify(dupRes.data)}`,
  });

  // Login — correct credentials
  const loginRes = await http.post('/auth/login', { email: testEmail, password });
  results.push({
    name: 'POST /auth/login — returns access_token',
    status: loginRes.status === 201 && typeof loginRes.data.access_token === 'string' ? 'PASS' : 'FAIL',
    detail: `HTTP ${loginRes.status}: ${JSON.stringify(loginRes.data)}`,
  });
  const token = loginRes.data.access_token;

  // Login — wrong password
  const badLoginRes = await http.post('/auth/login', { email: testEmail, password: 'wrong-password' });
  results.push({
    name: 'POST /auth/login — wrong password returns 401',
    status: badLoginRes.status === 401 ? 'PASS' : 'FAIL',
    detail: `HTTP ${badLoginRes.status}`,
  });

  // Switch role — no EXPERT role on this account → should 401
  const switchRes = await http.put(
    '/auth/switch-role',
    { activeRole: 'EXPERT' },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  results.push({
    name: 'PUT /auth/switch-role — switching to a role not in roles[] returns 401',
    status: switchRes.status === 401 ? 'PASS' : 'FAIL',
    detail: `HTTP ${switchRes.status}: ${JSON.stringify(switchRes.data)}`,
  });

  // Protected route without token → 401
  const noAuthRes = await http.get('/wallets/me');
  results.push({
    name: 'GET /wallets/me — no Authorization header returns 401',
    status: noAuthRes.status === 401 ? 'PASS' : 'FAIL',
    detail: `HTTP ${noAuthRes.status}`,
  });

  // Logout — NOT IMPLEMENTED 
  // There is no logout endpoint anywhere in auth.controller.ts. JWTs are
  // stateless with no blacklist/revocation table
  results.push({
    name: 'POST /auth/logout',
    status: 'SKIP',
    reason: 'No logout endpoint exists — JWTs are stateless, logout is client-side only',
  });

  return results;
}

module.exports = { run };