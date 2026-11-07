import type { Conversation } from "@/domain/Conversation";
import { ConversationNotFound } from "@/domain/errors";
import type { ConversationRepository } from "../ports/ConversationRepository";
import type { DraftRepository } from "../ports/DraftRepository";
import type { MessageRepository } from "../ports/MessageRepository";
import type { OrderEventRepository } from "../ports/OrderEventRepository";
import type { OrderRepository } from "../ports/OrderRepository";
import type { PayUrl } from "../ports/TokenFactory";
import { toDraftView, toOrderView } from "./orderViews";
import {
  toMessageViews,
  type CustomerConversationView,
  type MessageView,
  type SellerConversationView,
} from "./views";

interface Deps {
  conversations: ConversationRepository;
  messages: MessageRepository;
  orders: OrderRepository;
  events: OrderEventRepository;
  drafts: DraftRepository;
  payUrl: PayUrl;
}

abstract class ConversationQuery {
  constructor(protected readonly deps: Deps) {}

  protected load(id: string): { conversation: Conversation; messages: MessageView[] } {
    const conversation = this.deps.conversations.get(id);
    if (!conversation) throw new ConversationNotFound();
    const messages = toMessageViews(
      this.deps.messages.listByConversation(id),
      this.deps.orders,
      this.deps.payUrl,
    );
    return { conversation, messages };
  }
}

/** The seller's view of one conversation: the chat, the current order card with its timeline, and the draft. */
export class GetSellerConversation extends ConversationQuery {
  execute(id: string): SellerConversationView {
    const { conversation, messages } = this.load(id);
    const order = this.deps.orders.latestForConversation(id);
    const events = order ? this.deps.events.listByOrder(order.id) : [];
    return {
      conversationId: conversation.id,
      customerName: conversation.customerName,
      messages,
      order: order ? toOrderView(order, events, this.deps.payUrl) : null,
      draft: toDraftView(this.deps.drafts.get(id)),
    };
  }
}

/** The customer's view: only the chat, nothing the shop keeps to itself. */
export class GetCustomerConversation extends ConversationQuery {
  execute(id: string): CustomerConversationView {
    const { conversation, messages } = this.load(id);
    return { conversationId: conversation.id, customerName: conversation.customerName, messages };
  }

  /** The customer phone opens on the most recent conversation, so a page refresh keeps your place. */
  latestId(): string | null {
    return this.deps.conversations.latest()?.id ?? null;
  }
}
