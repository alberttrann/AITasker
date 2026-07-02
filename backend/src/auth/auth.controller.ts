import { Body, Controller, Post, Put, UseGuards } from '@nestjs/common';
import { RegisterUserDto } from './dto/register.dto';
import { RegisterHandoffDto } from './dto/register-handoff.dto';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthUser } from './strategies/jwt.strategy';
import { SwitchRoleUserDto } from './dto/switch-role.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { VerifyTaxCodeDto } from './dto/verify-tax-code.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
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

  // no JwtAuthGuard at all, by design: the refresh token's
  // entire purpose is renewing access AFTER the access token has expired,
  // so it can't be gated behind a guard that requires a still-valid token.
  @Post('refresh')
  refreshToken(@Body('refresh_token') tokenString: string) {
    return this.authService.refreshToken(tokenString);
  }

  @Post('register/handoff')
  registerHandoff(@Body() dto: RegisterHandoffDto) {
    return this.authService.registerHandoff(dto);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Post('verify-tax-code')
  verifyTaxCode(@Body() verifyTaxCodeDto: VerifyTaxCodeDto) {
    return this.authService.verifyTaxCode(verifyTaxCodeDto);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @Post('claim-handoff')
  claimHandoff(
    @CurrentUser() user: AuthUser,
    @Body('invite_token') inviteToken: string,
  ) {
    return this.authService.claimHandoff(user.id, inviteToken);
  }
}
