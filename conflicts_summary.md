

### backend/src/engagements/engagements.service.ts:72
<<<<<<< ours
        where: { clientId: user.id },
        include: {
          project: PROJECT_SUMMARY_SELECT,
          capabilityBid: true,
=======
        where:   { clientId: user.id },
        include: { 
          project: PROJECT_SUMMARY_SELECT,
          capabilityBid: true, 
>>>>>>> theirs


### backend/src/milestones/milestones.controller.ts:0
<<<<<<< ours
import { Controller, Post, Get, Body, UseGuards, Put, Patch, Delete, Param } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
=======
import { Controller, Post, Get, Body, UseGuards, Put, Patch, Delete, Param, Query } from '@nestjs/common';
import { MilestonesService }  from './milestones.service';
>>>>>>> theirs


### backend/src/milestones/milestones.controller.ts:11
<<<<<<< ours
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
=======
import { RolesGuard }   from '../common/guards/roles.guard';
import { Roles }        from '../common/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
>>>>>>> theirs


### backend/test/helpers/db.seeder.ts:17
<<<<<<< ours
    await prisma.milestoneChatSession.deleteMany({});
    await prisma.invitation.deleteMany({});

=======
    await prisma.milestoneChatSession.deleteMany({}); 
    await prisma.invitation.deleteMany({});           
    
>>>>>>> theirs
