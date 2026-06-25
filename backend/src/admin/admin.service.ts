// backend/src/admin/admin.service.ts
import { Injectable } from '@nestjs/common';
import { DisputesService } from '../disputes/disputes.service';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { DisputeResolution } from '../disputes/dto/resolve-dispute.dto';

type ActorUser = { id: string; activeRole: string; clientSubtype?: string | null };

@Injectable()
export class AdminService {
  constructor(private readonly disputesService: DisputesService) {}

  async getDisputesQueue(adminUserId: string, state?: string) {
    return this.disputesService.findAll(
      { id: adminUserId, activeRole: 'ADMIN' },
      { state },
    );
  }

  async resolveDispute(disputeId: string, dto: ResolveDisputeDto, adminUserId: string) {
    const resolution: DisputeResolution = {
      decision: dto.decision,
      expertSharePercent: dto.expertSharePercent,
    };
    await this.disputesService.applyResolution(disputeId, resolution, undefined, adminUserId);
    return { success: true };
  }
}