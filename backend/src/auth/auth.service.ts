import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
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

@Injectable()
export class AuthService {
  private readonly roleMapping = {
    [ActiveRole.CLIENT]: UserRoleItem.CLIENT_CEO,
    [ActiveRole.EXPERT]: UserRoleItem.EXPERT,
  };

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private toAuthUserResponse(user: User) {
    return {
      id:                     user.id,
      email:                  user.email,
      fullName:               user.fullName,
      activeRole:             user.activeRole,
      clientSubtype:          user.clientSubtype ?? null,
      subscriptionClientTier: user.subscriptionClientTier,
      subscriptionExpertTier: user.subscriptionExpertTier,
    };
  }

  async register(registerDto: RegisterUserDto) {
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

      const taxCode = registerDto.taxCode;
      if (taxCode) {
        try {
          const vietQRTaxAPI = `https://api.vietqr.io/v2/business/${taxCode}`;
          const response = await axios.get(vietQRTaxAPI);

          if (response.data.code === '00') {
            await tx.clientProfile.update({
              where: { userId: user.id },
              data: { companyName: response.data.data.name },
            });
          }
        } catch {}
      }

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
      throw new UnauthorizedException('This invite link refers to a session that no longer exists.');
    }
    if (session.handoffTokenJti !== payload.jti) {
      throw new UnauthorizedException(
        'This invite link has been superseded by a newer one. Ask the CEO to resend.',
      );
    }
    if (session.handoffConsumedAt !== null) {
      throw new UnauthorizedException('This invite link has already been used.');
    }

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
          email:         dto.email,
          passwordHash:  hashPassword,
          fullName:      dto.fullName,
          roles:         [UserRoleItem.CLIENT_CEO],
          activeRole:    ActiveRole.CLIENT,
          clientSubtype: ClientSubType.TECH_TEAM,
          techTeamProfile: {
            create: {
              linkedClientId: payload.ceoId,
              linkedProjectId: null,
            },
          },
        },
      });

      await tx.elicitationSession.update({
        where: { id: payload.sessionId },
        data:  { handoffConsumedAt: new Date() },
      });

      await tx.wallet.create({ data: { userId: user.id } });

      await tx.virtualAccount.create({
        data: {
          entityType:  VAEntityType.WALLET_TOPUP,
          entityId:    user.id,
          vaNumber:    generateVaNumber(VAEntityType.WALLET_TOPUP),
          fixedAmount: null,
          status:      VAStatus.ACTIVE,
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
}
