import { ForbiddenException } from '@nestjs/common';
import { MilestonesService } from '../../src/milestones/milestones.service';
import { MilestoneBuilder } from '../helpers/mock.builders';

describe('MilestonesService ownership enforcement', () => {
  it('rejects milestone creation by a linked Tech Team member', async () => {
    const prisma = {
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
});
