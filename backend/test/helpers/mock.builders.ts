import { CreateMilestoneDto } from '../../src/milestones/dto/create-milestone.dto';

export class MilestoneBuilder {
  private dto: CreateMilestoneDto = {
    engagement_id: '00000000-0000-0000-0000-000000000001',
    deliverable_statement: 'Xay dung hoan thien pipeline MLOps dung Docker',
    sign_off_authority: 'TECH_TEAM',
    payment_amount_vnd: 5000000,
    criteria: [
      {
        criterion_text: 'Pipeline chay khong loi voi response code 200',
        is_required: true,
      },
    ],
  };

  withEngagementId(id: string) {
    this.dto.engagement_id = id;
    return this;
  }

  withPaymentAmount(amount: number) {
    this.dto.payment_amount_vnd = amount;
    return this;
  }

  withCriteria(criteria: any[]) {
    this.dto.criteria = criteria;
    return this;
  }

  build(): CreateMilestoneDto {
    return this.dto;
  }
}