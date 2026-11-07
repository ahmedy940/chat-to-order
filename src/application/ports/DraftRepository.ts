import type { Draft } from "@/domain/Draft";

/** One draft per conversation: the message waiting in the seller's reply box. */
export interface DraftRepository {
  get(conversationId: string): Draft | null;
  /** Replaces any earlier draft for the same conversation. */
  save(draft: Draft): void;
  clear(conversationId: string): void;
}
