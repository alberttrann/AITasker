import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { IpnHandlerService } from '../src/payments/ipn-handler.service';
import { PrismaService } from 'prisma/prisma.service';

describe('T01: IPN idempotency (Minh Thức)', () => {
  let service: IpnHandlerService;
  let prisma: any;

  const VA_NUMBER = 'AITASKER123ABC';
  const REFERENCE = 'FT24061900001';
  const WALLET_ID = 'wallet-uuid-1';

  beforeEach(async () => {
    prisma = {
      virtualAccount: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [IpnHandlerService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<IpnHandlerService>(IpnHandlerService);
  });

  afterEach(() => jest.clearAllMocks());

  const makeTxMock = (existingTransaction: any = null) => ({
    wallet: {
      findUnique: jest.fn().mockResolvedValue({ id: WALLET_ID }),
      update: jest.fn().mockResolvedValue({ id: WALLET_ID }),
    },
    walletTransaction: {
      findFirst: jest.fn().mockResolvedValue(existingTransaction),
      create: jest.fn().mockResolvedValue({ id: 'tx-1' }),
    },
  });

  it('throws ConflictException when VA number is not found', async () => {
    prisma.virtualAccount.findUnique.mockResolvedValue(null);

    await expect(
      service.handleIpn({
        content: `${VA_NUMBER} topup`,
        transferAmount: '50000',
        referenceCode: REFERENCE,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('credits the wallet and creates a transaction on first IPN', async () => {
    prisma.virtualAccount.findUnique.mockResolvedValue({
      vaNumber: VA_NUMBER,
      entityId: 'user-1',
    });

    const tx = makeTxMock(null); // no existing transaction — first time
    prisma.$transaction.mockImplementation((cb: Function) => cb(tx));

    const result = await service.handleIpn({
      content: `${VA_NUMBER} topup`,
      transferAmount: '50000',
      referenceCode: REFERENCE,
    });

    expect(result).toEqual({ success: true });
    expect(tx.wallet.update).toHaveBeenCalledTimes(1);
    expect(tx.walletTransaction.create).toHaveBeenCalledTimes(1);
  });

  it('does NOT credit the wallet twice for the same referenceCode (idempotency)', async () => {
    prisma.virtualAccount.findUnique.mockResolvedValue({
      vaNumber: VA_NUMBER,
      entityId: 'user-1',
    });

    // Simulate the SAME IPN arriving a second time — walletTransaction.findFirst
    // now returns the transaction that was created on the first call.
    const tx = makeTxMock({ id: 'tx-1', referenceId: REFERENCE });
    prisma.$transaction.mockImplementation((cb: Function) => cb(tx));

    const result = await service.handleIpn({
      content: `${VA_NUMBER} topup`,
      transferAmount: '50000',
      referenceCode: REFERENCE,
    });

    // Service should short-circuit and report "already processed" —
    // wallet.update and walletTransaction.create must NOT be called again.
    expect(result).toEqual({ success: true, message: 'Already processed' });
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('throws ConflictException when wallet does not exist for the VA owner', async () => {
    prisma.virtualAccount.findUnique.mockResolvedValue({
      vaNumber: VA_NUMBER,
      entityId: 'user-with-no-wallet',
    });

    const tx = {
      wallet: { findUnique: jest.fn().mockResolvedValue(null) },
      walletTransaction: { findFirst: jest.fn() },
    };
    prisma.$transaction.mockImplementation((cb: Function) => cb(tx));

    await expect(
      service.handleIpn({
        content: `${VA_NUMBER} topup`,
        transferAmount: '50000',
        referenceCode: REFERENCE,
      }),
    ).rejects.toThrow(ConflictException);
  });
});
