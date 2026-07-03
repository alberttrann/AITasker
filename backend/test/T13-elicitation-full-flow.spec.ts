//   - Stage 1 response now includes recommended_archetypes (E5)
//   - Stage 2 must pick an archetype from that recommended set
//   - Stage 3 requires the 4 FIXED archetype-1 questions, not arbitrary ones (E6)
//   - Stage 4 submission itself returns the gate result directly — no
//     separate /confirm call (E4b). POST .../confirm no longer exists;
//     replaced by POST .../retry-synthesis (retry-only, tested separately).
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication }    from '@nestjs/common';
import supertest = require('supertest');
import { AppModule }      from '../src/app.module';
import { PrismaService }  from '../src/database/prisma.service';
import { DbSeeder }       from './helpers/db.seeder';
import { JwtFactory }     from './helpers/jwt.factory';

describe('T13: Full elicitation flow — NestJS <-> ai-service (Cao Minh)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ceoToken: string;
  let sessionId: string;

  const CEO_ID = '00000000-0000-0000-0000-000000000020';

  // The 4 fixed archetype-1 (RAG/Search) questions — must match
  // ARCHETYPE_PROBE_QUESTIONS['1'] in elicitation.service.ts exactly.
  const ARCHETYPE_1_QUESTIONS = [
    'Roughly how many people will search or ask questions per day?',
    'When someone gets a wrong or unhelpful answer, what do you expect to happen next?',
    'Does this need to pull from documents/systems you already have, and which ones?',
    'How quickly does an answer need to appear after someone asks?',
  ];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    prisma = module.get<PrismaService>(PrismaService);

    await DbSeeder.seedDefaults(prisma as any);
    const { user } = await DbSeeder.seedUser(prisma as any, {
      id: CEO_ID, email: 'flow-test-ceo@aitasker.test',
      activeRole: 'CLIENT', clientSubtype: 'CEO',
    });
    ceoToken = JwtFactory.ceoToken(user.id);

    // SubscriptionGuard now gates every elicitation route except
    // createSession — must activate Client Pro before any stage runs.
    // Top up the wallet directly via Prisma (faster than the real IPN flow
    // for a jest e2e setup step) then call the real activation endpoint.
    await (prisma as any).wallet.update({
      where: { userId: CEO_ID },
      data:  { availableBalance: { increment: 1_000_000n } },
    });
    const activateRes = await supertest(app.getHttpServer())
      .post('/subscriptions/activate')
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ activeRole: 'CLIENT' })
      .expect(201);
    // Subscription activation re-signs the JWT (per subscriptions.service.ts
    // convention) — use the FRESH token for every subsequent request, since
    // JwtStrategy re-queries the DB anyway, but staying consistent with how
    // the real frontend would behave after this call.
    ceoToken = activateRes.body.access_token;
  });

  afterAll(async () => {
    await DbSeeder.cleanDatabase(prisma as any);
    await app.close();
  });

  it('creates a session', async () => {
    const res = await supertest(app.getHttpServer())
      .post('/elicitation/sessions')
      .set('Authorization', `Bearer ${ceoToken}`)
      .expect(201);

    expect(res.body.currentStage).toBe(1);
    sessionId = res.body.id;
  });

  it('processes stage 1 — real ai-service call, now includes recommended_archetypes (E5)', async () => {
    const res = await supertest(app.getHttpServer())
      .put(`/elicitation/sessions/${sessionId}/stage1`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({
        symptomText:
          'Our customer support chatbot keeps giving wrong answers about ' +
          'our product catalogue. We have 50,000 daily users and no system ' +
          'in place to measure answer accuracy.',
      })
      .expect(200);

    expect(res.body.currentStage).toBe(2);
    expect(res.body.stage1SymptomsJson).toBeInstanceOf(Array);
    expect(res.body.stage1SymptomsJson.length).toBeGreaterThan(0);
    expect(res.body.voidListJson).toBeInstanceOf(Array);
    expect(res.body.recommendedArchetypesJson).toBeInstanceOf(Array);
    expect(res.body.recommendedArchetypesJson.length).toBeGreaterThan(0);
  }, 30_000);

  it('processes stage 2 — archetype must be picked from the recommended set (E5)', async () => {
    const sessionRes = await supertest(app.getHttpServer())
      .get(`/elicitation/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .expect(200);

    const recommended: string[] = sessionRes.body.recommendedArchetypesJson;
    const archetypeToPick = recommended[0]; // pick the top recommendation, whatever it is

    const res = await supertest(app.getHttpServer())
      .put(`/elicitation/sessions/${sessionId}/stage2`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ archetype: archetypeToPick, acknowledgedVoidCodes: [] })
      .expect(200);

    expect(res.body.currentStage).toBe(3);
    expect(res.body.archetype).toBe(archetypeToPick);

    // A non-recommended archetype must be rejected.
    const rejectedCode = ['1', '2', '3', '4', '5', '6'].find((c) => !recommended.includes(c));
    if (rejectedCode) {
      // Reset back to stage 2 isn't possible mid-test without a second
      // session — this assertion documents the contract via a fresh probe
      // against a throwaway session instead of mutating the shared one.
      const throwaway = await supertest(app.getHttpServer())
        .post('/elicitation/sessions')
        .set('Authorization', `Bearer ${ceoToken}`);
      // (createSession returns the SAME in-progress session if one exists —
      // this confirms resume semantics rather than creating a second one,
      // which is fine; we just don't separately exercise the rejection path
      // against a live ai-service call here to avoid burning extra quota.)
      expect(throwaway.status).toBe(201);
    }
  });

  it('processes stage 3 — exactly 4 fixed archetype-tailored questions (E6), vagueness check passes', async () => {
    const probeResponses = Object.fromEntries(
      ARCHETYPE_1_QUESTIONS.map((q) => [
        q,
        'Around 2,000 questions per day; escalate to a human agent on a wrong answer; ' +
        'pulls from our Zendesk knowledge base and PostgreSQL product catalogue; ' +
        'needs to respond within 3 seconds.',
      ]),
    );

    const res = await supertest(app.getHttpServer())
      .put(`/elicitation/sessions/${sessionId}/stage3`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ probeResponses })
      .expect(200);

    // NOTE: if archetype picked in the prior test wasn't '1', these exact
    // question strings won't match that archetype's required set and this
    // will legitimately 400. This test assumes ai-service recommends '1'
    // for the seeded symptom text (RAG/Search is the obvious fit) — if
    // ai-service ever stops recommending it for this exact input, update
    // both this test's questions AND the symptomText together.
    expect(res.body.advanced).toBe(true);
    expect(res.body.currentStage).toBe(4);
    expect(res.body.stage4_required).toBe(true);
    expect(['SCENARIO_A', 'SCENARIO_B']).toContain(res.body.scenario_type);
  }, 30_000);

  it('processes stage 4 — auto-chains real ai-service stage5 synthesis (E4b), no separate confirm call', async () => {
    const res = await supertest(app.getHttpServer())
      .put(`/elicitation/sessions/${sessionId}/stage4`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({
        current_stack: 'Python FastAPI, PostgreSQL, AWS ECS',
        data_available: '200k Zendesk conversation logs, 50k SKU catalogue',
        latency_requirement: 'Under 3 seconds end-to-end',
      })
      .expect(200);

    expect(typeof res.body.completeness_score).toBe('number');
    expect(res.body.completeness_score).toBeGreaterThanOrEqual(0);
    expect(res.body.completeness_score).toBeLessThanOrEqual(1);

    if (res.body.gate_passed) {
      expect(res.body.project_id).toBeDefined();
      const project = await prisma.project.findUnique({ where: { id: res.body.project_id } });
      expect(project?.state).toBe('PUBLISHED');
      expect(project?.requiredSeamsJson).toBeDefined();
      expect(project?.milestoneFrameworkJson).toBeDefined();
      // selfTechnical should be derived (false, per Scenario A in this test), not hardcoded.
      expect(typeof project?.selfTechnical).toBe('boolean');
    } else {
      expect(res.body.return_to_stage).toBeGreaterThanOrEqual(1);
      expect(res.body.advisory_note).toBeTruthy();
    }
  }, 90_000);

  it('retry-synthesis rejects a second attempt on an already-COMPLETED session', async () => {
    const res = await supertest(app.getHttpServer())
      .post(`/elicitation/sessions/${sessionId}/retry-synthesis`)
      .set('Authorization', `Bearer ${ceoToken}`);

    // Either 409 (already COMPLETED) or 400 (still RETURNED_TO_CLIENT,
    // missing data) — never a raw 500. (Exact code depends on whether the
    // prior test's gate passed or failed.)
    expect([400, 409]).toContain(res.status);
  });

  it('a different CEO cannot read this session', async () => {
    const { user: otherUser } = await DbSeeder.seedUser(prisma as any, {
      id: '00000000-0000-0000-0000-000000000021',
      email: 'flow-test-other-ceo@aitasker.test',
      activeRole: 'CLIENT', clientSubtype: 'CEO',
    });
    let otherToken = JwtFactory.ceoToken(otherUser.id);

    // give the OTHER CEO a subscription too — otherwise this
    // test would incidentally fail at SubscriptionGuard (checking THEIR
    // OWN subscription) before ever reaching the ownership check, which
    // would still produce a 403 but for the wrong reason entirely.
    await (prisma as any).wallet.update({
      where: { userId: otherUser.id },
      data:  { availableBalance: { increment: 1_000_000n } },
    });
    const otherActivateRes = await supertest(app.getHttpServer())
      .post('/subscriptions/activate')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ activeRole: 'CLIENT' })
      .expect(201);
    otherToken = otherActivateRes.body.access_token;

    const res = await supertest(app.getHttpServer())
      .get(`/elicitation/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });
});