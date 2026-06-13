import { ConflictException, Injectable } from '@nestjs/common';
import { RegisterUserDto } from './dto/register.dto';
import { PrismaService } from 'prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRoleItem } from '@common/enums/user-role-item.enum';
import { ActiveRole } from '@common/enums/active-role.enum';
import { ClientSubType } from '@common/enums/client-subtype.enum';
import { LoginUserDto } from './dto/login.dto';
@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}
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
      return {
        id: user.id,
        email: user.email,
      };
    });
  }

  async login(loginDto: LoginUserDto) {
    
  }
}
