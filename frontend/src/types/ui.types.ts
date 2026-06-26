import type { DomainCode, DepthLevel, SeamCode } from './enums';

export interface DomainDepth {
  domainCode: DomainCode | string;
  depthLevel: DepthLevel | null;
}

export interface SeamClaim {
  code: SeamCode | string;
  checked?: boolean;
}
