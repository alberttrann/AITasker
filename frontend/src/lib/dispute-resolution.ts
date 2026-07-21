import type { EscrowStatus } from "@/types/enums";

export type DisputeResolutionDecision =
  | "EXPERT_WINS"
  | "CLIENT_WINS"
  | "SPLIT";

export type MilestoneSettlementOutcome =
  | "EXPERT_RELEASED"
  | "CLIENT_REFUNDED"
  | "SPLIT"
  | "FUNDS_HELD"
  | "FUNDS_FROZEN"
  | "UNKNOWN";

export type SettlementViewer = "CLIENT" | "EXPERT";

export function formatDisputeResolution(
  resolution: DisputeResolutionDecision | null | undefined,
): string {
  if (resolution === "EXPERT_WINS") return "Expert wins";
  if (resolution === "CLIENT_WINS") return "Client wins";
  if (resolution === "SPLIT") return "Split settlement";
  return "Outcome unavailable";
}

export function formatEscrowMovement(
  status: EscrowStatus | null | undefined,
  viewer: SettlementViewer,
): string {
  if (status === "RELEASED") {
    return viewer === "EXPERT"
      ? "Funds were released to your wallet."
      : "Funds were released to the Expert."
  }
  if (status === "REFUNDED") {
    return viewer === "CLIENT"
      ? "Funds were refunded to your wallet."
      : "Funds were returned to the client."
  }
  if (status === "SPLIT") return "The escrow was split between both parties."
  if (status === "HELD") return "Funds remain held in escrow."
  if (status === "FROZEN") return "Funds remain frozen in escrow."
  return "The final money movement is unavailable."
}

export function getSettlementCopy(
  outcome: MilestoneSettlementOutcome,
  viewer: SettlementViewer,
  formattedAmount?: string,
): { title: string; body: string } {
  if (outcome === "CLIENT_REFUNDED") {
    return viewer === "CLIENT"
      ? {
          title: "Dispute Resolved — Refunded to Your Wallet",
          body: "The dispute was resolved in the client's favor. The escrow funds were returned to your available balance.",
        }
      : {
          title: "Dispute Resolved — Client Refunded",
          body: "The dispute was resolved in the client's favor. The escrow was returned to the client and was not credited to your wallet.",
        };
  }

  if (outcome === "SPLIT") {
    return {
      title: "Dispute Resolved — Escrow Split",
      body: viewer === "CLIENT"
        ? "The escrow was divided between you and the Expert according to the dispute resolution."
        : "The escrow was divided between you and the client according to the dispute resolution. Check your wallet for the credited amount.",
    };
  }

  if (outcome === "FUNDS_HELD" || outcome === "FUNDS_FROZEN") {
    return {
      title: outcome === "FUNDS_HELD" ? "Funds Remain in Escrow" : "Funds Remain Frozen",
      body: outcome === "FUNDS_HELD"
        ? "The dispute result is recorded, but milestone release requirements are still pending. No release has occurred."
        : "The dispute result is not fully settled yet. The escrow remains frozen and no release has occurred.",
    };
  }

  if (outcome === "UNKNOWN") {
    return {
      title: "Milestone Completed — Settlement Recorded",
      body: viewer === "CLIENT"
        ? "The milestone is complete, but the settlement outcome could not be loaded. Check wallet transactions for the final money movement."
        : "The milestone is complete, but the settlement outcome could not be loaded. Check wallet transactions before relying on this status.",
    };
  }

  return {
    title: "Milestone Approved & Released",
    body: viewer === "CLIENT"
      ? "All criteria have been signed off. Escrow funds have been disbursed to the Expert's wallet."
      : `All acceptance criteria have been verified successfully. The escrow sum of ${formattedAmount ?? "the milestone payment"} has been released and credited to your available balance.`,
  };
}

export function formatResolutionNotification(
  resolution: DisputeResolutionDecision | string,
  viewer: SettlementViewer,
): string {
  if (resolution === "EXPERT_WINS") {
    return viewer === "EXPERT"
      ? "The dispute was resolved in your favor. Check the milestone for the current escrow status."
      : "The dispute was resolved in the Expert's favor. Check the milestone for the current escrow status.";
  }
  if (resolution === "CLIENT_WINS") {
    return viewer === "CLIENT"
      ? "The dispute was resolved in your favor and the escrow refund was selected."
      : "The dispute was resolved in the client's favor and the escrow refund was selected.";
  }
  if (resolution === "SPLIT") return "The dispute was resolved with a split settlement.";
  return "The dispute has been resolved. Open the milestone to review the settlement.";
}
