import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../src/auth/auth.service';
import { PrismaService } from 'prisma/prisma.service';
import { UserRoleItem } from '@common/enums/user-role-item.enum';
import { ActiveRole } from '@common/enums/active-role.enum';
import { EmailService } from '../../src/common/email/email.service';
import { EmailValidatorService } from '../../src/auth/email-validator.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService — Full Unit Suite', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let emailService: any;
  let emailValidatorService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      virtualAccount: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      elicitationSession: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      project: {
        findUnique: jest.fn(),
      },
      techTeamProfile: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb: Function) =>
        cb({
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'user-1',
              email: 'ceo@test.com',
              fullName: 'Test User',
              activeRole: 'CLIENT',
              clientSubtype: 'CEO',
              isEmailVerified: false,
            }),
            update: jest.fn().mockResolvedValue({
              id: 'user-1',
              email: 'ceo@test.com',
              fullName: 'Test User',
              activeRole: 'CLIENT',
              clientSubtype: 'TECH_TEAM',
              roles: ['CLIENT_CEO'],
              isEmailVerified: true,
            }),
          },
          wallet: {
            create: jest.fn().mockResolvedValue({ id: 'wallet-1' }),
          },
          virtualAccount: {
            create: jest.fn().mockResolvedValue({ id: 'va-1' }),
          },
          elicitationSession: {
            update: jest.fn().mockResolvedValue({}),
          },
          project: {
            findUnique: jest.fn().mockResolvedValue({ id: 'proj-1' }),
          },
          techTeamProfile: {
            create: jest.fn().mockResolvedValue({}),
            upsert: jest.fn().mockResolvedValue({}),
          },
        }),
      ),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
      verifyAsync: jest.fn(),
    };

    emailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendOtpEmail: jest.fn().mockResolvedValue(undefined),
    };

    emailValidatorService = {
      assertValidEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: EmailService, useValue: emailService },
        { provide: EmailValidatorService, useValue: emailValidatorService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── register() ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register({
          email: 'taken@test.com',
          password: 'Str0ng!Pass',
          fullName: 'Test User',
          phone: '',
          roles: UserRoleItem.CLIENT_CEO,
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a new CEO user and triggers OTP email when email is available', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.register({
        email: 'new@test.com',
        password: 'Str0ng!Pass',
        fullName: 'New CEO',
        phone: '',
        roles: UserRoleItem.CLIENT_CEO,
      } as any);

      expect(result).toEqual({ email: 'new@test.com', message: 'OTP_SENT' });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── login() ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('throws UnauthorizedException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@test.com', password: 'whatever' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when account is suspended (isActive=false)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'ceo@test.com',
        isActive: false,
      });

      await expect(
        service.login({ email: 'ceo@test.com', password: 'whatever' }),
      ).rejects.toThrow('Account suspended');
    });

    it('throws UnauthorizedException on incorrect password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'ceo@test.com',
        passwordHash: 'hashed',
        isActive: true,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'ceo@test.com', password: 'wrongpass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws EMAIL_UNVERIFIED when user exists but email is not verified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'unverified@test.com',
        passwordHash: 'hashed',
        isActive: true,
        isEmailVerified: false,
      });
      prisma.user.update.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ email: 'unverified@test.com', password: 'correctpass' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(emailService.sendOtpEmail).toHaveBeenCalledWith(
        'unverified@test.com',
        expect.any(String),
      );
    });

    it('returns tokens and user profile on valid credentials with verified email', async () => {
      const validUser = {
        id: 'user-1',
        email: 'ceo@test.com',
        fullName: 'CEO User',
        passwordHash: 'hashed',
        activeRole: ActiveRole.CLIENT,
        clientSubtype: 'CEO',
        subscriptionClientTier: 'free',
        subscriptionExpertTier: 'free',
        selfTechnical: false,
        isEmailVerified: true,
        isActive: true,
      };
      prisma.user.findUnique.mockResolvedValue(validUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ email: 'ceo@test.com', password: 'correctpass' });

      expect(result).toHaveProperty('access_token', 'signed.jwt.token');
      expect(result).toHaveProperty('refresh_token', 'signed.jwt.token');
      expect(result.user.email).toBe('ceo@test.com');
    });
  });

  // ── verifyOtp() ───────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    it('throws NotFoundException when user account is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyOtp({ email: 'ghost@test.com', otp: '123456' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException if account is already verified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'ceo@test.com',
        isEmailVerified: true,
      });

      await expect(
        service.verifyOtp({ email: 'ceo@test.com', otp: '123456' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException on incorrect OTP', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'ceo@test.com',
        isEmailVerified: false,
        emailOtp: '654321',
        emailOtpExpiresAt: new Date(Date.now() + 100000),
      });

      await expect(
        service.verifyOtp({ email: 'ceo@test.com', otp: '111111' }),
      ).rejects.toThrow('Invalid verification code.');
    });

    it('marks user verified and returns auth payload on correct OTP', async () => {
      const unverifiedUser = {
        id: 'user-1',
        email: 'ceo@test.com',
        fullName: 'CEO User',
        activeRole: ActiveRole.CLIENT,
        clientSubtype: 'CEO',
        isEmailVerified: false,
        emailOtp: '123456',
        emailOtpExpiresAt: new Date(Date.now() + 100000),
      };
      prisma.user.findUnique.mockResolvedValue(unverifiedUser);
      prisma.user.update.mockResolvedValue({ ...unverifiedUser, isEmailVerified: true });

      const result = await service.verifyOtp({ email: 'ceo@test.com', otp: '123456' });

      expect(result).toHaveProperty('access_token', 'signed.jwt.token');
      expect(result.user.isEmailVerified).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isEmailVerified: true, emailOtp: null, emailOtpExpiresAt: null },
      });
    });
  });

  // ── switchRole() ──────────────────────────────────────────────────────────

  describe('switchRole', () => {
    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.switchRole('ghost-id', { activeRole: ActiveRole.EXPERT }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws UnauthorizedException when requested role is missing from roles[]', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        roles: [UserRoleItem.CLIENT_CEO],
      });

      await expect(
        service.switchRole('user-1', { activeRole: ActiveRole.EXPERT }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('switches activeRole and returns updated token when valid', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        roles: [UserRoleItem.CLIENT_CEO, UserRoleItem.EXPERT],
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        activeRole: ActiveRole.EXPERT,
        email: 'ceo@test.com',
        clientSubtype: null,
      });

      const result = await service.switchRole('user-1', { activeRole: ActiveRole.EXPERT });

      expect(result).toEqual({ access_token: 'signed.jwt.token' });
    });
  });

  // ── forgotPassword() & resetPassword() ───────────────────────────────────

  describe('forgotPassword & resetPassword', () => {
    it('returns generic security message without leaking user existence', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'nonexistent@test.com' });
      expect(result.message).toContain('If an account with that email exists');
    });

    it('generates a reset token and sends email for active user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'ceo@test.com',
        isActive: true,
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.forgotPassword({ email: 'ceo@test.com' });

      expect(result.message).toContain('If an account with that email exists');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          passwordResetToken: expect.any(String),
          passwordResetTokenExpiresAt: expect.any(Date),
        }),
      });
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('resets password when a valid token is provided', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.user.update.mockResolvedValue({});
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      const result = await service.resetPassword({
        token: 'valid-reset-token',
        newPassword: 'NewStr0ng!Password',
      });

      expect(result.message).toContain('Password has been reset successfully');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          passwordHash: 'new-hashed-password',
          passwordResetToken: null,
          passwordResetTokenExpiresAt: null,
        },
      });
    });

    it('throws BadRequestException on invalid or expired reset token', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'invalid-token',
          newPassword: 'NewStr0ng!Password',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});