import { UnprocessableEntityException } from '@nestjs/common';
import { CriteriaService } from './criteria.service';

const jointCriterion = () => ({
  id: 'criterion-1',
  milestoneId: 'milestone-1',
  criterionText: 'All integration tests pass',
  isRequired: true,
  verifiedByRole: 'JOINT',
  verifiedAt: null,
  techVerifiedAt: null,
  ceoVerifiedAt: null,
  revisionNote: null,
  revisionRequestedByRole: null,
  milestone: {
    id: 'milestone-1',
    milestoneNumber: 1,
    signOffAuthority: 'JOINT',
    state: 'SUBMITTED',
    engagement: {
      id: 'engagement-1',
      clientId: 'ceo-1',
      expertId: 'expert-1',
      projectId: 'project-1',
      project: { selfTechnical: false },
    },
  },
});

function createHarness() {
  const tx = {
    acceptanceCriterion: {
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    dispute: { findFirst: jest.fn().mockResolvedValue(null) },
    milestone: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
  };
  const prisma = {
    acceptanceCriterion: {
      findUnique: jest.fn().mockResolvedValue(jointCriterion()),
      count: jest.fn().mockResolvedValue(0),
    },
    techTeamProfile: {
      findUnique: jest.fn().mockResolvedValue({ linkedProjectId: 'project-1' }),
    },
    $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
  };
  const ledger = { releaseMilestoneWithTx: jest.fn().mockResolvedValue({}) };
  const eventEmitter = { emit: jest.fn() };
  const service = new CriteriaService(prisma as any, ledger as any, eventEmitter as any);

  return { service, prisma, tx, ledger, eventEmitter };
}

describe('CriteriaService sequential sign-off', () => {
  it('records Tech Team sign-off without approving or releasing escrow', async () => {
    const { service, tx, ledger, eventEmitter } = createHarness();

    const result = await service.verify(
      'criterion-1',
      {},
      { id: 'tech-1', activeRole: 'CLIENT', clientSubtype: 'TECH_TEAM' },
    );

    expect(tx.acceptanceCriterion.update).toHaveBeenCalledWith({
      where: { id: 'criterion-1' },
      data: expect.objectContaining({ techVerifiedAt: expect.any(Date) }),
    });
    expect(tx.milestone.updateMany).not.toHaveBeenCalled();
    expect(ledger.releaseMilestoneWithTx).not.toHaveBeenCalled();
    expect(result.reviewStage).toBe('CEO');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'socket.broadcast',
      expect.objectContaining({ userId: 'ceo-1' }),
    );
  });

  it('blocks CEO verification until every required Tech Team sign-off exists', async () => {
    const { service, prisma, tx } = createHarness();
    prisma.acceptanceCriterion.count.mockResolvedValue(1);

    await expect(
      service.verify(
        'criterion-1',
        {},
        { id: 'ceo-1', activeRole: 'CLIENT', clientSubtype: 'CEO' },
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(tx.acceptanceCriterion.update).not.toHaveBeenCalled();
  });

  it('releases escrow only after the final CEO sign-off', async () => {
    const { service, tx, ledger } = createHarness();

    const result = await service.verify(
      'criterion-1',
      {},
      { id: 'ceo-1', activeRole: 'CLIENT', clientSubtype: 'CEO' },
    );

    expect(tx.acceptanceCriterion.update).toHaveBeenCalledWith({
      where: { id: 'criterion-1' },
      data: expect.objectContaining({
        ceoVerifiedAt: expect.any(Date),
        verifiedAt: expect.any(Date),
      }),
    });
    expect(tx.milestone.updateMany).toHaveBeenCalledWith({
      where: { id: 'milestone-1', state: 'SUBMITTED' },
      data: expect.objectContaining({ state: 'APPROVED' }),
    });
    expect(ledger.releaseMilestoneWithTx).toHaveBeenCalledTimes(1);
    expect(result.reviewStage).toBe('COMPLETE');
  });

  it('sends a CEO-requested revision back through Tech Team review', async () => {
    const { service, tx } = createHarness();

    const result = await service.requestRevision(
      'criterion-1',
      { revision_note: 'The integration evidence is incomplete.' },
      { id: 'ceo-1', activeRole: 'CLIENT', clientSubtype: 'CEO' },
    );

    expect(tx.acceptanceCriterion.update).toHaveBeenCalledWith({
      where: { id: 'criterion-1' },
      data: expect.objectContaining({
        revisionRequestedByRole: 'CEO',
        techVerifiedAt: null,
        ceoVerifiedAt: null,
        verifiedAt: null,
      }),
    });
    expect(tx.milestone.update).toHaveBeenCalledWith({
      where: { id: 'milestone-1' },
      data: { state: 'IN_REVISION' },
    });
    expect(result.reviewStage).toBe('TECH_TEAM');
  });
});
