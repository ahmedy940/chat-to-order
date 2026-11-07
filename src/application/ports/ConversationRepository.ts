import type { Conversation } from "@/domain/Conversation";

export interface ConversationRepository {
  get(id: string): Conversation | null;
  /** Inserts a new conversation or updates an existing one. */
  save(conversation: Conversation): void;
  /** Newest first. */
  list(): Conversation[];
  latest(): Conversation | null;
  count(): number;
}
