import type { Conversation } from "@/domain/Conversation";
import type { Message } from "@/domain/Message";
import type { ConversationRepository } from "../ports/ConversationRepository";
import type { MessageRepository } from "../ports/MessageRepository";
import { CHATTING, type InboxRow } from "./views";

interface Deps {
  conversations: ConversationRepository;
  messages: MessageRepository;
}

/** The seller's inbox: one row per customer, most recent activity first. */
export class GetInbox {
  constructor(private readonly deps: Deps) {}

  execute(): InboxRow[] {
    const latest = new Map(this.deps.messages.latestPerConversation().map((m) => [m.conversationId, m]));
    return this.deps.conversations
      .list()
      .map((conversation) => ({ conversation, last: latest.get(conversation.id) }))
      .sort((a, b) => lastActivity(b) - lastActivity(a))
      .map(({ conversation, last }) => toRow(conversation, last));
  }
}

function lastActivity(entry: { conversation: Conversation; last: Message | undefined }): number {
  return (entry.last?.createdAt ?? entry.conversation.createdAt).getTime();
}

function toRow(conversation: Conversation, last: Message | undefined): InboxRow {
  const s = last?.snapshot();
  return {
    conversationId: conversation.id,
    customerName: conversation.customerName,
    lastMessage: s ? { text: s.text, direction: s.direction, at: s.createdAt.toISOString() } : null,
    status: CHATTING,
  };
}
