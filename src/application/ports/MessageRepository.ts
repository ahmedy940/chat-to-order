import type { Message } from "@/domain/Message";

/** Messages are only ever added, never changed. */
export interface MessageRepository {
  findByClientId(clientId: string): Message | null;
  add(message: Message): void;
  /** Oldest first, as the chat reads. */
  listByConversation(conversationId: string): Message[];
  /** The newest message of each conversation that has any. */
  latestPerConversation(): Message[];
}
