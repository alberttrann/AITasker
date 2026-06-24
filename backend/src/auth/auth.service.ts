import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterUserDto } from './dto/register.dto';
import { PrismaService } from 'prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRoleItem } from '@common/enums/user-role-item.enum';
import { ActiveRole } from '@common/enums/active-role.enum';
import { ClientSubType } from '@common/enums/client-subtype.enum';
import { LoginUserDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { VAEntityType } from '@common/enums/va-entity-type.enum';
import { customAlphabet, nanoid } from 'nanoid';
import { VAStatus } from '@common/enums/va-status.enum';
import { User } from '@prisma/client';
import { SwitchRoleUserDto } from './dto/switch-role.dto';
import axios from 'axios';
@Injectable()
export class AuthService {
  // Mapping roles to active roles
  private readonly roleMapping = {
    [ActiveRole.CLIENT]: UserRoleItem.CLIENT_CEO,
    [ActiveRole.EXPERT]: UserRoleItem.EXPERT,
  };

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}
  async register(registerDto: RegisterUserDto) {
    const existingEmailCheck = await this.prisma.user.findUnique({
      where: {
        email: registerDto.email,
      },
    });

    if (existingEmailCheck) {
      throw new ConflictException('Email already exist!');
    }

    const hashPassword = await bcrypt.hash(registerDto.password, 10);
    const activeRole =
      registerDto.roles == UserRoleItem.CLIENT_CEO ? ActiveRole.CLIENT : ActiveRole.EXPERT;
    const clientSubtype = activeRole == ActiveRole.CLIENT ? ClientSubType.CEO : null;

    // Using transaction to make commit to db only both of queries are successful
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

          // Spread operator: take all of the above then create profile align with the activeRole
          ...(activeRole == ActiveRole.CLIENT
            ? {
                clientProfile: { create: {} },
              }
            : {
                expertProfile: { create: {} },
              }),
        },
      });

      const wallet = await tx.wallet.create({
        data: {
          userId: user.id,
        },
      });

      // Create custom nanoid for generating VANumber
      const nanoid = customAlphabet(
        '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
        8,
      );

      const normalizeVANumber = (VAEntityType.WALLET_TOPUP + nanoid()).replaceAll('_', '');

      // Create and assign VA to user
      const virtualAccount = await tx.virtualAccount.create({
        data: {
          entityType: VAEntityType.WALLET_TOPUP,
          entityId: user.id,
          vaNumber: normalizeVANumber,
          fixedAmount: null,
          status: VAStatus.ACTIVE,
        },
      });

      // Checking for the tax number to verify Business Client
      const taxCode = registerDto.taxCode;
      if (taxCode) {
        try {
          const vietQRTaxAPI = `https://api.vietqr.io/v2/business/${taxCode}`;
          const response = await axios.get(vietQRTaxAPI);

          if (response.data.code === '00') {
            await tx.clientProfile.update({
              where: {
                userId: user.id,
              },
              data: {
                companyName: response.data.data.name,
              },
            });
          }
        } catch {}
      }

      return {
        id: user.id,
        email: user.email,
      };
    });
  }

  async login(loginDto: LoginUserDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: loginDto.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials!');
    }

    const userInputPassword = loginDto.password;
    const userPasswordHash = user.passwordHash;
    const isMatch = await bcrypt.compare(userInputPassword, userPasswordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials!');
    }

    // JWT Service

    const accessToken = await this.jwtGeneratePayload(user);

    return {
      access_token: accessToken,
    };
  }

  async switchRole(userId: string, switchRoleDto: SwitchRoleUserDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check to see if the new active roles is existed inside the roles json or not
    // Cast json back to string of user's roles
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

  async refreshToken(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found!');
    }

    const accessToken = await this.jwtGeneratePayload(user);
    return { access_token: accessToken };
  }

  async jwtGeneratePayload(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      activeRole: user.activeRole,
      clientSubType: user.clientSubtype,
      subscriptionClientTier: user.subscriptionClientTier,
      subscriptionExpertTier: user.subscriptionExpertTier,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    return accessToken;
  }
}
