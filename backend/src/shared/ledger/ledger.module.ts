import { Global, Module } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { LedgerService } from './ledger.service';

@Global()
@Module({
  providers: [LedgerService, PrismaService],
  exports: [LedgerService],
})
export class LedgerModule {}
