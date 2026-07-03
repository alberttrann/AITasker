import { Global, Module } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service';
import { LedgerService } from './ledger.service';

@Global()
@Module({
  providers: [LedgerService, AuthService, PrismaService],
  exports: [LedgerService],
})
export class LedgerModule {}