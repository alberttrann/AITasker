import { Body, Controller, Post, Put, UseGuards } from '@nestjs/common';
import { RegisterUserDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthUser } from './strategies/jwt.strategy';
import { SwitchRoleUserDto } from './dto/switch-role.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@Controller('auth') // Define end points
export class AuthController {
  // Inject service to constructor
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterUserDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginUserDto) {
    return this.authService.login(loginDto);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT', 'EXPERT')
  @Put('switch-role')
  switchRole(@CurrentUser() user: AuthUser, @Body() switchRoleDto: SwitchRoleUserDto) {
    return this.authService.switchRole(user.id, switchRoleDto);
  }
}
