export interface Stage4ScenarioBProps {
  sessionId: string;
  onTechTeamSubmitted: () => void;
  onFillInMyself: () => void;
}

import type { MatchResult } from "./jsonb.types";

export interface MatchCardProps {
  expert: MatchResult;
}
