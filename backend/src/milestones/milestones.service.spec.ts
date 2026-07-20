import { BadRequestException } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { MilestoneBuilder } from '../../test/helpers/mock.builders';

function createHarness(selfTechnical = false) {
  const tx = {
    milestone: {
      create: jest.fn().mockResolvedValue({ id: 'milestone-1' }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'milestone-1',
        acceptanceCriteria: [{ id: 'criterion-1', criterionText: 'Tests pass' }],
      }),
    },
    acceptanceCriterion: { create: jest.fn().mockResolvedValue({ id: 'criterion-1' }) },
  };
  const prisma = {
    engagement: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'engagement-1',
        clientId: 'ceo-1',
        expertId: 'expert-1',
        projectId: 'project-1',
        project: {
          selfTechnical,
          techTeamProfiles: selfTechnical ? [] : [{ userId: 'tech-1' }],
        },
      }),
    },
    techTeamProfile: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    platformDecision: { create: jest.fn() },
    $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
  };
  const ledger = { releaseMilestoneWithTx: jest.fn() };
  const fastapi = {
    criterionCheck: jest.fn().mockResolvedValue({ is_subjective: false, suggestions: [] }),
  };
  const service = new MilestonesService(prisma as any, ledger as any, fastapi as any);
  const user = { id: 'ceo-1', activeRole: 'CLIENT', clientSubtype: 'CEO' } as any;

  return { service, prisma, tx, user };
}

describe('MilestonesService review authority', () => {
  it('rejects a milestone without acceptance criteria', async () => {
    const { service, user } = createHarness();
    const dto = new MilestoneBuilder().withCriteria([]).build();

    await expect(service.createMilestone(dto, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('derives JOINT for a non-technical project', async () => {
    const { service, tx, user } = createHarness(false);
    await service.createMilestone(new MilestoneBuilder().build(), user);

    expect(tx.milestone.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ signOffAuthority: 'JOINT' }),
    });
    expect(tx.acceptanceCriterion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ verifiedByRole: 'JOINT' }),
    });
  });

  it('derives CEO for a self-technical project', async () => {
    const { service, tx, user } = createHarness(true);
    await service.createMilestone(new MilestoneBuilder().build(), user);

    expect(tx.milestone.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ signOffAuthority: 'CEO' }),
    });
  });

  it('repairs a completed legacy handoff that was not linked to its project', async () => {
    const { service, prisma, user } = createHarness(false);
    prisma.engagement.findUnique.mockResolvedValue({
      id: 'engagement-1',
      clientId: 'ceo-1',
      expertId: 'expert-1',
      projectId: 'project-1',
      project: { selfTechnical: false, techTeamProfiles: [] },
    });
    prisma.techTeamProfile.findMany.mockResolvedValue([{ userId: 'tech-1' }]);

    await service.createMilestone(new MilestoneBuilder().build(), user);

    expect(prisma.techTeamProfile.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'tech-1',
        linkedClientId: 'ceo-1',
        linkedProjectId: null,
      },
      data: { linkedProjectId: 'project-1' },
    });
  });
});
