const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

async function run({ baseUrl }) {
  const results = [];
  const http = axios.create({ baseURL: baseUrl, validateStatus: () => true });
  const prisma = new PrismaClient();

  try {
    const testEmail = `sim-milestone-${Date.now()}@aitasker.test`;
    const registerRes = await http.post('/auth/register', {
      email: testEmail, password: 'Str0ng!SimPass123', fullName: 'Milestone Sim CEO', roles: 'CLIENT_CEO',
    });
    const ceoId = registerRes.data.id;

    const loginRes = await http.post('/auth/login', { email: testEmail, password: 'Str0ng!SimPass123' });
    const auth = { headers: { Authorization: `Bearer ${loginRes.data.access_token}` } };

    // Project.client IS a required relation field — confirmed earlier.
    const project = await prisma.project.create({
      data: { client: { connect: { id: ceoId } }, state: 'PUBLISHED' },
    });

    const expertUser = await prisma.user.create({
      data: {
        email: `sim-milestone-expert-${Date.now()}@aitasker.test`,
        passwordHash: 'not-a-real-hash',
        fullName: 'Milestone Sim Expert',
        activeRole: 'EXPERT',
      },
    });

    // Engagement.projectId IS a plain scalar FK 

    const engagement = await prisma.engagement.create({
      data: {
        projectId: project.id,
        expertId:  expertUser.id,
        clientId:  ceoId,
        type:      'PROJECT_BASED',
        state:     'ACTIVE',
      },
    });

    const milestoneRes = await http.post('/milestones', {
      engagement_id: engagement.id,
      milestone_number: 1,
      deliverable_statement: 'Simulation: deliver working RAG prototype',
      sign_off_authority: 'CEO',
      payment_amount_vnd: 5_000_000,
      criteria: [
        { criterion_text: 'API returns HTTP 200 on /health', is_required: true },
      ],
    }, auth);

    results.push({
      name: 'POST /milestones — creates milestone with persisted criteria (real HTTP)',
      status: milestoneRes.status === 201
        && milestoneRes.data.acceptanceCriteria?.length === 1
        && milestoneRes.data.state === 'DEFINED'
        ? 'PASS' : 'FAIL',
      detail: `HTTP ${milestoneRes.status}: ${JSON.stringify(milestoneRes.data)}`,
    });

    const noCriteriaRes = await http.post('/milestones', {
      engagement_id: engagement.id,
      milestone_number: 1,
      deliverable_statement: 'Should fail',
      sign_off_authority: 'CEO',
      payment_amount_vnd: 1000,
      criteria: [],
    }, auth);
    results.push({
      name: 'POST /milestones — empty criteria array returns 400',
      status: noCriteriaRes.status === 400 ? 'PASS' : 'FAIL',
      detail: `HTTP ${noCriteriaRes.status}: ${JSON.stringify(noCriteriaRes.data)}`,
    });

    const zeroPaymentRes = await http.post('/milestones', {
      engagement_id: engagement.id,
      milestone_number: 1,
      deliverable_statement: 'Should fail',
      sign_off_authority: 'CEO',
      payment_amount_vnd: 0,
      criteria: [{ criterion_text: 'x', is_required: true }],
    }, auth);
    results.push({
      name: 'POST /milestones — payment_amount_vnd=0 returns 400',
      status: zeroPaymentRes.status === 400 ? 'PASS' : 'FAIL',
      detail: `HTTP ${zeroPaymentRes.status}: ${JSON.stringify(zeroPaymentRes.data)}`,
    });

    await prisma.acceptanceCriterion.deleteMany({ where: { milestoneId: milestoneRes.data.id } });
    await prisma.milestone.deleteMany({ where: { engagementId: engagement.id } });
    await prisma.engagement.delete({ where: { id: engagement.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.delete({ where: { id: expertUser.id } });

  } finally {
    await prisma.$disconnect();
  }

  return results;
}

module.exports = { run };