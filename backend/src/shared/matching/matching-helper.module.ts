// a leaf module, depends only on PrismaModule + FastapiClientModule,
// never on ElicitationModule or ProjectsModule. See fastapi-client.module.ts
// for the full explanation of why this separation exists.
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { FastapiClientModule } from '../../elicitation/fastapi-client.module';
import { MatchingHelperService } from './matching-helper.service';

@Module({
  imports: [PrismaModule, FastapiClientModule],
  providers: [MatchingHelperService],
  exports: [MatchingHelperService],
})
export class MatchingHelperModule {}
