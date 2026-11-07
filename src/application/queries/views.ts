import type { Message } from "@/domain/Message";
import type { MessageDirection, MessageKind } from "@/domain/types";
import type { OrderRepository } from "../ports/OrderRepository";
import type { PayUrl } from "../ports/TokenFactory";
import type { DraftView, OrderView } from "./orderViews";

/** What the screens receive. Plain JSON: dates as ISO strings, money already formatted. */

export interface PayLinkView {
  url: string;
  /** "Order #1001 · $128.00" */
  label: string;
}

export interface MessageView {
  id: string;
  direction: MessageDirection;
  kind: MessageKind;
  text: string;
  options: string[];
  payLink: PayLinkView | null;
  at: string;
}

export interface InboxRow {
  conversationId: string;
  customerName: string;
  lastMessage: { text: string; direction: MessageDirection; at: string } | null;
  /** "Chatting" until the conversation has an order, then the order's status. */
  status: string;
}

export interface SellerConversationView {
  conversationId: string;
  customerName: string;
  messages: MessageView[];
  order: OrderView | null;
  draft: DraftView | null;
  /** "Read order" before the first reading, "Read again" after new customer messages, otherwise null. */
  readAction: "Read order" | "Read again" | null;
}

export interface CustomerConversationView {
  conversationId: string;
  customerName: string;
  messages: MessageView[];
}

export const CHATTING = "Chatting";

/** Message views, with each payment message turned into a pay-link card for its order. */
export function toMessageViews(messages: Message[], orders: OrderRepository, payUrl: PayUrl): MessageView[] {
  return messages.map((message) => {
    const s = message.snapshot();
    const order = s.payToken ? orders.findByPayToken(s.payToken) : null;
    const payLink =
      s.payToken && order
        ? { url: payUrl(s.payToken), label: `Order #${order.number} · ${order.total().format()}` }
        : null;
    const { id, direction, kind, text } = s;
    return { id, direction, kind, text, options: [...s.options], payLink, at: s.createdAt.toISOString() };
  });
}
