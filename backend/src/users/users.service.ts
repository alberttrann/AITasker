import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';
import { AddRoleDto } from './dto/add-role.dto';
import { PrismaService } from 'prisma/prisma.service';
import { UserRoleItem } from '@common/enums/user-role-item.enum';

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
}
