import {
  CreateMilestoneDto,
  CreateCriterionDto,
} from '../../src/milestones/dto/create-milestone.dto';

export class MilestoneBuilder {
  private engagementId = '00000000-0000-0000-0000-000000000001';
  private milestoneNumber = 1; // ADDED — now required by the DTO
  private deliverableStatement = 'Build and validate the MLOps pipeline with Docker';
  private paymentAmountVnd = 5_000_000;
  private criteria: CreateCriterionDto[] = [
    {
      criterion_text: 'Pipeline completes without error with HTTP 200',
      is_required: true,
    },
  ];

  withEngagementId(id: string): this {
    this.engagementId = id;
    return this;
  }

  // ADDED — lets tests creating multiple milestones for the same engagement supply distinct numbers
  withMilestoneNumber(n: number): this {
    this.milestoneNumber = n;
    return this;
  }

  withPaymentAmount(amount: number): this {
    this.paymentAmountVnd = amount;
    return this;
  }

  withCriteria(criteria: CreateCriterionDto[]): this {
    this.criteria = criteria;
    return this;
  }

  build(): CreateMilestoneDto {
    return {
      engagement_id: this.engagementId,
      milestone_number: this.milestoneNumber, // ADDED
      deliverable_statement: this.deliverableStatement,
      payment_amount_vnd: this.paymentAmountVnd,
      criteria: this.criteria.map((c) => ({ ...c })),
    };
  }
}
