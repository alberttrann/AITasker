import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { JwtService }          from '@nestjs/jwt';
import { ElicitationService }  from '../../src/elicitation/elicitation.service';
import { PrismaService }       from '../../src/database/prisma.service';
import { FastapiClient }       from '../../src/elicitation/fastapi.client';
import { AuthService }         from '../../src/auth/auth.service';
import { MatchingHelperService } from '../../src/shared/matching/matching-helper.service';

type GateFailedResult = {
  gate_passed: false;
  completeness_score: number;
  flagged_void: string | null;
  return_to_stage: number;
  advisory_note: string;
};

function isGateFailed(
  result: { gate_passed: boolean } & Record<string, any>,
): result is GateFailedResult {
  return result.gate_passed === false;
}

describe('ElicitationService — regression', () => {
  let service: ElicitationService;
  let prisma: any;
  let fastapiClient: any;
  let authService: any;
  let matchingHelper: any;

  const CEO_ID     = 'ceo-user-1';
  const OTHER_CEO  = 'other-ceo-2';
  const TECH_ID    = 'tech-team-user-1';
  const SESSION_ID = 'session-1';

  const baseUser = {
    id: CEO_ID,
    selfTechnical: false,
    selfTechnicalProjects: [],
  };

  // A session fully ready for Stage 5 (used by confirm/runSynthesis tests)
  const stage5ReadySession = {
    id: SESSION_ID,
    userId: CEO_ID,
    currentStage: 5,
    state: 'IN_PROGRESS',
    stage1SymptomsJson: ['symptom 1'],
    archetype: '1',
    recommendedArchetypesJson: ['1', '2', '3'],
    stage3ProbesJson: { q1: 'a1' },
    stage4TechInputsJson: { current_stack: 'Node' },
    voidListJson: [],
    handoffTokenJti: null,
    handoffConsumedAt: null,
  };

  const makeSynthesisResponse = (overrides: Partial<any> = {}) => ({
    completeness_score: 0.95,
    required_seams_json: [],
    required_domains_json: [],
    milestone_framework_json: [],
    artifact_a_json: { archetype: '1', volume_tier: 'TIER_2' },
    artifact_b_json: {},
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      elicitationSession: {
        findUnique: jest.fn(),
        findFirst:  jest.fn(),
        create:     jest.fn(),
        update:     jest.fn(),
      },
      project: {
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(baseUser),
        update:     jest.fn().mockResolvedValue(baseUser),
      },
      techTeamProfile: {
        findUnique: jest.fn(),
        update:     jest.fn().mockResolvedValue({}),
      },
    };

    fastapiClient = {
      stage1Extract:         jest.fn(),
      stage3VaguenessCheck:  jest.fn().mockResolvedValue({ vague_answers: [] }),
      stage5Synthesize:      jest.fn(),
    };

    authService = {
      jwtGeneratePayload: jest.fn().mockResolvedValue('signed.jwt.token'),
    };

    matchingHelper = {
      scoreEligibleExperts: jest.fn().mockResolvedValue([{ expert_id: 'expert-1' }]), // 1 candidate by default
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ElicitationService,
        { provide: PrismaService,          useValue: prisma },
        { provide: FastapiClient,          useValue: fastapiClient },
        { provide: JwtService,             useValue: { signAsync: jest.fn().mockResolvedValue('invite.jwt.token') } },
        { provide: AuthService,            useValue: authService },
        { provide: MatchingHelperService,  useValue: matchingHelper },
      ],
    }).compile();

    service = module.get<ElicitationService>(ElicitationService);
  });

  afterEach(() => jest.clearAllMocks());

  // Ownership

  describe('ownership enforcement', () => {
    it('throws ForbiddenException when a different user reads the session', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(stage5ReadySession);
      await expect(
        service.getSession(SESSION_ID, OTHER_CEO),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when retrying synthesis on a session owned by someone else', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(stage5ReadySession);
      await expect(
        service.retryFailedSynthesis(SESSION_ID, OTHER_CEO),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // Stage 2 archetype must be within AI-recommended set

  describe('processStage2 — E5 archetype recommendation validation', () => {
    it('accepts an archetype within the recommended set', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...stage5ReadySession, currentStage: 2, archetype: null,
        recommendedArchetypesJson: ['2', '4'],
      });
      prisma.elicitationSession.update.mockResolvedValue({});

      await service.processStage2(SESSION_ID, '2', CEO_ID, []);

      expect(prisma.elicitationSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ archetype: '2' }) }),
      );
    });

    it('rejects an archetype NOT within the recommended set', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...stage5ReadySession, currentStage: 2, archetype: null,
        recommendedArchetypesJson: ['2', '4'],
      });

      await expect(
        service.processStage2(SESSION_ID, '6', CEO_ID, []),
      ).rejects.toThrow(BadRequestException);
    });

    it('falls back to allowing any archetype when recommendations are empty (degraded ai-service)', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...stage5ReadySession, currentStage: 2, archetype: null,
        recommendedArchetypesJson: [],
      });
      prisma.elicitationSession.update.mockResolvedValue({});

      await expect(
        service.processStage2(SESSION_ID, '6', CEO_ID, []),
      ).resolves.toBeDefined();
    });
  });

  // Stage 3 — exactly 4 archetype-tailored questions + vagueness 

  describe('processStage3 — E6 fixed probes + vagueness check', () => {
    const archetype1Session = {
      ...stage5ReadySession, currentStage: 3, archetype: '1', stage3ProbesJson: null,
    };

    it('throws BadRequestException when fewer than 4 questions are answered', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(archetype1Session);

      await expect(
        service.processStage3(SESSION_ID, { 'only one question': 'answer' }, CEO_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns advanced:false with vague_answers when ai-service flags vagueness, WITHOUT advancing the stage', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(archetype1Session);
      const questions = [
        'Roughly how many people will search or ask questions per day?',
        'When someone gets a wrong or unhelpful answer, what do you expect to happen next?',
        'Does this need to pull from documents/systems you already have, and which ones?',
        'How quickly does an answer need to appear after someone asks?',
      ];
      const answers = Object.fromEntries(questions.map((q) => [q, 'a lot, fast, somehow']));

      fastapiClient.stage3VaguenessCheck.mockResolvedValue({
        vague_answers: [{ question: questions[0], reason: 'too vague' }],
      });

      const result = await service.processStage3(SESSION_ID, answers, CEO_ID);

      expect(result).toEqual({
        advanced: false,
        vague_answers: [{ question: questions[0], reason: 'too vague' }],
      });
      expect(prisma.elicitationSession.update).not.toHaveBeenCalled();
    });

    it('advances to stage 4 and returns scenario_type when all 4 answers are specific', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(archetype1Session);
      prisma.elicitationSession.update.mockResolvedValue({});
      const questions = [
        'Roughly how many people will search or ask questions per day?',
        'When someone gets a wrong or unhelpful answer, what do you expect to happen next?',
        'Does this need to pull from documents/systems you already have, and which ones?',
        'How quickly does an answer need to appear after someone asks?',
      ];
      const answers = Object.fromEntries(questions.map((q) => [q, 'a specific concrete answer']));

      const result = await service.processStage3(SESSION_ID, answers, CEO_ID);

      expect(result).toEqual({
        advanced: true,
        currentStage: 4,
        stage4_required: true,
        scenario_type: 'SCENARIO_A',   // baseUser.selfTechnical = false
      });
    });

    it('resolves SCENARIO_B when the user is globally self-technical', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(archetype1Session);
      prisma.elicitationSession.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, selfTechnical: true });
      const questions = [
        'Roughly how many people will search or ask questions per day?',
        'When someone gets a wrong or unhelpful answer, what do you expect to happen next?',
        'Does this need to pull from documents/systems you already have, and which ones?',
        'How quickly does an answer need to appear after someone asks?',
      ];
      const answers = Object.fromEntries(questions.map((q) => [q, 'a specific concrete answer']));

      const result = await service.processStage3(SESSION_ID, answers, CEO_ID);
      expect((result as any).scenario_type).toBe('SCENARIO_B');
    });

    it('fails OPEN (advances normally) when ai-service vagueness check throws', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(archetype1Session);
      prisma.elicitationSession.update.mockResolvedValue({});
      fastapiClient.stage3VaguenessCheck.mockRejectedValue(new Error('ai-service down'));
      const questions = [
        'Roughly how many people will search or ask questions per day?',
        'When someone gets a wrong or unhelpful answer, what do you expect to happen next?',
        'Does this need to pull from documents/systems you already have, and which ones?',
        'How quickly does an answer need to appear after someone asks?',
      ];
      const answers = Object.fromEntries(questions.map((q) => [q, 'a specific concrete answer']));

      const result = await service.processStage3(SESSION_ID, answers, CEO_ID);
      expect((result as any).advanced).toBe(true);
    });
  });

  // self-technical resolution + override endpoint

  describe('setSelfTechnical — A3(a) per-session override', () => {
    it('adds an override entry and returns a fresh access_token', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(stage5ReadySession);
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.user.update.mockResolvedValue({ ...baseUser, selfTechnicalProjects: [{ sessionId: SESSION_ID, override: true }] });

      const result = await service.setSelfTechnical(SESSION_ID, CEO_ID, true);

      expect(result).toEqual({ access_token: 'signed.jwt.token', selfTechnical: true });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: CEO_ID },
        data: { selfTechnicalProjects: [{ sessionId: SESSION_ID, override: true }] },
      });
    });

    it('throws ForbiddenException for a non-owner', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(stage5ReadySession);
      await expect(
        service.setSelfTechnical(SESSION_ID, OTHER_CEO, true),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // Stage 4 submission auto-chains synthesis

  describe('processStage4 — E4(b) auto-chain into synthesis', () => {
    it('saves stage4 data AND returns the synthesis gate result in one call', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...stage5ReadySession, currentStage: 4,
      });
      prisma.elicitationSession.update.mockResolvedValue({
        ...stage5ReadySession, currentStage: 5, state: 'IN_PROGRESS',
      });
      fastapiClient.stage5Synthesize.mockResolvedValue(makeSynthesisResponse());
      prisma.project.create.mockResolvedValue({ id: 'project-1' });

      const result = await service.processStage4(
        SESSION_ID,
        { current_stack: 'Node', data_available: 'logs', latency_requirement: '3s' },
        CEO_ID,
      );

      // No separate confirm call needed — the gate result comes back directly.
      expect(result).toMatchObject({ gate_passed: true, project_id: 'project-1' });
      expect(fastapiClient.stage5Synthesize).toHaveBeenCalledTimes(1);
    });
  });

  describe('processStage4Handoff — E4(b) auto-chain, Tech Team caller', () => {
    it('verifies tech team linkage then auto-chains synthesis', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...stage5ReadySession, currentStage: 4,
      });
      prisma.techTeamProfile.findUnique.mockResolvedValue({ linkedClientId: CEO_ID });
      prisma.elicitationSession.update.mockResolvedValue({
        ...stage5ReadySession, currentStage: 5,
      });
      fastapiClient.stage5Synthesize.mockResolvedValue(makeSynthesisResponse());
      prisma.project.create.mockResolvedValue({ id: 'project-1' });

      const result = await service.processStage4Handoff(
        SESSION_ID,
        { current_stack: 'Node', data_available: 'logs' },
        TECH_ID,
      );

      expect(result).toMatchObject({ gate_passed: true });
    });

    it('throws UnauthorizedException when the tech team member is not linked to this session', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...stage5ReadySession, currentStage: 4,
      });
      prisma.techTeamProfile.findUnique.mockResolvedValue({ linkedClientId: 'some-other-ceo' });

      await expect(
        service.processStage4Handoff(SESSION_ID, { current_stack: 'x', data_available: 'y' }, TECH_ID),
      ).rejects.toThrow('Tech Team member is not linked');
    });

    it('links the specific Tech Team member to the new project on gate pass (Phase 1b)', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...stage5ReadySession, currentStage: 4,
      });
      prisma.techTeamProfile.findUnique.mockResolvedValue({ linkedClientId: CEO_ID });
      prisma.elicitationSession.update.mockResolvedValue({
        ...stage5ReadySession, currentStage: 5,
      });
      fastapiClient.stage5Synthesize.mockResolvedValue(makeSynthesisResponse());
      matchingHelper.scoreEligibleExperts.mockResolvedValue([{ expert_id: 'e1' }]);
      prisma.project.create.mockResolvedValue({ id: 'project-1' });

      await service.processStage4Handoff(
        SESSION_ID, { current_stack: 'Node', data_available: 'logs' }, TECH_ID,
      );

      expect(prisma.techTeamProfile.update).toHaveBeenCalledWith({
        where: { userId: TECH_ID },
        data:  { linkedProjectId: 'project-1' },
      });
    });

    it('does NOT call techTeamProfile.update for Scenario A (CEO self-submit, no tech team involved)', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...stage5ReadySession, currentStage: 4,
      });
      prisma.elicitationSession.update.mockResolvedValue({
        ...stage5ReadySession, currentStage: 5,
      });
      fastapiClient.stage5Synthesize.mockResolvedValue(makeSynthesisResponse());
      matchingHelper.scoreEligibleExperts.mockResolvedValue([{ expert_id: 'e1' }]);
      prisma.project.create.mockResolvedValue({ id: 'project-1' });

      await service.processStage4(
        SESSION_ID, { current_stack: 'Node', data_available: 'logs' }, CEO_ID,
      );

      expect(prisma.techTeamProfile.update).not.toHaveBeenCalled();
    });
  });

  // 3-condition quality gate 

  describe('quality gate — E10 all 3 BR-ELI-06 conditions', () => {
    it('passes when completeness >= 0.70 AND no hard voids AND >= 1 candidate', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(stage5ReadySession);
      fastapiClient.stage5Synthesize.mockResolvedValue(makeSynthesisResponse({ completeness_score: 0.95 }));
      matchingHelper.scoreEligibleExperts.mockResolvedValue([{ expert_id: 'e1' }]);
      prisma.project.create.mockResolvedValue({ id: 'project-1' });
      prisma.elicitationSession.update.mockResolvedValue({});

      const result = await service.retryFailedSynthesis(SESSION_ID, CEO_ID);
      expect(result.gate_passed).toBe(true);
    });

    it('fails when completeness < 0.70, even with candidates and no hard voids', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(stage5ReadySession);
      fastapiClient.stage5Synthesize.mockResolvedValue(makeSynthesisResponse({ completeness_score: 0.40 }));
      matchingHelper.scoreEligibleExperts.mockResolvedValue([{ expert_id: 'e1' }]);
      prisma.elicitationSession.update.mockResolvedValue({});

      const result = await service.retryFailedSynthesis(SESSION_ID, CEO_ID);
      expect(result.gate_passed).toBe(false);
      if (isGateFailed(result)) {
        expect(result.advisory_note).toContain('40%');
      }
    });

    it('fails when an unresolved HIGH-severity void exists, even with good completeness and candidates', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...stage5ReadySession,
        voidListJson: [{ void_code: 'NO_GROUND_TRUTH', severity: 'HIGH', injected: false }],
      });
      fastapiClient.stage5Synthesize.mockResolvedValue(makeSynthesisResponse({ completeness_score: 0.95 }));
      matchingHelper.scoreEligibleExperts.mockResolvedValue([{ expert_id: 'e1' }]);
      prisma.elicitationSession.update.mockResolvedValue({});

      const result = await service.retryFailedSynthesis(SESSION_ID, CEO_ID);
      expect(result.gate_passed).toBe(false);
      if (isGateFailed(result)) {
        expect(result.flagged_void).toBe('NO_GROUND_TRUTH');
      }
    });

    it('passes the hard-void check when the void was acknowledged (injected:true)', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...stage5ReadySession,
        voidListJson: [{ void_code: 'NO_GROUND_TRUTH', severity: 'HIGH', injected: true }],
      });
      fastapiClient.stage5Synthesize.mockResolvedValue(makeSynthesisResponse({ completeness_score: 0.95 }));
      matchingHelper.scoreEligibleExperts.mockResolvedValue([{ expert_id: 'e1' }]);
      prisma.project.create.mockResolvedValue({ id: 'project-1' });
      prisma.elicitationSession.update.mockResolvedValue({});

      const result = await service.retryFailedSynthesis(SESSION_ID, CEO_ID);
      expect(result.gate_passed).toBe(true);
    });

    it('fails with an HONEST advisory (not "go fix your input") when candidates=0 is the ONLY failing condition', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(stage5ReadySession);
      fastapiClient.stage5Synthesize.mockResolvedValue(makeSynthesisResponse({ completeness_score: 0.95 }));
      matchingHelper.scoreEligibleExperts.mockResolvedValue([]); // zero candidates
      prisma.elicitationSession.update.mockResolvedValue({});

      const result = await service.retryFailedSynthesis(SESSION_ID, CEO_ID);
      expect(result.gate_passed).toBe(false);
      if (isGateFailed(result)) {
        expect(result.advisory_note).not.toMatch(/revisit stage/i);
        expect(result.advisory_note).toMatch(/qualified experts available/i);
        // Does NOT send them backward — nothing for the CEO to fix.
        expect(result.return_to_stage).toBe(5);
      }
    });

    it('treats a matching pre-check failure (ai-service error) as zero candidates, fail-safe', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(stage5ReadySession);
      fastapiClient.stage5Synthesize.mockResolvedValue(makeSynthesisResponse({ completeness_score: 0.95 }));
      matchingHelper.scoreEligibleExperts.mockRejectedValue(new Error('ai-service matching down'));
      prisma.elicitationSession.update.mockResolvedValue({});

      const result = await service.retryFailedSynthesis(SESSION_ID, CEO_ID);
      expect(result.gate_passed).toBe(false);
    });
  });

  // Duplicate-confirm / retry guards

  describe('retryFailedSynthesis — duplicate-publish prevention', () => {
    it('throws ConflictException when session is already COMPLETED', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...stage5ReadySession, state: 'COMPLETED',
      });
      await expect(
        service.retryFailedSynthesis(SESSION_ID, CEO_ID),
      ).rejects.toThrow(ConflictException);
      expect(fastapiClient.stage5Synthesize).not.toHaveBeenCalled();
    });

    it('throws ConflictException on duplicate project (P2002 race)', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(stage5ReadySession);
      fastapiClient.stage5Synthesize.mockResolvedValue(makeSynthesisResponse());
      matchingHelper.scoreEligibleExperts.mockResolvedValue([{ expert_id: 'e1' }]);
      prisma.project.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.retryFailedSynthesis(SESSION_ID, CEO_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('returns a clean BadRequestException instead of a raw Axios error on ai-service failure', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(stage5ReadySession);
      fastapiClient.stage5Synthesize.mockRejectedValue(new Error('ECONNABORTED'));

      await expect(
        service.retryFailedSynthesis(SESSION_ID, CEO_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // handoff link generation — no email, jti-tracked 

  describe('inviteTechTeam — E9 no email binding, jti tracking', () => {
    it('generates a jti, persists it on the session, and returns a link with no email reference', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(stage5ReadySession);
      prisma.elicitationSession.update.mockResolvedValue({});

      const result = await service.inviteTechTeam(SESSION_ID, CEO_ID);

      expect(result.invite_link).toContain('/tech-team/register?token=');
      expect(result.expires_in).toBe('72h');
      expect(prisma.elicitationSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            handoffTokenJti:   expect.any(String),
            handoffConsumedAt: null,
          }),
        }),
      );
    });

    it('overwrites the jti on a second call (resend invalidates the old link)', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(stage5ReadySession);
      prisma.elicitationSession.update.mockResolvedValue({});

      await service.inviteTechTeam(SESSION_ID, CEO_ID);
      const firstJti = prisma.elicitationSession.update.mock.calls[0][0].data.handoffTokenJti;

      await service.inviteTechTeam(SESSION_ID, CEO_ID);
      const secondJti = prisma.elicitationSession.update.mock.calls[1][0].data.handoffTokenJti;

      expect(firstJti).not.toBe(secondJti);
    });
  });

  // State reset on re-do after RETURNED_TO_CLIENT

  describe('state reset after RETURNED_TO_CLIENT', () => {
    it('resets state to IN_PROGRESS when re-processing stage1', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...stage5ReadySession, currentStage: 1, state: 'RETURNED_TO_CLIENT',
      });
      fastapiClient.stage1Extract.mockResolvedValue({ symptoms: ['x'], voids: [], recommended_archetypes: ['1'] });
      prisma.elicitationSession.update.mockResolvedValue({});

      await service.processStage1(SESSION_ID, 'a fresh symptom description', CEO_ID);

      expect(prisma.elicitationSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ state: 'IN_PROGRESS' }) }),
      );
    });
  });
});