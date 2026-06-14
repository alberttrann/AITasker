import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('milestones')
@UseGuards(JwtAuthGuard, RolesGuard) //đã đăng nhập mới được gọi API này
export class MilestonesController {
    constructor(private milestonesService: MilestonesService) {}

    @Post()
    @Roles('TECH_TEAM', 'CEO') //chỉ TECH_TEAM và CEO mới được gọi API này
    async createMilestone(@Body() dto: CreateMilestoneDto) {
    return this.milestonesService.createMilestone(dto);
    }
