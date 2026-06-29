import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication }    from '@nestjs/common';
import supertest = require('supertest');
import { AppModule }           from '../src/app.module';
import { PrismaService }       from '../src/database/prisma.service';
import { DbSeeder }            from './helpers/db.seeder';
import { JwtFactory }          from './helpers/jwt.factory';
import { IpnHandlerService }   from '../src/payments/ipn-handler.service';
import { EventEmitter2 }       from '@nestjs/event-emitter';

describe('T15: UX Refinements (WebSockets, AI Fallback, Bid Counts, Hard Delete)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;
  
  let ceoToken: string;
  let ceoId: string;
  let sessionId: string;
  let topupVaNumber: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    prisma = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    await DbSeeder.cleanDatabase(prisma as any);
    await DbSeeder.seedDefaults(prisma as any);

    // 1. Seed CEO
    const ceoRes = await DbSeeder.seedUser(prisma as any, {
      id: '00000000-0000-0000-0000-cccc00000002',
      email: 'ceo-ux@test.com',
      activeRole: 'CLIENT',
      clientSubtype: 'CEO',
    });
    ceoId = ceoRes.user.id;
    ceoToken = JwtFactory.ceoToken(ceoId);
    await prisma.user.update({ where: { id: ceoId }, data: { subscriptionClientTier: 'pro', subClientExpiresAt: new Date(Date.now() + 10000000) }});

    // Manually seed the VirtualAccount since DbSeeder.seedUser bypasses the /auth/register endpoint
    topupVaNumber = 'UX_TEST_VA_123';
    await prisma.virtualAccount.create({
      data: {
        entityId: ceoId,
        entityType: 'WALLET_TOPUP',
        vaNumber: topupVaNumber,
        status: 'ACTIVE'
      }
    });
  });

  afterAll(async () => {
    await DbSeeder.cleanDatabase(prisma as any);
    await app.close();
  });

  describe('Refinement 1: Real-Time WebSockets for Payments', () => {
    it('Emits wallet:balance-updated and notification:generic events on IPN top-up', async () => {
      const ipnHandler = app.get<IpnHandlerService>(IpnHandlerService);
      
      // Spy on the global event emitter
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      // Trigger a raw IPN payload programmatically (bypassing HMAC guard for the test)
      await ipnHandler.handleIpn({
        content: `${topupVaNumber} chuyen tien test`,
        transferAmount: '500000',
        referenceCode: 'TX-UX-1'
      });

      // Verify the websocket broadcast events were fired
      expect(emitSpy).toHaveBeenCalledWith('socket.broadcast', expect.objectContaining({
        userId: ceoId,
        event: 'wallet:balance-updated',
        payload: expect.objectContaining({
          transaction_type: 'TOP_UP',
          amount: 500000
        })
      }));

      expect(emitSpy).toHaveBeenCalledWith('socket.broadcast', expect.objectContaining({
        userId: ceoId,
        event: 'notification:generic',
        payload: expect.objectContaining({
          title: 'Top-up Successful'
        })
      }));
    });
  });

  describe('Refinement 2: Project List Enrichment (Bid Counts)', () => {
    it('GET /projects includes _count.engagements for the CEO', async () => {
      // 1. Create a Project
      const project = await prisma.project.create({
        data: { clientId: ceoId, state: 'PUBLISHED' }
      });

      // 2. Create an Expert & an Engagement (Bid) against that project
      const expert = await DbSeeder.seedUser(prisma as any, {
        id: '00000000-0000-0000-0000-eeee00000002',
        email: 'expert-ux@test.com',
        activeRole: 'EXPERT',
      });
      await prisma.engagement.create({
        data: {
          projectId: project.id,
          expertId: expert.user.id,
          clientId: ceoId,
          type: 'PROJECT_BASED',
          state: 'PENDING'
        }
      });

      // 3. Call GET /projects
      const res = await supertest(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${ceoToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      
      const foundProject = res.body.find((p: any) => p.id === project.id);
      expect(foundProject).toBeDefined();
      
      // Verification: The _count object must be present and engagements must be 1
      expect(foundProject._count).toBeDefined();
      expect(foundProject._count.engagements).toBe(1);
    });
  });

  describe('Refinement 3: Hard Delete (Hủy) Session', () => {
    beforeAll(async () => {
      // Create a dummy session
      const session = await prisma.elicitationSession.create({
        data: {
          userId: ceoId,
          currentStage: 2,
          state: 'IN_PROGRESS',
        }
      });
      sessionId = session.id;
    });

    it('DELETE /elicitation/sessions/:id - physically removes the row', async () => {
      const res = await supertest(app.getHttpServer())
        .delete(`/elicitation/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${ceoToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify the row is gone from the database
      const dbCheck = await prisma.elicitationSession.findUnique({ where: { id: sessionId }});
      expect(dbCheck).toBeNull();
    });

    it('DELETE /elicitation/sessions/:id - throws 409 Conflict if session is COMPLETED (published)', async () => {
      const completedSession = await prisma.elicitationSession.create({
        data: {
          userId: ceoId,
          currentStage: 5,
          state: 'COMPLETED',
        }
      });

      const res = await supertest(app.getHttpServer())
        .delete(`/elicitation/sessions/${completedSession.id}`)
        .set('Authorization', `Bearer ${ceoToken}`)
        .expect(409);

      expect(res.body.message).toContain('already been published');
    });
  });
});