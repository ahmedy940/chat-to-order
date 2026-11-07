import { InvalidTransition } from "./errors";
import type { AgentProposalDraft } from "./NextActionPolicy";
import type { ProposalKind } from "./types";

type ValueOf<T> = T[keyof T];

export const ProposalStatus = { Open: "open", Approved: "approved", Dismissed: "dismissed" } as const;
export type ProposalStatus = ValueOf<typeof ProposalStatus>;

export interface ProposalSnapshot {
  id: string;
  conversationId: string;
  orderId: string | null;
  kind: ProposalKind;
  reason: string;
  quote: string | null;
  basedOnMessageId: string | null;
  status: ProposalStatus;
  createdAt: Date;
}

interface Origin {
  conversationId: string;
  orderId: string | null;
  messageId: string | null;
  time: Date;
}

/** One next step the agent suggests. It does nothing on its own: the seller approves or dismisses it. */
export class Proposal {
  private constructor(private data: ProposalSnapshot) {}

  static open(id: string, origin: Origin, draft: AgentProposalDraft): Proposal {
    return new Proposal({
      id,
      conversationId: origin.conversationId,
      orderId: origin.orderId,
      ...draft,
      basedOnMessageId: origin.messageId,
      status: ProposalStatus.Open,
      createdAt: origin.time,
    });
  }

  static restore(snapshot: ProposalSnapshot): Proposal {
    return new Proposal({ ...snapshot });
  }

  get id(): string {
    return this.data.id;
  }

  get kind(): ProposalKind {
    return this.data.kind;
  }

  get conversationId(): string {
    return this.data.conversationId;
  }

  get orderId(): string | null {
    return this.data.orderId;
  }

  get isOpen(): boolean {
    return this.data.status === ProposalStatus.Open;
  }

  approve(): void {
    this.decide(ProposalStatus.Approved);
  }

  dismiss(): void {
    this.decide(ProposalStatus.Dismissed);
  }

  snapshot(): ProposalSnapshot {
    return { ...this.data };
  }

  private decide(status: ProposalStatus): void {
    if (!this.isOpen) throw new InvalidTransition(this.data.status, "decide on a proposal that is");
    this.data = { ...this.data, status };
  }
}
