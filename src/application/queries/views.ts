import type { Message } from "@/domain/Message";
import type { MessageDirection, MessageKind } from "@/domain/types";

/** What the screens receive. Plain JSON: dates as ISO strings. */
export interface MessageView {
  id: string;
  direction: MessageDirection;
  kind: MessageKind;
  text: string;
  options: string[];
  at: string;
}

export interface InboxRow {
  conversationId: string;
  customerName: string;
  lastMessage: { text: string; direction: MessageDirection; at: string } | null;
  /** "Chatting" until an order exists (orders arrive in later steps). */
  status: string;
}

export interface SellerConversationView {
  conversationId: string;
  customerName: string;
  messages: MessageView[];
}

export interface CustomerConversationView {
  conversationId: string;
  customerName: string;
  messages: MessageView[];
}

export const CHATTING = "Chatting";

export function toMessageView(message: Message): MessageView {
  const s = message.snapshot();
  return {
    id: s.id,
    direction: s.direction,
    kind: s.kind,
    text: s.text,
    options: [...s.options],
    at: s.createdAt.toISOString(),
  };
}
