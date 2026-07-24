import type React from 'react';
import type { DomainCode, DepthLevel, SeamCode } from "./enums";
import type { MatchResult } from "./jsonb.types";


export interface Stage4ScenarioBProps {
  sessionId: string;
  onTechTeamSubmitted: () => void;
  onFillInMyself: () => void;
  onBack: () => void;
}

export interface MatchCardProps {
  expert: MatchResult;
}

export interface DomainDepth {
  domainCode: DomainCode | string;
  depthLevel: DepthLevel | null;
}

export interface SeamClaim {
  code: SeamCode | string;
  checked?: boolean;
}
