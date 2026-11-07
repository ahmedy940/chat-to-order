import type { ProposalRepository } from "@/application/ports/ProposalRepository";
import { Proposal, ProposalStatus, type ProposalSnapshot } from "@/domain/Proposal";

/** The agent's proposals in memory, for the use-case tests. */
export class InMemoryProposals implements ProposalRepository {
  private rows: ProposalSnapshot[] = [];

  get(id: string): Proposal | null {
    const row = this.rows.find((r) => r.id === id);
    return row ? Proposal.restore(row) : null;
  }

  openFor(conversationId: string): Proposal | null {
    const row = this.rows.findLast(
      (r) => r.conversationId === conversationId && r.status === ProposalStatus.Open,
    );
    return row ? Proposal.restore(row) : null;
  }

  save(proposal: Proposal): void {
    const snapshot = proposal.snapshot();
    this.rows = [...this.rows.filter((r) => r.id !== snapshot.id), snapshot];
  }

  dropOpen(conversationId: string): void {
    this.rows = this.rows.filter(
      (r) => !(r.conversationId === conversationId && r.status === ProposalStatus.Open),
    );
  }

  conversationsWithOpen(): Set<string> {
    return new Set(this.rows.filter((r) => r.status === ProposalStatus.Open).map((r) => r.conversationId));
  }

  all(): ProposalSnapshot[] {
    return [...this.rows];
  }
}
