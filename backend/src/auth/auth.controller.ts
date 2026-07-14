import { Body, Controller, Get, Post, Put, UseGuards, Param } from '@nestjs/common';
import { RegisterUserDto } from './dto/register.dto';
import { RegisterHandoffDto } from './dto/register-handoff.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthUser } from './strategies/jwt.strategy';
import { SwitchRoleUserDto } from './dto/switch-role.dto';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { VerifyTaxCodeDto } from './dto/verify-tax-code.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtp } from './dto/resend-otp.dto';

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

  // No JwtAuthGuard by design: refresh token renews access after the
  // access token has expired, so it can't be gated behind a valid-token guard.
  @Post('refresh')
  refreshToken(@Body('refresh_token') tokenString: string) {
    return this.authService.refreshToken(tokenString);
  }

  @Post('register/handoff')
  registerHandoff(@Body() dto: RegisterHandoffDto) {
    return this.authService.registerHandoff(dto);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify registration OTP code and issue login tokens' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
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

  // Forgot Password / Reset Password

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // Validate a reset token without consuming it.
  // FE calls this on page load to decide whether to show the form or an error.
  @Get('verify-reset-token/:token')
  verifyResetToken(@Param('token') token: string) {
    return this.authService.verifyResetToken(token);
  }

  @Post('logout')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Invalidate current refresh token server-side' })
  logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user.id);
  }

  @Put('me/password')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change password while authenticated' })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Post('resend-otp')
  @ApiOperation({summary: 'Resend otp for verify email'})
  resendOtp(
    @Body() dto: ResendOtp
  ) {
    return this.authService.resendOtp(dto.email);
  }
}