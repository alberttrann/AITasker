import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { MilestonesService } from '../../src/milestones/milestones.service';
import { MilestoneBuilder } from '../helpers/mock.builders';

describe('MilestonesService — Ownership & State Enforcement', () => {
  it('rejects milestone creation by a linked Tech Team member', async () => {
    const prisma = {
      capabilityBid: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      engagement: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'engagement-1',
          clientId: 'ceo-1',
          expertId: 'expert-1',
          projectId: 'project-1',
          project: { selfTechnical: false },
        }),
      },
      $transaction: jest.fn(),
    };
    const service = new MilestonesService(
      prisma as any,
      { releaseMilestoneWithTx: jest.fn() } as any,
      { criterionCheck: jest.fn() } as any,
    );

    await expect(
      service.createMilestone(new MilestoneBuilder().build(), {
        id: 'tech-1',
        activeRole: 'CLIENT',
        clientSubtype: 'TECH_TEAM',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects editing a milestone that is not in DEFINED state', async () => {
    const prisma = {
      milestone: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'milestone-1',
          state: 'FUNDED',
          engagement: { clientId: 'ceo-1' },
        }),
      },
      capabilityBid: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new MilestonesService(
      prisma as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.updateMilestone('milestone-1', 'ceo-1', { title: 'Updated Title' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects deleting a milestone that is not in DEFINED state', async () => {
    const prisma = {
      milestone: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'milestone-1',
          state: 'AWAITING_PAYMENT',
          engagement: { clientId: 'ceo-1' },
        }),
      },
      capabilityBid: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new MilestonesService(
      prisma as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.deleteMilestone('milestone-1', 'ceo-1'),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});