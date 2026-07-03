import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication }    from '@nestjs/common';
import supertest from 'supertest';
import { AppModule }           from '../src/app.module';
import { PrismaService }       from '../src/database/prisma.service';
import { DbSeeder }            from './helpers/db.seeder';
import { JwtFactory }          from './helpers/jwt.factory';
import { FastapiClient }       from '../src/elicitation/fastapi.client';

describe('T14: System Updates (Bulk Sync, Elicitation Mgmt, Portfolio, Shortlist)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  
  let expertToken: string;
  let expertId: string;
  let ceoToken: string;
  let ceoId: string;
  let sessionId: string;

  // Mock FastAPI to avoid real LLM calls during this specific DB/Logic test
  const mockFastapiClient = {
    portfolioEval: jest.fn(),
    matching: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(FastapiClient)
    .useValue(mockFastapiClient)
    .compile();

    app = module.createNestApplication();
    await app.init();
    prisma = module.get<PrismaService>(PrismaService);

    await DbSeeder.cleanDatabase(prisma as any);
    await DbSeeder.seedDefaults(prisma as any);

    // 1. Seed Expert
    const expertRes = await DbSeeder.seedUser(prisma as any, {
      id: '00000000-0000-0000-0000-eeee00000001',
      email: 'expert-sync@test.com',
      activeRole: 'EXPERT',
    });
    expertId = expertRes.user.id;
    expertToken = JwtFactory.expertToken(expertId);
    
    // Give expert a profile and Pro tier (for portfolio eval)
    await prisma.expertProfile.create({ data: { userId: expertId } });
    await prisma.user.update({ where: { id: expertId }, data: { subscriptionExpertTier: 'pro', subExpertExpiresAt: new Date(Date.now() + 10000000) }});

    // 2. Seed CEO
    const ceoRes = await DbSeeder.seedUser(prisma as any, {
      id: '00000000-0000-0000-0000-cccc00000001',
      email: 'ceo-mgmt@test.com',
      activeRole: 'CLIENT',
      clientSubtype: 'CEO',
    });
    ceoId = ceoRes.user.id;
    ceoToken = JwtFactory.ceoToken(ceoId);
    await prisma.user.update({ where: { id: ceoId }, data: { subscriptionClientTier: 'pro', subClientExpiresAt: new Date(Date.now() + 10000000) }});
  });

  afterAll(async () => {
    await DbSeeder.cleanDatabase(prisma as any);
    await app.close();
  });

  describe('Expert Profile Bulk Sync', () => {
    it('PUT /expert-profile/domains/sync - replaces old domains with new ones', async () => {
      // Setup: Manually insert Domain A
      await prisma.expertDomainDepth.create({
        data: { expertId: expertId, domainCode: 'A', depthLevel: 'DEEP' }
      });

      // Action: Sync sending only Domain B
      const res = await supertest(app.getHttpServer())
        .put('/expert-profile/domains/sync')
        .set('Authorization', `Bearer ${expertToken}`)
        .send({ domains: [{ domainCode: 'B', depthLevel: 'OPERATIONAL' }] })
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify: Domain A is gone, Domain B exists
      const dbDomains = await prisma.expertDomainDepth.findMany({ where: { expertId: expertId } });
      expect(dbDomains.length).toBe(1);
      expect(dbDomains[0].domainCode).toBe('B');
      expect(dbDomains[0].depthLevel).toBe('OPERATIONAL');
    });

    it('PUT /expert-profile/seams/sync - replaces old seams with new ones', async () => {
      // Setup: Manually insert Seam A<->C
      await prisma.expertSeamClaim.create({
        data: { expertId: expertId, seamCode: 'A↔C' }
      });

      // Action: Sync sending only A<->F and D<->E
      const res = await supertest(app.getHttpServer())
        .put('/expert-profile/seams/sync')
        .set('Authorization', `Bearer ${expertToken}`)
        .send({ seams: ['A↔F', 'D↔E'] })
        .expect(200);

      // Verify DB
      const dbSeams = await prisma.expertSeamClaim.findMany({ where: { expertId: expertId } });
      expect(dbSeams.length).toBe(2);
      const codes = dbSeams.map(s => s.seamCode);
      expect(codes).not.toContain('A↔C');
      expect(codes).toContain('A↔F');
      expect(codes).toContain('D↔E');
    });
  });

  describe('Elicitation Management (Revert, Abandon, Lists)', () => {
    beforeAll(async () => {
      // Create a dummy session at Stage 3
      const session = await prisma.elicitationSession.create({
        data: {
          userId: ceoId,
          currentStage: 3,
          state: 'IN_PROGRESS',
          stage1SymptomsJson: ['dummy symptom'],
          archetype: '1',
          stage3ProbesJson: { 'q1': 'a1' }
        }
      });
      sessionId = session.id;
    });

    it('GET /elicitation/sessions - lists CEO sessions', async () => {
      const res = await supertest(app.getHttpServer())
        .get('/elicitation/sessions')
        .set('Authorization', `Bearer ${ceoToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].id).toBe(sessionId);
    });

    it('PUT /elicitation/sessions/:id/revert - rolls back to Stage 1 and clears future data', async () => {
      const res = await supertest(app.getHttpServer())
        .put(`/elicitation/sessions/${sessionId}/revert`)
        .set('Authorization', `Bearer ${ceoToken}`)
        .send({ targetStage: 1 })
        .expect(200);

      expect(res.body.currentStage).toBe(1);
      expect(res.body.archetype).toBeNull();
      expect(res.body.stage3ProbesJson).toBeNull();
      
      const dbSession = await prisma.elicitationSession.findUnique({ where: { id: sessionId }});
      expect(dbSession?.stage1SymptomsJson).toBeNull(); // Stage 1 data is wiped when reverting TO stage 1
    });

    it('PUT /elicitation/sessions/:id/abandon - marks session as ABANDONED', async () => {
      const res = await supertest(app.getHttpServer())
        .put(`/elicitation/sessions/${sessionId}/abandon`)
        .set('Authorization', `Bearer ${ceoToken}`)
        .expect(200);

      expect(res.body.state).toBe('ABANDONED');
    });

    it('PUT /elicitation/sessions/:id/continue - marks session as IN_PROGRESS', async () => {
      const res = await supertest(app.getHttpServer())
        .put(`/elicitation/sessions/${sessionId}/continue`)
        .set('Authorization', `Bearer ${ceoToken}`)
        .expect(200);

      expect(res.body.state).toBe('IN_PROGRESS');
    });

    it('GET /projects - lists CEO projects', async () => {
      // Seed a project
      await prisma.project.create({
        data: { clientId: ceoId, state: 'PUBLISHED' }
      });

      const res = await supertest(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${ceoToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].clientId).toBe(ceoId);
    });
  });

  describe('Portfolio Rejection & Shortlist Adjustments', () => {
    it('POST /portfolio-submissions - returns attemptsRemaining and lockedUntil on rejection', async () => {
      // Mock AI rejection
      mockFastapiClient.portfolioEval.mockResolvedValueOnce({
        confidence_score: 0.60,
        passed_boolean: false,
        gap_advisory: 'Missing data'
      });

      // Get the seam claim ID we created in the sync test
      const claim = await prisma.expertSeamClaim.findFirst({ where: { expertId: expertId }});

      const res = await supertest(app.getHttpServer())
        .post('/portfolio-submissions')
        .set('Authorization', `Bearer ${expertToken}`)
        .send({
          seamClaimId: claim!.id,
          projectDescription: 'x'.repeat(55),
          decisionPoints: 'y'.repeat(25)
        })
        .expect(201);

      expect(res.body.status).toBe('REJECTED');
      expect(res.body.attemptsRemaining).toBe(4); // 5 minus 1 attempt
      expect(res.body.lockedUntil).toBeNull(); // Not locked yet
    });

    it('GET /matching/:projectId/shortlist - appends contact_info to matched experts', async () => {
      // Mock matching return from FastAPI
      mockFastapiClient.matching.mockResolvedValueOnce([{
        expert_id: expertId,
        composite_score: 0.95,
        strength_label: 'STRONG_MATCH',
        gap_map: []
      }]);

      const project = await prisma.project.findFirst({ where: { clientId: ceoId }});

      const res = await supertest(app.getHttpServer())
        .get(`/matching/${project!.id}/shortlist`)
        .set('Authorization', `Bearer ${ceoToken}`)
        .expect(200);

      expect(res.body.length).toBe(1);
      expect(res.body[0].expert_id).toBe(expertId);
      
      // Numeric score should NOT be present
      expect(res.body[0].composite_score).toBeUndefined();
      
      // NEW: Contact info MUST be present
      expect(res.body[0].contact_info).toBeDefined();
      expect(res.body[0].contact_info.email).toBe('expert-sync@test.com');
      expect(res.body[0].contact_info.fullName).toBeDefined();
    });
  });
});