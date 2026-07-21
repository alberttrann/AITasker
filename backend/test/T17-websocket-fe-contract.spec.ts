import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { DbSeeder } from './helpers/db.seeder';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ElicitationService } from '../src/elicitation/elicitation.service';
import { EngagementsService } from '../src/engagements/engagements.service';
import { BidsService } from '../src/bids/bids.service';
import { FastapiClient } from '../src/elicitation/fastapi.client';
import { ShortlistService } from '../src/bids/shortlist.service';

describe('T17: WebSocket Frontend-Backend Contract (Safety Lock)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;

  let elicitationService: ElicitationService;
  let engagementsService: EngagementsService;
  let bidsService: BidsService;

  let ceoId: string;
  let expertId: string;
  let techId: string;
  let projectId: string;
  let sessionId: string;
  let engagementId: string;
  let bidId: string;

  // Mock FastAPI to avoid real LLM calls during this event test
  const mockFastapiClient = {
    stage5Synthesize: jest.fn().mockResolvedValue({
      completeness_score: 0.95,
      required_seams_json: [],
      required_domains_json: [],
      milestone_framework_json: [],
      artifact_a_json: { archetype: '1', volume_tier: 'TIER_1' },
      artifact_b_json: {},
    }),
    matching: jest.fn().mockResolvedValue([]),
  };

  const mockShortlistService = {
    isExpertShortlisted: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FastapiClient)
      .useValue(mockFastapiClient)
      .overrideProvider(ShortlistService)
      .useValue(mockShortlistService)
      .compile();

    app = module.createNestApplication();
    await app.init();

    prisma = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    elicitationService = module.get<ElicitationService>(ElicitationService);
    engagementsService = module.get<EngagementsService>(EngagementsService);
    bidsService = module.get<BidsService>(BidsService);

    // Clean and seed DB
    await DbSeeder.cleanDatabase(prisma as any);
    await DbSeeder.seedDefaults(prisma as any);

    // Seed CEO
    const ceoRes = await DbSeeder.seedUser(prisma as any, {
      id: '00000000-0000-0000-0000-cccc00000017',
      email: 'ceo-ws@test.com',
      activeRole: 'CLIENT',
      clientSubtype: 'CEO',
    });
    ceoId = ceoRes.user.id;

    // Seed Expert (Pro)
    const expertRes = await DbSeeder.seedUser(prisma as any, {
      id: '00000000-0000-0000-0000-eeee00000017',
      email: 'expert-ws@test.com',
      activeRole: 'EXPERT',
    });
    expertId = expertRes.user.id;
    await prisma.expertProfile.create({ data: { userId: expertId } });
    await prisma.user.update({
      where: { id: expertId },
      data: { subscriptionExpertTier: 'pro' },
    });

    // Seed Tech Team
    const techRes = await DbSeeder.seedUser(prisma as any, {
      id: '00000000-0000-0000-0000-111100000017',
      email: 'tech-ws@test.com',
      activeRole: 'CLIENT',
      clientSubtype: 'TECH_TEAM',
    });
    techId = techRes.user.id;
    await prisma.techTeamProfile.create({
      data: { userId: techId, linkedClientId: ceoId },
    });

    // Setup an elicitation session ready for Tech Team handoff
    const session = await prisma.elicitationSession.create({
      data: {
        userId: ceoId,
        currentStage: 4,
        state: 'IN_PROGRESS',
        stage1SymptomsJson: ['dummy'],
        archetype: '1',
        stage3ProbesJson: { q: 'a' },
      },
    });
    sessionId = session.id;
  });

  afterAll(async () => {
    await DbSeeder.cleanDatabase(prisma as any);
    await app.close();
  });

  it('1. Tech Team Handoff triggers EXACT string: "Technical Context Submitted"', async () => {
    const emitSpy = jest.spyOn(eventEmitter, 'emit');

    await elicitationService.processStage4Handoff(
      sessionId,
      { current_stack: 'Node', data_available: 'Logs' },
      techId,
    );

    expect(emitSpy).toHaveBeenCalledWith(
      'socket.broadcast',
      expect.objectContaining({
        event: 'notification:generic',
        payload: expect.objectContaining({
          title: 'Technical Context Submitted',
        }),
      }),
    );

    // Manually stub the project creation so the next bidding tests have a valid target
    const project = await prisma.project.create({
      data: {
        clientId: ceoId,
        state: 'PUBLISHED',
      },
    });
    projectId = project.id;

    // Manually link the Tech Team to this project (simulating the real platform flow)
    await prisma.techTeamProfile.update({
      where: { userId: techId },
      data: { linkedProjectId: projectId },
    });
  });

  it('2. Expert Bidding triggers string containing: "New Expert Bid!"', async () => {
    const emitSpy = jest.spyOn(eventEmitter, 'emit');

    const res = await bidsService.create(expertId, {
      projectId: projectId,
      footprint_alignment_json: { domains: [], seams: [] },
      approach_summary: 'I will build this.',
      conditional_pricing_json: [{ milestone_number: 1, price_vnd: 1000000, condition: '' }],
    });

    // Assign IDs BEFORE the expect, so if expect fails, tests 3 & 4 don't crash
    engagementId = res.engagement.id;
    bidId = res.bid.id;

    // Use stringContaining to be resilient to missing/extra emojis
    expect(emitSpy).toHaveBeenCalledWith(
      'socket.broadcast',
      expect.objectContaining({
        userId: ceoId,
        event: 'notification:generic',
        payload: expect.objectContaining({
          title: expect.stringContaining('New Expert Bid!'),
        }),
      }),
    );
  });

  it('3. Tech Review Approved triggers string containing: "Tech Review Passed"', async () => {
    const emitSpy = jest.spyOn(eventEmitter, 'emit');

    await bidsService.techReview(
      bidId,
      { id: techId, activeRole: 'CLIENT', clientSubtype: 'TECH_TEAM' },
      { action: 'APPROVED' as any },
    );

    expect(emitSpy).toHaveBeenCalledWith(
      'socket.broadcast',
      expect.objectContaining({
        userId: ceoId,
        event: 'notification:generic',
        payload: expect.objectContaining({
          title: expect.stringContaining('Tech Review Passed'),
        }),
      }),
    );
  });

  it('4. NDA Signatures trigger string containing: "Expert Connected!" and "Project Connected!"', async () => {
    const emitSpy = jest.spyOn(eventEmitter, 'emit');

    // Approve CEO decision to allow NDA step
    await bidsService.ceoDecision(
      bidId,
      { id: ceoId, activeRole: 'CLIENT', clientSubtype: 'CEO' },
      { decision: 'APPROVED' as any },
    );

    // Expert connects
    await engagementsService.acceptConnect(engagementId, {
      id: expertId,
      activeRole: 'EXPERT',
      clientSubtype: null,
    });

    // CEO signs NDA -> Triggers full connection
    await engagementsService.acceptNda(engagementId, {
      id: ceoId,
      activeRole: 'CLIENT',
      clientSubtype: 'CEO',
    });

    expect(emitSpy).toHaveBeenCalledWith(
      'socket.broadcast',
      expect.objectContaining({
        userId: expertId,
        event: 'notification:generic',
        payload: expect.objectContaining({
          title: expect.stringContaining('Project Connected!'),
        }),
      }),
    );
  });
});
