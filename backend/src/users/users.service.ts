import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { AddRoleDto } from './dto/add-role.dto';
import { PrismaService } from 'prisma/prisma.service';
import { UserRoleItem } from '@common/enums/user-role-item.enum';
import { ActiveRole } from '@common/enums/active-role.enum';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async addRole(userId: string, addRoleDto: AddRoleDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: { clientProfile: true, expertProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found!');
    }

    // Checking if role is already existed or not
    const roles = user.roles as string[];
    if (roles.includes(addRoleDto.newRole)) {
      throw new ConflictException('Role already exists!');
    }

    const updatedRoles = [...roles, addRoleDto.newRole];
    const dataToUpdate: any = { roles: updatedRoles };

    if (addRoleDto.newRole === UserRoleItem.CLIENT_CEO) {
      if (!user.clientProfile) dataToUpdate.clientProfile = { create: {} };
    } else {
      if (!user.expertProfile) dataToUpdate.expertProfile = { create: {} };
    }

    const updateStatus = await this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
    });

    if (updateStatus) {
      return { success: true };
    }
  }

  async getUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        clientProfile: true,
        expertProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found!');
    }

    const activeProfileKey =
      user.activeRole === ActiveRole.CLIENT ? 'clientProfile' : 'expertProfile';
    const activeSubscriptionKey =
      user.activeRole === ActiveRole.CLIENT ? 'subscriptionClientTier' : 'subscriptionExpertTier';
    const activeSubscriptionExpiresKey =
      user.activeRole === ActiveRole.CLIENT ? 'subClientExpiresAt' : 'subExpertExpiresAt';

    const userProfile = {
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      roles: user.roles,
      activeRole: user.activeRole,
      subscriptionTier: (user as any)[activeSubscriptionKey],
      activeRoleProfile: (user as any)[activeProfileKey],
      subscriptionExpires: (user as any)[activeSubscriptionExpiresKey],
    };

    return userProfile;
  }

  async updateUserProfile(userId: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        clientProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found!');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: updateUserDto.fullName,
          phone: updateUserDto.phone,
        },
      });

      if (user.activeRole === ActiveRole.CLIENT && user.clientProfile) {
        await tx.clientProfile.update({
          where: {
            userId: user.id,
          },
          data: {
            companyName: updateUserDto.companyName,
            industry: updateUserDto.industry,
            ceoName: updateUserDto.ceoName,
          },
        });
      }
    });

    return { success: true };
  }

  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        expertProfile: true,
        expertDomainDepths: true,
        expertSeamClaims: true,
      },
    });

    if (!user.expertProfile) {
      throw new NotFoundException('Expert profile not found!');
    }

    // Using aggreaget to perform mathematical operations such as sum, average, min, max...
    const reputation = await this.prisma.review.aggregate({
      where: {
        targetId: user.id,
      },
      _avg: { rating: true },
      _count: true,
    });

    return {
      fullName: user.fullName,
      bio: user.expertProfile.bio,
      engagementMode: user.expertProfile.engagementModel,
      stackTags: user.expertProfile.stackTagsJson,
      archetypeHistory: user.expertProfile.archetypeHistoryJson,
      domainDepths: user.expertDomainDepths,
      seamClaims: user.expertSeamClaims,
      avgRating: reputation._avg.rating,
      reviewCount: reputation._count,
    };
  }
}
