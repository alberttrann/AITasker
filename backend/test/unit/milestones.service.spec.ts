// @ts-nocheck
import { Test, TestingModule }   from '@nestjs/testing';
import { BadRequestException }   from '@nestjs/common';
import { MilestonesService }     from '../../src/milestones/milestones.service';
import { PrismaService }         from '../../src/database/prisma.service';
import { MilestoneBuilder }      from '../helpers/mock.builders';
import { FastapiClient }         from '../../src/elicitation/fastapi.client';

// Prisma mock
const makeMockTx = (overrides: Record<string, any> = {}) => ({
  milestone: {
    count:      jest.fn<any>().mockResolvedValue(0),
    create:     jest.fn<any>().mockResolvedValue({ id: 'milestone-uuid' }),
    findUnique: jest.fn<any>().mockResolvedValue({
      id: 'milestone-uuid',
      acceptanceCriteria: [{ id: 'criterion-uuid' }],
    }),
    ...overrides.milestone,
  },
  acceptanceCriterion: {
    createMany: jest.fn<any>().mockResolvedValue({ count: 1 }),
    ...overrides.acceptanceCriterion,
  },
});

const makeMockPrisma = () => ({
  $transaction: jest.fn<any>().mockImplementation((cb: Function) => cb(makeMockTx())),
  platformDecision: {
    create: jest.fn<any>().mockResolvedValue({}),
  }
});

const makeMockFastapiClient = () => ({
  criterionCheck: jest.fn<any>().mockResolvedValue({ is_subjective: false, suggestions: [] }),
});

describe('MilestonesService', () => {
  let service: MilestonesService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let mockFastapiClient: ReturnType<typeof makeMockFastapiClient>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();
    mockFastapiClient = makeMockFastapiClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MilestonesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FastapiClient, useValue: mockFastapiClient },
        // Dummy LedgerService mock to satisfy dependency injection
        { provide: 'LedgerService', useValue: {} } 
      ],
    }).compile();

    service = module.get<MilestonesService>(MilestonesService);
  });

  afterEach(() => jest.clearAllMocks());

  it('throws BadRequestException when criteria array is empty', async () => {
    const dto = new MilestoneBuilder().withCriteria([]).build();
    await expect(service.createMilestone(dto as any)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when payment_amount_vnd is zero', async () => {
    const dto = new MilestoneBuilder().withPaymentAmount(0).build();
    await expect(service.createMilestone(dto as any)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when payment_amount_vnd is negative', async () => {
    const dto = new MilestoneBuilder().withPaymentAmount(-1000).build();
    await expect(service.createMilestone(dto as any)).rejects.toThrow(BadRequestException);
  });

  it('wraps milestone + criteria creation in a single $transaction', async () => {
    const dto = new MilestoneBuilder().build();
    await service.createMilestone(dto as any);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});