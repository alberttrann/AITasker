import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { DbSeeder } from './helpers/db.seeder';
import { JwtFactory } from './helpers/jwt.factory';

describe('T16: Stage 1 Gibberish Check & Tech Team Handoff Claim (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ceoId: string;
  let ceoToken: string;
  let expertId: string;
  let expertToken: string;
  let sessionId: string;
  let inviteToken: string;

  const CEO_UUID = '00000000-0000-0000-0000-cccc00000016';
  const EXPERT_UUID = '00000000-0000-0000-0000-eeee00000016';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    prisma = module.get<PrismaService>(PrismaService);

    // Dọn dẹp và seed dữ liệu hệ thống cơ bản
    await DbSeeder.cleanDatabase(prisma as any);
    await DbSeeder.seedDefaults(prisma as any);

    // 1. Tạo tài khoản CEO và kích hoạt gói Pro-C
    const ceoRes = await DbSeeder.seedUser(prisma as any, {
      id: CEO_UUID,
      email: 'ceo-handoff@test.com',
      activeRole: 'CLIENT',
      clientSubtype: 'CEO',
    });
    ceoId = ceoRes.user.id;
    ceoToken = JwtFactory.ceoToken(ceoId);

    await prisma.user.update({
      where: { id: ceoId },
      data: {
        subscriptionClientTier: 'pro',
        subClientExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days
      },
    });

    // nạp tiền giả lập vào ví để vượt qua các điều kiện logic phụ nếu có
    await prisma.wallet.update({
      where: { userId: ceoId },
      data: { availableBalance: 1000000n },
    });

    // 2. Tạo tài khoản Expert (Người nhận lời mời đã có sẵn tài khoản)
    const expertRes = await DbSeeder.seedUser(prisma as any, {
      id: EXPERT_UUID,
      email: 'expert-claiming@test.com',
      activeRole: 'EXPERT',
    });
    expertId = expertRes.user.id;
    expertToken = JwtFactory.expertToken(expertId);

    await prisma.expertProfile.create({
      data: { userId: expertId },
    });
  });

  afterAll(async () => {
    await DbSeeder.cleanDatabase(prisma as any);
    await app.close();
  });

  // Stage 1 Anti-Gibberish Check
  describe('Stage 1 - Anti-Gibberish Check', () => {
    it('should create an elicitation session successfully', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/elicitation/sessions')
        .set('Authorization', `Bearer ${ceoToken}`)
        .expect(201);

      expect(res.body.currentStage).toBe(1);
      sessionId = res.body.id;
    });

    it('should reject pure gibberish input with 400 Bad Request', async () => {
      const res = await supertest(app.getHttpServer())
        .put(`/elicitation/sessions/${sessionId}/stage1`)
        .set('Authorization', `Bearer ${ceoToken}`)
        .send({
          symptomText: 'asdfasdfasdfasdfasdfasdfasdfasdfasdfasdf', // Văn bản vô nghĩa
        })
        .expect(400);

      expect(res.body.message).toContain(
        'Your description does not contain any recognizable technical or business symptoms',
      );
    });

    it('should accept valid symptom text and progress to Stage 2', async () => {
      const res = await supertest(app.getHttpServer())
        .put(`/elicitation/sessions/${sessionId}/stage1`)
        .set('Authorization', `Bearer ${ceoToken}`)
        .send({
          symptomText:
            'Our customer support chatbot keeps giving wrong answers about our product catalogue. We have 50,000 daily users and no system to measure accuracy.',
        })
        .expect(200);

      expect(res.body.currentStage).toBe(2);
      expect(res.body.stage1SymptomsJson.length).toBeGreaterThan(0);
    }, 15000);
  });

  // Claim Handoff
  describe('Tech Team - Claim Handoff for Existing Users', () => {
    beforeAll(async () => {
      // Hoàn thiện nốt Stage 2 & Stage 3 để đủ điều kiện sinh handoff link ở Stage 4
      const recommended = ['1', '2', '3', '4', '5', '6'];
      await prisma.elicitationSession.update({
        where: { id: sessionId },
        data: {
          currentStage: 3,
          archetype: '1',
          recommendedArchetypesJson: recommended,
          stage3ProbesJson: {
            'Roughly how many people will search or ask questions per day?': '2,000',
            'When someone gets a wrong or unhelpful answer, what do you expect to happen next?':
              'Escalate',
            'Does this need to pull from documents/systems you already have, and which ones?':
              'Zendesk',
            'How quickly does an answer need to appear after someone asks?': '3 seconds',
          },
        },
      });

      // Tạo Link bàn giao
      const res = await supertest(app.getHttpServer())
        .post(`/elicitation/sessions/${sessionId}/generate-handoff-link`)
        .set('Authorization', `Bearer ${ceoToken}`)
        .expect(201);

      expect(res.body.invite_link).toBeDefined();
      inviteToken = res.body.invite_token;
    });

    it('should allow an existing logged-in Expert to claim the handoff and join Tech Team', async () => {
      const res = await supertest(app.getHttpServer())
        .post('/auth/claim-handoff')
        .set('Authorization', `Bearer ${expertToken}`)
        .send({
          invite_token: inviteToken,
        })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.user.activeRole).toBe('CLIENT');
      expect(res.body.user.clientSubtype).toBe('TECH_TEAM');

      // 1. Kiểm tra database xem TechTeamProfile có được tạo liên kết chuẩn không
      const profile = await prisma.techTeamProfile.findUnique({
        where: { userId: expertId },
      });
      expect(profile).toBeDefined();
      expect(profile?.linkedClientId).toBe(ceoId);
      expect(profile?.linkedProjectId).toBeNull(); // Chỉ gắn project thực tế khi submit Stage 4

      // 2. Kiểm tra trạng thái Session chuyển sang đã bàn giao
      const session = await prisma.elicitationSession.findUnique({
        where: { id: sessionId },
      });
      expect(session?.handoffConsumedAt).not.toBeNull();
    });

    it('should reject when trying to reclaim the already consumed handoff token', async () => {
      // Thử dùng một tài khoản khác để chiếm dụng lại token cũ
      const otherCeoToken = JwtFactory.ceoToken('00000000-0000-0000-0000-000000000099');

      const res = await supertest(app.getHttpServer())
        .post('/auth/claim-handoff')
        .set('Authorization', `Bearer ${otherCeoToken}`)
        .send({
          invite_token: inviteToken,
        })
        .expect(401);

      expect(res.body.message).toContain('already been used');
    });

    it('should reject claim if JTI has been superseded by a newly generated link', async () => {
      // 1. Tạo một session mới khác
      const newSession = await prisma.elicitationSession.create({
        data: {
          userId: ceoId,
          currentStage: 3,
          archetype: '1',
          state: 'IN_PROGRESS',
        },
      });

      // 2. CEO tạo link lần 1
      const link1 = await supertest(app.getHttpServer())
        .post(`/elicitation/sessions/${newSession.id}/generate-handoff-link`)
        .set('Authorization', `Bearer ${ceoToken}`)
        .expect(201);

      // 3. CEO tạo link lần 2 (Supersede link 1)
      await supertest(app.getHttpServer())
        .post(`/elicitation/sessions/${newSession.id}/generate-handoff-link`)
        .set('Authorization', `Bearer ${ceoToken}`)
        .expect(201);

      // 4. Cố gắng sử dụng link 1 để claim
      const res = await supertest(app.getHttpServer())
        .post('/auth/claim-handoff')
        .set('Authorization', `Bearer ${expertToken}`)
        .send({
          invite_token: link1.body.invite_token,
        })
        .expect(401);

      expect(res.body.message).toContain('superseded by a newer one');
    });
  });
});
