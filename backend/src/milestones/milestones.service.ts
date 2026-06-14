import { Injectable, BadRequestException} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';

@Injectable()
export class MilestonesService {
    constructor(private prisma: PrismaService) {}

    async createMilestone(dto : CreateMilestoneDto) {
        if (dto.payment_amount_vnd <= 0) {
            throw new BadRequestException('Payment amount must be greater than zero');
        }

        if (!dto.criteria || dto.criteria.length === 0) {
            throw new BadRequestException('At least one criterion is required per milestone');
        }

        const existingMilestonesCount = await this.prisma.milestone.count({
            where: {
                engagementId: dto.engagement_id,
            },
        });

    const nextMilestoneNumber = existingMilestonesCount + 1;

    return this.prisma.milestone.create({
        data: {
            engagementId: dto.engagement_id,
            milestoneNumber: nextMilestoneNumber, 
            deliverableStatement: dto.deliverable_statement,
            signOffAuthority: dto.sign_off_authority,
            paymentAmountVnd: dto.payment_amount_vnd,
            state : 'DEFINED',
        }
    });
    
    }
}
