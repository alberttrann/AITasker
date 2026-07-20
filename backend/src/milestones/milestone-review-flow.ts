export type MilestoneReviewAuthority = 'CEO' | 'JOINT';

export function deriveMilestoneReviewAuthority(
  project: { selfTechnical: boolean } | null | undefined,
): MilestoneReviewAuthority {
  return project && !project.selfTechnical ? 'JOINT' : 'CEO';
}

export function requiresTechReview(authority: string): boolean {
  return authority === 'JOINT';
}
