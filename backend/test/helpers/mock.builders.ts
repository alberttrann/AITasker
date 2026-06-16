import { CreateMilestoneDto, CreateCriterionDto } from '../../src/milestones/dto/create-milestone.dto';

export class MilestoneBuilder {
  private engagementId         = '00000000-0000-0000-0000-000000000001';
  private deliverableStatement = 'Build and validate the MLOps pipeline with Docker';
  private signOffAuthority: 'TECH_TEAM' | 'CEO' | 'JOINT' = 'TECH_TEAM';
  private paymentAmountVnd     = 5_000_000;
  private criteria: CreateCriterionDto[] = [
    {
      criterion_text: 'Pipeline completes without error with HTTP 200',
      is_required:    true,
    },
  ];

  withEngagementId(id: string): this {
    this.engagementId = id;
    return this;
  }

  withPaymentAmount(amount: number): this {
    this.paymentAmountVnd = amount;
    return this;
  }

  withSignOffAuthority(authority: 'TECH_TEAM' | 'CEO' | 'JOINT'): this {
    this.signOffAuthority = authority;
    return this;
  }

  // NOTE: fixed `any[]` → `CreateCriterionDto[]`
  withCriteria(criteria: CreateCriterionDto[]): this {
    this.criteria = criteria;
    return this;
  }

  // Returns a fresh object every call — no shared reference mutation between tests.
  build(): CreateMilestoneDto {
    return {
      engagement_id:         this.engagementId,
      deliverable_statement: this.deliverableStatement,
      sign_off_authority:    this.signOffAuthority,
      payment_amount_vnd:    this.paymentAmountVnd,
      criteria:              this.criteria.map((c) => ({ ...c })),
    };
  }
}