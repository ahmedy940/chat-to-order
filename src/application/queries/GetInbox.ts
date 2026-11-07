import type { Conversation } from "@/domain/Conversation";
import type { Message } from "@/domain/Message";
import { ORDER_STATUS_LABELS } from "@/domain/types";
import type { ConversationRepository } from "../ports/ConversationRepository";
import type { MessageRepository } from "../ports/MessageRepository";
import type { OrderRepository } from "../ports/OrderRepository";
import { CHATTING, type InboxRow } from "./views";

interface Deps {
  conversations: ConversationRepository;
  messages: MessageRepository;
  orders: OrderRepository;
}

interface Entry {
  conversation: Conversation;
  last: Message | undefined;
}

/** The seller's inbox: one row per customer, most recent activity first, with the order's status. */
export class GetInbox {
  constructor(private readonly deps: Deps) {}

  execute(): InboxRow[] {
    const latest = new Map(this.deps.messages.latestPerConversation().map((m) => [m.conversationId, m]));
    return this.deps.conversations
      .list()
      .map((conversation) => ({ conversation, last: latest.get(conversation.id) }))
      .sort((a, b) => lastActivity(b) - lastActivity(a))
      .map((entry) => this.toRow(entry));
  }

  private toRow({ conversation, last }: Entry): InboxRow {
    const s = last?.snapshot();
    const order = this.deps.orders.latestForConversation(conversation.id);
    return {
      conversationId: conversation.id,
      customerName: conversation.customerName,
      lastMessage: s ? { text: s.text, direction: s.direction, at: s.createdAt.toISOString() } : null,
      status: order ? ORDER_STATUS_LABELS[order.status] : CHATTING,
    };
  }
}

function lastActivity(entry: Entry): number {
  return (entry.last?.createdAt ?? entry.conversation.createdAt).getTime();
}
