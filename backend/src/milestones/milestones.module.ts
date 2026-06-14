import { Module } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { MilestonesController } from './milestones.controller';
import { PrismaService } from '../database/prisma.service';

@Module({
    imports: [PrismaModule],
    controllers: [MilestonesController],
    providers: [MilestonesService, PrismaService],
    exports: [MilestonesService],

}}
export class MilestonesModule {}

