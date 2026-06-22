import { Injectable } from '@nestjs/common';

@Injectable()
export class LedgerService {
    
  async releaseMilestone(milestoneId: string): Promise<void> {

  }

  async resolveDispute(
    disputeId: string,
    resolution: 'release' | 'refund' | 'split',
  ): Promise<void> {
    
  }
}