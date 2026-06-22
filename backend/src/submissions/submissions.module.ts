import { Module }               from '@nestjs/common';
import { PrismaModule }         from '../database/prisma.module';
import { SubmissionController }  from './submissions.controller';
import { SubmissionsService }    from './submissions.service';

@Module( {
    imports: [PrismaModule],
    controllers : [SubmissionController],
    providers : [SubmissionsService],
    exports : [SubmissionsService]

})

export class SubmissionsModule {}