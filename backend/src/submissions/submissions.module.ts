import { Module }                from '@nestjs/common';
import { PrismaModule }          from '../database/prisma.module';
import { SubmissionsController } from './submissions.controller';   // was SubmissionController (singular)
import { SubmissionsService }    from './submissions.service';

@Module({
  imports: [PrismaModule],
  controllers: [SubmissionsController],   // was SubmissionController — didn't exist, compile error
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}