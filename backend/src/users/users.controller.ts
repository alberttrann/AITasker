import { CurrentUser } from '@common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthUser } from 'src/auth/strategies/jwt.strategy';
import { AddRoleDto } from './dto/add-role.dto';
import { UserService } from './users.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @Post('me/add-role')
  addRole(@CurrentUser() user: AuthUser, @Body() addRoleDto: AddRoleDto) {
    return this.userService.addRole(user.id, addRoleDto);
  }
}
