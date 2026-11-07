import { Draft } from "@/domain/Draft";
import { OrderNotFound, ProposalNotFound } from "@/domain/errors";
import { newEvent } from "@/domain/OrderEvent";
import type { Proposal } from "@/domain/Proposal";
import { Actor, EventType, ProposalKind } from "@/domain/types";
import { saveQuestion, writeQuestionText } from "./orderText";
import type { OrderDeps } from "./orderSupport";
import type { AiProvider } from "./ports/AiProvider";
import type { MessageRepository } from "./ports/MessageRepository";
import type { ProposalRepository } from "./ports/ProposalRepository";
import type { PayUrl } from "./ports/TokenFactory";
import type { RefundPayment } from "./RefundPayment";
import type { RequestPayment } from "./RequestPayment";

const KIND_NAMES: Record<ProposalKind, string> = {
  ask: "Ask the customer",
  request_payment: "Request payment",
  remind: "Remind to pay",
  refund: "Refund",
};

interface Deps extends OrderDeps {
  proposals: ProposalRepository;
  messages: MessageRepository;
  ai: AiProvider;
  payUrl: PayUrl;
  requestPayment: RequestPayment;
  refundPayment: RefundPayment;
}

function requireProposal(proposals: ProposalRepository, id: string): Proposal {
  const proposal = proposals.get(id);
  if (!proposal) throw new ProposalNotFound();
  return proposal;
}

/** Logs the seller's decision on the order's timeline ("Refund: approved by you"). */
function logDecision(deps: Deps, proposal: Proposal, type: EventType, verb: string): void {
  if (!proposal.orderId) return;
  const event = newEvent(type, Actor.Seller, `${KIND_NAMES[proposal.kind]} proposed by the agent: ${verb}`);
  deps.events.append(proposal.orderId, event, deps.clock.now());
}

/**
 * The seller approves the agent's proposal: it runs through the same use cases as the order card's buttons,
 * with amounts from the order. If the action fails (PayPal refuses, say), the proposal stays open.
 */
export class ApproveProposal {
  constructor(private readonly deps: Deps) {}

  async execute(proposalId: string): Promise<{ outcome: "approved" | "already_decided" }> {
    const proposal = requireProposal(this.deps.proposals, proposalId);
    if (!proposal.isOpen) return { outcome: "already_decided" };
    await this.carryOut(proposal);
    return this.deps.uow.run(() => {
      const fresh = requireProposal(this.deps.proposals, proposalId);
      if (!fresh.isOpen) return { outcome: "already_decided" as const };
      fresh.approve();
      this.deps.proposals.save(fresh);
      logDecision(this.deps, fresh, EventType.ProposalApproved, "approved by you");
      return { outcome: "approved" as const };
    });
  }

  private async carryOut(proposal: Proposal): Promise<void> {
    const orderId = proposal.orderId;
    if (!orderId) throw new OrderNotFound();
    if (proposal.kind === ProposalKind.RequestPayment) await this.deps.requestPayment.execute(orderId);
    if (proposal.kind === ProposalKind.Refund) await this.deps.refundPayment.execute(orderId);
    if (proposal.kind === ProposalKind.Ask) await this.writeQuestion(orderId);
    if (proposal.kind === ProposalKind.Remind) this.writeReminder(orderId);
  }

  /** Ask: the question for everything still open goes in the reply box (the AI writes it when it can). */
  private async writeQuestion(orderId: string): Promise<void> {
    const order = this.deps.orders.get(orderId);
    if (!order) throw new OrderNotFound();
    const text = await writeQuestionText(this.deps, order);
    this.deps.uow.run(() => saveQuestion(this.deps, order, text));
  }

  /** Remind: a short nudge with the same pay link goes in the reply box. */
  private writeReminder(orderId: string): void {
    const order = this.deps.orders.get(orderId);
    if (!order?.payToken) throw new OrderNotFound();
    const ref = { id: order.id, number: order.number, total: order.total(), payToken: order.payToken };
    const draft = Draft.reminder(
      this.deps.ids.newId(),
      order.conversationId,
      ref,
      this.deps.payUrl(order.payToken),
    );
    this.deps.drafts.save(draft);
  }
}

/** The seller dismisses the proposal. It stays hidden until the customer writes again. */
export class DismissProposal {
  constructor(private readonly deps: Deps) {}

  execute(proposalId: string): { outcome: "dismissed" | "already_decided" } {
    return this.deps.uow.run(() => {
      const proposal = requireProposal(this.deps.proposals, proposalId);
      if (!proposal.isOpen) return { outcome: "already_decided" as const };
      proposal.dismiss();
      this.deps.proposals.save(proposal);
      logDecision(this.deps, proposal, EventType.ProposalDismissed, "dismissed by you");
      return { outcome: "dismissed" as const };
    });
  }
}
