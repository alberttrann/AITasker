// Unit tests for MilestonesService — all Prisma calls are mocked.
// These run with jest.unit.config.js (no DB, no Docker needed).

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { PrismaService } from '../database/prisma.service';
import { MilestoneBuilder } from '../../test/helpers/mock.builders';

// Prisma mock
// $transaction executes its callback with a mock tx object.
const makeMockTx = (overrides: Record<string, any> = {}) => ({
  milestone: {
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue({ id: 'milestone-uuid' }),
    findUnique: jest.fn().mockResolvedValue({
      id: 'milestone-uuid',
      acceptanceCriteria: [{ id: 'criterion-uuid' }],
    }),
    ...overrides.milestone,
  },
  acceptanceCriterion: {
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
    ...overrides.acceptanceCriterion,
  },
});

const makeMockPrisma = () => ({
  $transaction: jest.fn().mockImplementation((cb: Function) => cb(makeMockTx())),
});

// Tests
describe('MilestonesService', () => {
  let service: MilestonesService;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    mockPrisma = makeMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MilestonesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<MilestonesService>(MilestonesService);
  });

  afterEach(() => jest.clearAllMocks());

  // Input validation
  it('throws BadRequestException when criteria array is empty', async () => {
    const dto = new MilestoneBuilder().withCriteria([]).build();
    await expect(service.createMilestone(dto)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when payment_amount_vnd is zero', async () => {
    const dto = new MilestoneBuilder().withPaymentAmount(0).build();
    await expect(service.createMilestone(dto)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when payment_amount_vnd is negative', async () => {
    const dto = new MilestoneBuilder().withPaymentAmount(-1000).build();
    await expect(service.createMilestone(dto)).rejects.toThrow(BadRequestException);
  });

  // Transaction behaviour

  it('wraps milestone + criteria creation in a single $transaction', async () => {
    const dto = new MilestoneBuilder().build();
    await service.createMilestone(dto);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('sets milestoneNumber to existingCount + 1', async () => {
    // Simulate 2 existing milestones → new one should be #3
    const tx = makeMockTx({ milestone: { count: jest.fn().mockResolvedValue(2) } });
    mockPrisma.$transaction.mockImplementation((cb: Function) => cb(tx));

    const dto = new MilestoneBuilder().build();
    await service.createMilestone(dto);

    expect(tx.milestone.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ milestoneNumber: 3 }) }),
    );
  });

  it('persists acceptance criteria with verifiedByRole = sign_off_authority', async () => {
    const tx = makeMockTx();
    mockPrisma.$transaction.mockImplementation((cb: Function) => cb(tx));

    const dto = new MilestoneBuilder()
      .withSignOffAuthority('CEO')
      .withCriteria([{ criterion_text: 'Must pass load test', is_required: true }])
      .build();

    await service.createMilestone(dto);

    expect(tx.acceptanceCriterion.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          criterionText: 'Must pass load test',
          verifiedByRole: 'CEO',
          isRequired: true,
        }),
      ]),
    });
  });

  it('returns milestone with its acceptanceCriteria included', async () => {
    const dto = new MilestoneBuilder().build();
    const result = await service.createMilestone(dto);

    expect(result).toHaveProperty('acceptanceCriteria');
    expect(result?.acceptanceCriteria).toHaveLength(1);
  });

  // Blueprint business rules

  it('sets initial milestone state to DEFINED', async () => {
    const tx = makeMockTx();
    mockPrisma.$transaction.mockImplementation((cb: Function) => cb(tx));

    const dto = new MilestoneBuilder().build();
    await service.createMilestone(dto);

    expect(tx.milestone.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ state: 'DEFINED' }) }),
    );
  });
});
