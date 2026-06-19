import { Module } from '@nestjs/common';
import { UserController } from './users.controller';
import { UserService } from './users.service';
import { PrismaService } from 'prisma/prisma.service';
import { JwtStrategy } from 'src/auth/strategies/jwt.strategy';

@Module({
  controllers: [UserController],
  providers: [UserService, PrismaService, JwtStrategy],
})
export class UsersModule {}
