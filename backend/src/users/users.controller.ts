import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthUser } from 'src/auth/strategies/jwt.strategy';
import { AddRoleDto } from './dto/add-role.dto';
import { UserService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT', 'EXPERT', 'ADMIN')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiBearerAuth('JWT')
  @Post('me/add-role')
  addRole(@CurrentUser() user: AuthUser, @Body() addRoleDto: AddRoleDto) {
    return this.userService.addRole(user.id, addRoleDto);
  }

  @ApiBearerAuth('JWT')
  @Get('me')
  getUserProfile(@CurrentUser() user: AuthUser) {
    return this.userService.getUserProfile(user.id);
  }

  // Get the profile of the current user active role
  @ApiBearerAuth('JWT')
  @Put('me')
  updateUserProfile(@CurrentUser() user: AuthUser, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateUserProfile(user.id, updateUserDto);
  }

  // Get the public profile of expert
  @ApiBearerAuth('JWT')
  @Get(':userId/public-profile')
  getPublicProfile(@Param('userId') userId: string) {
    return this.userService.getPublicProfile(userId);
  }
}
