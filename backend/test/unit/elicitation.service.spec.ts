import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { JwtService }      from '@nestjs/jwt';
import { ElicitationService } from '../../src/elicitation/elicitation.service';
import { PrismaService }      from '../../src/database/prisma.service';
import { FastapiClient }      from '../../src/elicitation/fastapi.client';

// Explicit type guard
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

  const CEO_ID    = 'ceo-user-1';
  const OTHER_CEO = 'other-ceo-2';
  const SESSION_ID = 'session-1';

  const baseSession = {
    id: SESSION_ID,
    userId: CEO_ID,
    currentStage: 5,
    state: 'IN_PROGRESS',
    stage1SymptomsJson: ['symptom 1'],
    archetype: '1',
    stage3ProbesJson: { q1: 'a1' },
    stage4TechInputsJson: { current_stack: 'Node' },
    voidListJson: [],
  };

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
    };

    fastapiClient = {
      stage1Extract:    jest.fn(),
      stage5Synthesize: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ElicitationService,
        { provide: PrismaService, useValue: prisma },
        { provide: FastapiClient, useValue: fastapiClient },
        { provide: JwtService,    useValue: { signAsync: jest.fn() } },
      ],
    }).compile();

    service = module.get<ElicitationService>(ElicitationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('ownership enforcement', () => {
    it('throws ForbiddenException when a different user reads the session', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(baseSession);
      await expect(
        service.getSession(SESSION_ID, OTHER_CEO),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when confirming a session owned by someone else', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(baseSession);
      await expect(
        service.confirmSession(SESSION_ID, OTHER_CEO),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows the owning CEO to read their own session', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(baseSession);
      const result = await service.getSession(SESSION_ID, CEO_ID);
      expect(result).toEqual(baseSession);
    });
  });

  describe('duplicate confirm prevention', () => {
    it('throws ConflictException when session is already COMPLETED', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...baseSession, state: 'COMPLETED',
      });
      await expect(
        service.confirmSession(SESSION_ID, CEO_ID),
      ).rejects.toThrow(ConflictException);
      expect(fastapiClient.stage5Synthesize).not.toHaveBeenCalled();
    });
  });

  describe('confirmSession — gate passed', () => {
    it('creates a PUBLISHED project when completeness_score >= 0.70', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(baseSession);
      fastapiClient.stage5Synthesize.mockResolvedValue({
        completeness_score: 0.95,
        required_seams_json: [],
        required_domains_json: [],
        milestone_framework_json: [],
        artifact_a_json: { archetype: '1', volume_tier: 'TIER_2' },
        artifact_b_json: {},
      });
      prisma.project.create.mockResolvedValue({ id: 'project-1' });
      prisma.elicitationSession.update.mockResolvedValue({});

      const result = await service.confirmSession(SESSION_ID, CEO_ID);

      expect(result.gate_passed).toBe(true);
      if (result.gate_passed) {   // positive check narrows fine even without strictNullChecks
        expect(result.project_id).toBe('project-1');
        expect(prisma.project.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ state: 'PUBLISHED' }),
          }),
        );
      }
    });

    it('throws ConflictException on duplicate project (P2002 race)', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(baseSession);
      fastapiClient.stage5Synthesize.mockResolvedValue({
        completeness_score: 0.95,
        artifact_a_json: {}, artifact_b_json: {},
        required_seams_json: [], required_domains_json: [], milestone_framework_json: [],
      });
      prisma.project.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.confirmSession(SESSION_ID, CEO_ID),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('confirmSession — gate failed', () => {
    it('returns to stage 1 by default and sets RETURNED_TO_CLIENT', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...baseSession,
        voidListJson: [{ void_code: 'NO_GROUND_TRUTH', severity: 'HIGH' }],
      });
      fastapiClient.stage5Synthesize.mockResolvedValue({ completeness_score: 0.40 });
      prisma.elicitationSession.update.mockResolvedValue({});

      const result = await service.confirmSession(SESSION_ID, CEO_ID);

      expect(result.gate_passed).toBe(false);
      //  explicit type guard instead of `if (!result.gate_passed)`
      if (isGateFailed(result)) {
        expect(result.return_to_stage).toBe(1);
      }
      expect(prisma.elicitationSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ state: 'RETURNED_TO_CLIENT', currentStage: 1 }),
        }),
      );
    });

    it('routes UNCLEAR_SUCCESS_METRIC back to stage 3', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...baseSession,
        voidListJson: [{ void_code: 'UNCLEAR_SUCCESS_METRIC', severity: 'MEDIUM' }],
      });
      fastapiClient.stage5Synthesize.mockResolvedValue({ completeness_score: 0.55 });
      prisma.elicitationSession.update.mockResolvedValue({});

      const result = await service.confirmSession(SESSION_ID, CEO_ID);

      expect(result.gate_passed).toBe(false);
      // explicit type guard instead of `if (!result.gate_passed)`
      if (isGateFailed(result)) {
        expect(result.return_to_stage).toBe(3);
      }
    });
  });

  describe('confirmSession — ai-service failure', () => {
    it('returns a clean BadRequestException instead of a raw Axios error', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue(baseSession);
      fastapiClient.stage5Synthesize.mockRejectedValue(new Error('ECONNABORTED'));

      await expect(
        service.confirmSession(SESSION_ID, CEO_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('state reset after RETURNED_TO_CLIENT', () => {
    it('resets state to IN_PROGRESS when re-processing stage1', async () => {
      prisma.elicitationSession.findUnique.mockResolvedValue({
        ...baseSession, currentStage: 1, state: 'RETURNED_TO_CLIENT',
      });
      fastapiClient.stage1Extract.mockResolvedValue({ symptoms: ['x'], voids: [] });
      prisma.elicitationSession.update.mockResolvedValue({});

      await service.processStage1(SESSION_ID, 'a fresh symptom description', CEO_ID);

      expect(prisma.elicitationSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ state: 'IN_PROGRESS' }),
        }),
      );
    });
  });
});