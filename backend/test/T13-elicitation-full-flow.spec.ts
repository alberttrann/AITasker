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

  it('processes stage 1 — real ai-service call', async () => {
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
  }, 30_000);

  it('processes stage 2 — archetype selection', async () => {
    const res = await supertest(app.getHttpServer())
      .put(`/elicitation/sessions/${sessionId}/stage2`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({ archetype: '1', acknowledgedVoidCodes: [] })
      .expect(200);

    expect(res.body.currentStage).toBe(3);
    expect(res.body.archetype).toBe('1');
  });

  it('processes stage 3 — probe responses', async () => {
    const res = await supertest(app.getHttpServer())
      .put(`/elicitation/sessions/${sessionId}/stage3`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({
        probeResponses: {
          'What does success look like in 90 days?':
            'Chatbot answers correctly 90% of the time, escalation drops below 15%.',
          'What systems does this need to integrate with?':
            'Zendesk REST API and our PostgreSQL product catalogue.',
        },
      })
      .expect(200);

    expect(res.body.currentStage).toBe(4);
  });

  it('processes stage 4 — technical context', async () => {
    const res = await supertest(app.getHttpServer())
      .put(`/elicitation/sessions/${sessionId}/stage4`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .send({
        current_stack: 'Python FastAPI, PostgreSQL, AWS ECS',
        data_available: '200k Zendesk conversation logs, 50k SKU catalogue',
        latency_requirement: 'Under 3 seconds end-to-end',
      })
      .expect(200);

    expect(res.body.currentStage).toBe(5);
  });

  it('confirms and synthesizes — real ai-service stage5 call', async () => {
    const res = await supertest(app.getHttpServer())
      .post(`/elicitation/sessions/${sessionId}/confirm`)
      .set('Authorization', `Bearer ${ceoToken}`)
      .expect(201);

    // Contract check: response must have exactly these shapes per
    // ai-service TECHNICAL_DOC.md, regardless of which branch fires.
    expect(typeof res.body.completeness_score).toBe('number');
    expect(res.body.completeness_score).toBeGreaterThanOrEqual(0);
    expect(res.body.completeness_score).toBeLessThanOrEqual(1);

    if (res.body.gate_passed) {
      expect(res.body.project_id).toBeDefined();

      // Verify the project was actually created with the right shape.
      const project = await prisma.project.findUnique({
        where: { id: res.body.project_id },
      });
      expect(project?.state).toBe('PUBLISHED');
      expect(project?.requiredSeamsJson).toBeDefined();
      expect(project?.milestoneFrameworkJson).toBeDefined();
    } else {
      expect(res.body.return_to_stage).toBeGreaterThanOrEqual(1);
      expect(res.body.return_to_stage).toBeLessThanOrEqual(4);
      expect(res.body.advisory_note).toBeTruthy();
    }
  }, 90_000); // stage5-synthesize can take up to 90s per TECHNICAL_DOC.md

  it('rejects a second confirm on the same session (idempotency)', async () => {
    const res = await supertest(app.getHttpServer())
      .post(`/elicitation/sessions/${sessionId}/confirm`)
      .set('Authorization', `Bearer ${ceoToken}`);

    // Either 409 (already COMPLETED) or 400 (still RETURNED_TO_CLIENT,
    // stage data unchanged) — never a raw 500.
    expect([400, 409]).toContain(res.status);
  });
});