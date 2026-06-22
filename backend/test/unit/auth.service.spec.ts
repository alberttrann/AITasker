// Regression lock for AuthService.register/login/switchRole
import { Test, TestingModule }      from '@nestjs/testing';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService }               from '@nestjs/jwt';
import { AuthService }              from '../../src/auth/auth.service';
import { PrismaService }            from 'prisma/prisma.service';
import { UserRoleItem }             from '@common/enums/user-role-item.enum';
import { ActiveRole }               from '@common/enums/active-role.enum';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService — regression', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update:     jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb: Function) =>
        cb({
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'user-1', email: 'ceo@test.com',
            }),
          },
          wallet: {
            create: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
          },
          virtualAccount: {
            create: jest.fn().mockResolvedValue({ id: 'va-1' }),
          },
        }),
      ),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService,    useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // register()

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register({
          email: 'taken@test.com', password: 'Str0ng!Pass', fullName: 'Test User',
          phone: '', roles: UserRoleItem.CLIENT_CEO,
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a new CEO user when email is free', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.register({
        email: 'new@test.com', password: 'Str0ng!Pass', fullName: 'New CEO',
        phone: '', roles: UserRoleItem.CLIENT_CEO,
      } as any);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // login()

  describe('login', () => {
    it('throws UnauthorizedException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@test.com', password: 'whatever' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'ceo@test.com', passwordHash: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'ceo@test.com', password: 'wrongpass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns access_token on correct credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'ceo@test.com', passwordHash: 'hashed',
        activeRole: ActiveRole.CLIENT, clientSubtype: 'CEO',
        subscriptionClientTier: 'free', subscriptionExpertTier: 'free',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ email: 'ceo@test.com', password: 'correct' });

      expect(result).toEqual({ access_token: 'signed.jwt.token' });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', email: 'ceo@test.com' }),
      );
    });
  });

  // switchRole()

  describe('switchRole', () => {
    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.switchRole('ghost-id', { activeRole: ActiveRole.EXPERT }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws UnauthorizedException when role is not in roles[]', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1', roles: [UserRoleItem.CLIENT_CEO], // no EXPERT role
      });

      await expect(
        service.switchRole('user-1', { activeRole: ActiveRole.EXPERT }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('switches role and returns a new token when role is valid', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1', roles: [UserRoleItem.CLIENT_CEO, UserRoleItem.EXPERT],
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1', activeRole: ActiveRole.EXPERT,
        email: 'ceo@test.com', clientSubtype: null,
        subscriptionClientTier: 'free', subscriptionExpertTier: 'free',
      });

      const result = await service.switchRole('user-1', { activeRole: ActiveRole.EXPERT });

      expect(result).toEqual({ access_token: 'signed.jwt.token' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data:  { activeRole: ActiveRole.EXPERT },
      });
    });
  });
});