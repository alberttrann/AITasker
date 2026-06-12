import { Body, Controller, Post } from '@nestjs/common';
import { RegisterUserDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login.dto';

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
}
