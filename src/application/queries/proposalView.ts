import type { Order } from "@/domain/Order";
import type { Proposal } from "@/domain/Proposal";
import { ProposalKind } from "@/domain/types";
import type { ProposalView } from "./views";

/** How each proposal reads on the card. Amounts come from the order, never from the AI. */
const TITLES: Record<ProposalKind, (number: number, total: string) => string> = {
  ask: () => "Ask the customer for what's missing?",
  request_payment: (number) => `Request payment for #${number}?`,
  remind: (number) => `Remind the customer to pay #${number}?`,
  refund: (number, total) => `Refund #${number} · ${total}?`,
};

const APPROVE_LABELS: Record<ProposalKind, string> = {
  ask: "Write the question",
  request_payment: "Approve",
  remind: "Draft a reminder",
  refund: "Approve refund",
};

/** The agent's open suggestion, ready for the blue card above the reply box. */
export function toProposalView(proposal: Proposal | null, order: Order | null): ProposalView | null {
  if (!proposal || !order || proposal.orderId !== order.id) return null;
  const s = proposal.snapshot();
  const total = order.total().format();
  const payer = order.payment?.payer?.name ?? "the customer";
  return {
    id: s.id,
    kind: s.kind,
    title: TITLES[s.kind](order.number, total),
    reason: s.reason,
    quote: s.quote,
    approveLabel: APPROVE_LABELS[s.kind],
    confirm: s.kind === ProposalKind.Refund ? `Refund ${total} to ${payer}? This can't be undone.` : null,
  };
}
