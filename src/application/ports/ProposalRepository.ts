import type { Proposal } from "@/domain/Proposal";

/** The agent's proposals: at most one open per conversation. */
export interface ProposalRepository {
  get(id: string): Proposal | null;
  openFor(conversationId: string): Proposal | null;
  /** Inserts or updates. */
  save(proposal: Proposal): void;
  /** Removes an open proposal nobody acted on, because a newer customer message replaced it. */
  dropOpen(conversationId: string): void;
  /** Conversations with an open proposal: the Inbox shows them first, with a blue dot. */
  conversationsWithOpen(): Set<string>;
}
