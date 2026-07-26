import { DisputesService } from '../../src/disputes/disputes.service';
import { DisputeState } from '../../src/common/enums/dispute-state.enum';
import { EscrowStatus } from '../../src/common/enums/escrow-status.enum';
import { MilestoneState } from '../../src/common/enums/milestone-state.enum';

const baseDispute = {
  id: 'dispute-1',
  engagementId: 'engagement-1',
  milestoneId: 'milestone-1',
  criterionId: 'criterion-1',
  escrowAccountId: 'escrow-1',
  state: DisputeState.LAYER_1_EVAL,
  llmConfidence: null,
  llmReasoning: null,
};

function makeTx() {
  return {
    acceptanceCriterion: {
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    escrowAccount: {
      update: jest.fn().mockResolvedValue({}),
    },
    dispute: {
      create: jest.fn().mockResolvedValue(baseDispute),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
    },
    milestone: {
      update: jest.fn().mockResolvedValue({}),
    },
    platformDecision: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeHarness(disputeOverrides = {}) {
  const tx = makeTx();
  const dispute = { ...baseDispute, ...disputeOverrides };
  const prisma = {
    dispute: {
      findUnique: jest.fn().mockResolvedValue(dispute),
      update: jest.fn().mockResolvedValue({}),
    },
    engagement: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'engagement-1',
        clientId: 'client-1',
        expertId: 'expert-1',
      }),
    },
    $transaction: jest.fn().mockImplementation(async (callback) => callback(tx)),
  };
  const ledger = {
    releaseMilestoneWithTx: jest.fn().mockResolvedValue(undefined),
    refundEscrowWithTx: jest.fn().mockResolvedValue(undefined),
    splitEscrowWithTx: jest.fn().mockResolvedValue(undefined),
  };
  const fastapi = { disputeEval: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const service = new DisputesService(
    prisma as any,
    ledger as any,
    fastapi as any,
    eventEmitter as any,
  );

  return { service, prisma, ledger, fastapi, eventEmitter, tx };
}

describe('DisputesService — Full Unit Suite', () => {
  describe('applyResolution', () => {
    it('atomically persists an AI client win, reasoning, refund, and audit decision', async () => {
      const { service, ledger, eventEmitter, tx } = makeHarness();

      await service.applyResolution(
        baseDispute.id,
        { decision: 'CLIENT_WINS' },
        {
          source: 'AI',
          llmConfidence: 0.91,
          llmReasoning: 'The deliverable does not satisfy the criterion.',
        },
      );

      expect(ledger.refundEscrowWithTx).toHaveBeenCalledWith(tx, 'escrow-1');
      expect(tx.dispute.update).toHaveBeenCalledWith({
        where: { id: baseDispute.id },
        data: expect.objectContaining({
          state: DisputeState.AUTO_RESOLVED,
          resolution: 'CLIENT_WINS',
          llmConfidence: 0.91,
          llmReasoning: 'The deliverable does not satisfy the criterion.',
          resolvedBy: null,
        }),
      });
      expect(tx.platformDecision.create).toHaveBeenCalledWith({
        data: {
          decisionType: 'DISPUTE_L1_EVAL',
          entityType: 'disputes',
          entityId: baseDispute.id,
          llmConfidence: 0.91,
          decision: 'CLIENT_WINS',
          advisoryNote: 'The deliverable does not satisfy the criterion.',
        },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'socket.broadcast',
        expect.objectContaining({
          payload: {
            engagement_id: 'engagement-1',
            dispute_id: 'dispute-1',
            milestone_id: 'milestone-1',
            resolution: 'CLIENT_WINS',
          },
        }),
      );
    });

    it('records a manual split without overwriting prior AI reasoning', async () => {
      const { service, ledger, tx } = makeHarness({
        state: DisputeState.MANUAL_REVIEW,
        llmConfidence: 0.62,
        llmReasoning: 'The available description is inconclusive.',
      });

      await service.applyResolution(
        baseDispute.id,
        { decision: 'SPLIT' },
        { source: 'ADMIN', resolvedBy: 'admin-1' },
      );

      expect(ledger.splitEscrowWithTx).toHaveBeenCalledWith(tx, 'escrow-1');
      expect(tx.dispute.update).toHaveBeenCalledWith({
        where: { id: baseDispute.id },
        data: expect.objectContaining({
          state: DisputeState.RESOLVED,
          resolution: 'SPLIT',
          llmConfidence: 0.62,
          llmReasoning: 'The available description is inconclusive.',
          resolvedBy: 'admin-1',
        }),
      });
      expect(tx.platformDecision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          decision: 'SPLIT',
          advisoryNote: 'Manual resolution by platform administrator.',
        }),
      });
    });

    it('does not release milestone when an expert win leaves required criteria unverified', async () => {
      const { service, ledger, tx } = makeHarness();
      tx.acceptanceCriterion.count.mockResolvedValue(1); // 1 remaining required criterion

      await service.applyResolution(
        baseDispute.id,
        { decision: 'EXPERT_WINS' },
        { source: 'AI', llmConfidence: 0.9, llmReasoning: 'Criterion met.' },
      );

      expect(tx.escrowAccount.update).toHaveBeenCalledWith({
        where: { id: 'escrow-1' },
        data: { status: EscrowStatus.HELD },
      });
      expect(tx.milestone.update).toHaveBeenCalledWith({
        where: { id: 'milestone-1' },
        data: { state: MilestoneState.SUBMITTED },
      });
      expect(ledger.releaseMilestoneWithTx).not.toHaveBeenCalled();
    });

    it('aborts and rolls back when the audit record insertion fails', async () => {
      const { service, eventEmitter, tx } = makeHarness();
      tx.platformDecision.create.mockRejectedValue(new Error('Audit insertion failed'));

      await expect(
        service.applyResolution(
          baseDispute.id,
          { decision: 'CLIENT_WINS' },
          { source: 'AI', llmConfidence: 0.9, llmReasoning: 'Criterion not met.' },
        ),
      ).rejects.toThrow('Audit insertion failed');

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('create AI arbitration', () => {
    function makeCreateHarness(evalResult: any) {
      const tx = makeTx();
      const milestone = {
        id: 'milestone-1',
        engagementId: 'engagement-1',
        state: MilestoneState.SUBMITTED,
        deliverableStatement: 'Build rule parser.',
      };
      const prisma = {
        acceptanceCriterion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'criterion-1',
            criterionText: 'The parser handles all documented rule categories.',
            verifiedAt: null,
            milestone,
          }),
        },
        engagement: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'engagement-1',
            clientId: 'client-1',
            expertId: 'expert-1',
            project: { archetype: '3' },
          }),
        },
        escrowAccount: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'escrow-1',
            status: EscrowStatus.HELD,
          }),
        },
        milestoneSubmission: {
          findFirst: jest.fn().mockResolvedValue({
            description: 'Implemented parsing for all categories.',
            filesJson: ['https://example.test/report.pdf'],
          }),
          count: jest.fn().mockResolvedValue(2),
        },
        dispute: {
          findUnique: jest.fn().mockResolvedValue(baseDispute),
          update: jest.fn().mockResolvedValue({}),
        },
        $transaction: jest.fn().mockImplementation(async (callback) => callback(tx)),
      };
      const fastapi = { disputeEval: jest.fn().mockResolvedValue(evalResult) };
      const service = new DisputesService(
        prisma as any,
        {} as any,
        fastapi as any,
        { emit: jest.fn() } as any,
      );

      return { service, prisma, fastapi };
    }

    it('passes full context to AI and defaults invalid findings to client refund', async () => {
      const { service, fastapi } = makeCreateHarness({
        confidence_score: 0.9,
        finding: 'unexpected_value',
        reasoning: 'Evaluator returned invalid finding code.',
      });
      const applyResolution = jest.spyOn(service, 'applyResolution').mockResolvedValue(undefined);

      const result = await service.create('client-1', { criterion_id: 'criterion-1' } as any);

      expect(fastapi.disputeEval).toHaveBeenCalledWith({
        criterion_text: 'The parser handles all documented rule categories.',
        deliverable_description: 'Implemented parsing for all categories.',
        files: ['https://example.test/report.pdf'],
        project_archetype: '3',
        milestone_context: 'Build rule parser.',
        prior_revision_count: 1,
      });
      expect(applyResolution).toHaveBeenCalledWith(
        'dispute-1',
        { decision: 'CLIENT_WINS' },
        {
          source: 'AI',
          llmConfidence: 0.9,
          llmReasoning: 'Evaluator returned invalid finding code.',
        },
      );
      expect(result).toEqual(
        expect.objectContaining({
          finding: 'client_wins',
          state: DisputeState.AUTO_RESOLVED,
        }),
      );
    });

    it('routes low-confidence evaluations to MANUAL_REVIEW without auto-resolving', async () => {
      const { service, prisma } = makeCreateHarness({
        confidence_score: 0.55,
        finding: 'expert_wins',
        reasoning: 'Evidence is insufficient.',
      });

      await service.create('client-1', { criterion_id: 'criterion-1' } as any);

      expect(prisma.dispute.update).toHaveBeenCalledWith({
        where: { id: 'dispute-1' },
        data: {
          state: DisputeState.MANUAL_REVIEW,
          llmConfidence: 0.55,
          llmReasoning: 'Evidence is insufficient.',
        },
      });
    });
  });
});