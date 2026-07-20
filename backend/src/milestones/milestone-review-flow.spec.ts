import { deriveMilestoneReviewAuthority } from './milestone-review-flow';

describe('deriveMilestoneReviewAuthority', () => {
  it('uses JOINT for a non-technical project', () => {
    expect(deriveMilestoneReviewAuthority({ selfTechnical: false })).toBe('JOINT');
  });

  it('uses CEO for a self-technical project or projectless service order', () => {
    expect(deriveMilestoneReviewAuthority({ selfTechnical: true })).toBe('CEO');
    expect(deriveMilestoneReviewAuthority(null)).toBe('CEO');
  });
});
