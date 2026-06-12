import { Injectable } from '@nestjs/common';
import { RegisterUserDto } from './dto/register.dto';
import { PrismaService } from 'prisma/prisma.service';
@Injectable() // Act as a provider
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async register(registerDto: RegisterUserDto) {
    // 1. Receive req body from DTO cleanup
    // 2. Check email existence
    // 3. Hash password
    // 4. Create user and save down to db
  }

  async activeRoleMapping(registerDto: RegisterUserDto) {
    const role = registerDto.roles;
  }
}
