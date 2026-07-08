import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { addHours } from 'date-fns';
import { EmailService } from '../common/email/email.service';
import { EmailValidatorService } from './email-validator.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterUserDto } from './dto/register.dto';
import { RegisterHandoffDto } from './dto/register-handoff.dto';
import { PrismaService } from 'prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRoleItem } from '@common/enums/user-role-item.enum';
import { ActiveRole } from '@common/enums/active-role.enum';
import { ClientSubType } from '@common/enums/client-subtype.enum';
import { LoginUserDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { VAEntityType } from '@common/enums/va-entity-type.enum';
import { VAStatus } from '@common/enums/va-status.enum';
import { User } from '@prisma/client';
import { SwitchRoleUserDto } from './dto/switch-role.dto';
import axios from 'axios';
import { generateVaNumber } from '@shared/ledger/va-generator';
import { VerifyTaxCodeDto } from './dto/verify-tax-code.dto';

@Injectable()
export class AuthService {
  private readonly roleMapping = {
    [ActiveRole.CLIENT]: UserRoleItem.CLIENT_CEO,
    [ActiveRole.EXPERT]: UserRoleItem.EXPERT,
  };

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private emailValidatorService: EmailValidatorService,
  ) {}

  private toAuthUserResponse(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      activeRole: user.activeRole,
      clientSubtype: user.clientSubtype ?? null,
      subscriptionClientTier: user.subscriptionClientTier,
      subscriptionExpertTier: user.subscriptionExpertTier,
      selfTechnical: user.selfTechnical,
    };
  }

  async register(registerDto: RegisterUserDto) {
    // Check the email is real (MX record exists, not a disposable domain)
    await this.emailValidatorService.assertValidEmail(registerDto.email);

    const existingEmailCheck = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingEmailCheck) {
      throw new ConflictException('Email already exist!');
    }

    const hashPassword = await bcrypt.hash(registerDto.password, 10);
    const activeRole =
      registerDto.roles == UserRoleItem.CLIENT_CEO ? ActiveRole.CLIENT : ActiveRole.EXPERT;
    const clientSubtype = activeRole == ActiveRole.CLIENT ? ClientSubType.CEO : null;

    return await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: registerDto.email,
          passwordHash: hashPassword,
          fullName: registerDto.fullName,
          phone: registerDto.phone,
          roles: [registerDto.roles],
          activeRole: activeRole,
          clientSubtype: clientSubtype,
          selfTechnical: registerDto.selfTechnical ?? false,

          ...(activeRole == ActiveRole.CLIENT
            ? { clientProfile: { create: {} } }
            : { expertProfile: { create: {} } }),
        },
      });

      const wallet = await tx.wallet.create({
        data: { userId: user.id },
      });

      const virtualAccount = await tx.virtualAccount.create({
        data: {
          entityType: VAEntityType.WALLET_TOPUP,
          entityId: user.id,
          vaNumber: generateVaNumber(VAEntityType.WALLET_TOPUP),
          fixedAmount: null,
          status: VAStatus.ACTIVE,
        },
      });

      const access_token = await this.jwtGeneratePayload(user);
      const refresh_token = await this.jwtGenerateRefreshPayload(user);

      return {
        access_token,
        refresh_token,
        user: this.toAuthUserResponse(user),
      };
    });
  }

  async login(loginDto: LoginUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials!');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account suspended');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials!');
    }

    const accessToken = await this.jwtGeneratePayload(user);
    const refreshToken = await this.jwtGenerateRefreshPayload(user);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: this.toAuthUserResponse(user),
    };
  }

  async switchRole(userId: string, switchRoleDto: SwitchRoleUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = user.roles as string[];
    const requiredRole = this.roleMapping[switchRoleDto.activeRole];
    const isRoleValid = roles.includes(requiredRole);

    if (!isRoleValid) {
      throw new UnauthorizedException('You do not have permission to switch to this role!');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { activeRole: switchRoleDto.activeRole },
    });

    return {
      access_token: await this.jwtGeneratePayload(updatedUser),
    };
  }

  async refreshToken(tokenString: string) {
    let payload;
    try {
      payload = await this.jwtService.verifyAsync(tokenString);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Not a refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const accessToken = await this.jwtGeneratePayload(user);
    const refreshToken = await this.jwtGenerateRefreshPayload(user);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async jwtGeneratePayload(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      activeRole: user.activeRole,
      clientSubType: user.clientSubtype,
      subscriptionClientTier: user.subscriptionClientTier,
      subscriptionExpertTier: user.subscriptionExpertTier,
      subClientExpiresAt: user.subClientExpiresAt,
      subExpertExpiresAt: user.subExpertExpiresAt,
      selfTechnical: user.selfTechnical,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    return accessToken;
  }

  async jwtGenerateRefreshPayload(user: User) {
    const payload = {
      sub: user.id,
      type: 'refresh',
    };

    const refreshToken = await this.jwtService.signAsync(payload, { expiresIn: '7d' });
    return refreshToken;
  }

  async registerHandoff(dto: RegisterHandoffDto) {
    let payload: { sessionId: string; ceoId: string; jti: string; purpose: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.invite_token);
    } catch {
      throw new UnauthorizedException('This invite link has expired or is invalid.');
    }

    if (payload.purpose !== 'tech-team-handoff') {
      throw new UnauthorizedException('Invalid invite token.');
    }

    const session = await this.prisma.elicitationSession.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session) {
      throw new UnauthorizedException(
        'This invite link refers to a session that no longer exists.',
      );
    }
    if (session.handoffTokenJti !== payload.jti) {
      throw new UnauthorizedException(
        'This invite link has been superseded by a newer one. Ask the CEO to resend.',
      );
    }
    if (session.handoffConsumedAt !== null) {
      throw new UnauthorizedException('This invite link has already been used.');
    }

    // Check the email is real before creating the TechTeam account
    await this.emailValidatorService.assertValidEmail(dto.email);

    const existingEmailCheck = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmailCheck) {
      throw new ConflictException('An account with this email already exists.');
    }

    const hashPassword = await bcrypt.hash(dto.password, 10);

    return await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash: hashPassword,
          fullName: dto.fullName,
          roles: [UserRoleItem.CLIENT_CEO],
          activeRole: ActiveRole.CLIENT,
          clientSubtype: ClientSubType.TECH_TEAM,
          techTeamProfile: {
            create: {
              linkedClientId: payload.ceoId,
              linkedProjectId: (
                await tx.project.findFirst({
                  where:   { clientId: payload.ceoId, state: 'PUBLISHED' },
                  orderBy: { createdAt: 'desc' },
                  select:  { id: true },
                })
              )?.id ?? null,
            },
          },
        },
      });

      await tx.elicitationSession.update({
        where: { id: payload.sessionId },
        data: { handoffConsumedAt: new Date() },
      });

      await tx.wallet.create({ data: { userId: user.id } });

      await tx.virtualAccount.create({
        data: {
          entityType: VAEntityType.WALLET_TOPUP,
          entityId: user.id,
          vaNumber: generateVaNumber(VAEntityType.WALLET_TOPUP),
          fixedAmount: null,
          status: VAStatus.ACTIVE,
        },
      });

      const access_token = await this.jwtGeneratePayload(user);
      const refresh_token = await this.jwtGenerateRefreshPayload(user);
      return {
        access_token,
        refresh_token,
        user: this.toAuthUserResponse(user),
      };
    });
  }

  async claimHandoff(userId: string, inviteToken: string) {
    let payload: { sessionId: string; ceoId: string; jti: string; purpose: string };
    try {
      payload = await this.jwtService.verifyAsync(inviteToken);
    } catch {
      throw new UnauthorizedException('This invite link has expired or is invalid.');
    }

    if (payload.purpose !== 'tech-team-handoff') {
      throw new UnauthorizedException('Invalid invite token.');
    }

    const session = await this.prisma.elicitationSession.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session) {
      throw new UnauthorizedException(
        'This invite link refers to a session that no longer exists.',
      );
    }
    if (session.handoffTokenJti !== payload.jti) {
      throw new UnauthorizedException(
        'This invite link has been superseded by a newer one. Ask the CEO to resend.',
      );
    }
    if (session.handoffConsumedAt !== null) {
      throw new UnauthorizedException('This invite link has already been used.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return await this.prisma.$transaction(async (tx) => {
      const roles = user.roles as string[];
      const updatedRoles = Array.from(new Set([...roles, UserRoleItem.CLIENT_CEO]));

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          roles: updatedRoles,
          activeRole: ActiveRole.CLIENT,
          clientSubtype: ClientSubType.TECH_TEAM,
        },
      });

      // Resolve the CEO's current published project (if it exists already)
      const ceoProject = await tx.project.findFirst({
        where:   { clientId: payload.ceoId, state: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        select:  { id: true },
      });
      const resolvedProjectId = ceoProject?.id ?? null;

      await tx.techTeamProfile.upsert({
        where: { userId },
        create: {
          userId,
          linkedClientId:  payload.ceoId,
          linkedProjectId: resolvedProjectId,
        },
        update: {
          linkedClientId:  payload.ceoId,
          linkedProjectId: resolvedProjectId,
        },
      });

      await tx.elicitationSession.update({
        where: { id: payload.sessionId },
        data: { handoffConsumedAt: new Date() },
      });

      const access_token = await this.jwtGeneratePayload(updatedUser);
      return {
        access_token,
        user: this.toAuthUserResponse(updatedUser),
      };
    });
  }

  async verifyTaxCode(verifyTaxCodeDto: VerifyTaxCodeDto) {
    const taxCode = verifyTaxCodeDto.taxCode;

    const vietQRTaxAPI = `https://api.vietqr.io/v2/business/${taxCode}`;
    const response = await axios.get(vietQRTaxAPI);

    // 00 => Company tax code existed
    if (response.data.code === '00') {
      return {
        verified: true,
        companyName: response.data.data.name,
      };
    }

    return {
      verified: false,
      companyName: null,
    };
  }

  // Forgot Password / Reset Password

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Always return the same message whether or not the email exists.
    // This is intentional — it prevents email enumeration attacks where
    // an attacker probes which emails are registered.
    const genericResponse = {
      message: 'If an account with that email exists, a reset link has been sent.',
    };

    if (!user) return genericResponse;
    if (!user.isActive) return genericResponse; // suspended accounts get no reset link

    // Generate a cryptographically random token (64 hex chars = 32 bytes entropy)
    const token = randomBytes(32).toString('hex');
    const expiresAt = addHours(new Date(), 1); // link expires in 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetTokenExpiresAt: expiresAt,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password/${token}`;

    // Fire-and-forget: the EmailService catches its own errors internally
    await this.emailService.sendPasswordResetEmail(user.email, resetLink);

    return genericResponse;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetTokenExpiresAt: { gt: new Date() }, // not expired
      },
    });

    if (!user) {
      throw new BadRequestException(
        'This password reset link is invalid or has expired. Please request a new one.',
      );
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        passwordResetToken: null,           // invalidate immediately after use
        passwordResetTokenExpiresAt: null,
      },
    });

    return { message: 'Password has been reset successfully. You can now log in.' };
  }
  async verifyResetToken(token: string): Promise<{ valid: true }> {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken:          token,
        passwordResetTokenExpiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException(
        'This password reset link is invalid or has expired. Please request a new one.',
      );
    }

    // Return a simple object — 200 means valid, 400 means invalid/expired.
    return { valid: true };
  }
}
