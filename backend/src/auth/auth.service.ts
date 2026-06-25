// backend/src/auth/auth.service.ts
// RECONCILED: adopts Chi Nhan's real dual-token refresh mechanism
// (discarding my earlier alias-based workaround entirely) and his
// taxCode/VietQR verification feature, while adding back the `user`
// object the frontend hook needs (his version didn't include it) and the
// A1 expiry/selfTechnical fields in the JWT payload.
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

  // ADDED — shared response shape, never includes passwordHash.
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
          // ADDED (A3b, merged from my side) — registration-time default,
          // only meaningful for CLIENT_CEO; defaults to false if omitted.
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

      // Chi Nhan's VietQR business-tax verification — kept as-is.
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

      // CHANGED: added `user` to the response — the frontend's onSuccess
      // hook (store.setUser(data.user); redirectByRole(...)) needs it,
      // and the original version of this method didn't include it.
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

    // CHANGED: added `user`, same reasoning as register() above.
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

  // ADOPTED from Chi Nhan's branch wholesale — true dual-token refresh,
  // reads tokenString from the request body (not Authorization header),
  // works even after the access token has expired. Discards my earlier
  // alias-based workaround entirely.
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
      // ADDED (A1, merged from my side) — JwtStrategy re-queries fresh
      // from DB on every request and ignores these claims itself, but
      // including them keeps the signed token internally consistent with
      // what validate() returns.
      subClientExpiresAt: user.subClientExpiresAt,
      subExpertExpiresAt: user.subExpertExpiresAt,
      selfTechnical: user.selfTechnical,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    return accessToken;
  }

  // ADOPTED from Chi Nhan's branch wholesale.
  async jwtGenerateRefreshPayload(user: User) {
    const payload = {
      sub: user.id,
      type: 'refresh',
    };

    const refreshToken = await this.jwtService.signAsync(payload, { expiresIn: '7d' });
    return refreshToken;
  }

  // RESTORED — this is OUR feature (E9, Stage B), not present on Chi Nhan's
  // dev branch at all. His changes don't replace it; they sit alongside it.
  // Updated here only to use the same dual-token + user response pattern
  // as register()/login() above, for consistency.
  //
  // SEQUENCING NOTE (unchanged from before): depends on elicitation.service.ts's
  // inviteTechTeam signing+persisting a jti — confirm that landed before
  // testing this end-to-end.
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