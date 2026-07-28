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

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number; // ms
}

export interface FilterTab {
  label: string;
  value: string;
  count?: number;
  key?: string;
}

export interface AdminTableToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  
  tabs?: FilterTab[];
  activeTab?: string;
  onTabChange?: (val: string) => void;
  
  statusOptions?: FilterTab[];
  activeStatus?: string;
  onStatusChange?: (val: string) => void;
  statusLabel?: string;
  
  itemCount: number;
  itemLabel?: string;
  
  page: number;
  totalPages: number;
  onPageChange: (val: number | ((p: number) => number)) => void;

  actionButton?: React.ReactNode;
}

