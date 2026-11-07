import { Conversation } from "@/domain/Conversation";
import { ConversationNotFound } from "@/domain/errors";
import { Message } from "@/domain/Message";
import { refOffering } from "./orderText";
import { saveWithEvents } from "./orderSupport";
import type { Clock, IdGenerator } from "./ports/Clock";
import type { ConversationRepository } from "./ports/ConversationRepository";
import type { MessageRepository } from "./ports/MessageRepository";
import type { OrderEventRepository } from "./ports/OrderEventRepository";
import type { OrderRepository } from "./ports/OrderRepository";
import type { UnitOfWork } from "./ports/UnitOfWork";

export interface ReceiveCustomerMessageInput {
  /** null starts a new conversation (the demo's New customer). */
  conversationId: string | null;
  clientId: string;
  text: string;
  /** The customer tapped one of the options the shop offered (the text is that option). */
  option?: boolean;
}

export interface ReceivedMessage {
  conversationId: string;
  messageId: string;
}

interface Deps {
  conversations: ConversationRepository;
  messages: MessageRepository;
  orders: OrderRepository;
  events: OrderEventRepository;
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * A customer writes to the shop. Each message is saved once, however many times it's sent. A tapped option
 * settles the detail that offered it, and any reply hands a waiting order back to the seller.
 */
export class ReceiveCustomerMessage {
  constructor(private readonly deps: Deps) {}

  execute(input: ReceiveCustomerMessageInput): ReceivedMessage {
    const { conversations, messages, uow, clock, ids } = this.deps;
    return uow.run(() => {
      const existing = messages.findByClientId(input.clientId);
      if (existing) return { conversationId: existing.conversationId, messageId: existing.id };
      const conversation = this.conversationFor(input.conversationId);
      const message = Message.fromCustomer(
        {
          id: ids.newId(),
          conversationId: conversation.id,
          clientId: input.clientId,
          text: input.text,
          at: clock.now(),
        },
        input.option === true,
      );
      conversation.recordCustomerMessage(message.id);
      conversations.save(conversation);
      messages.add(message);
      this.updateOrder(conversation.id, message.snapshot().text, input.option === true);
      return { conversationId: conversation.id, messageId: message.id };
    });
  }

  /** An existing conversation, or a new (not yet saved) one for a new customer. */
  private conversationFor(id: string | null): Conversation {
    const { conversations, clock, ids } = this.deps;
    if (id === null) return Conversation.start(ids.newId(), conversations.count(), clock.now());
    const conversation = conversations.get(id);
    if (!conversation) throw new ConversationNotFound();
    return conversation;
  }

  private updateOrder(conversationId: string, text: string, isOption: boolean): void {
    const order = this.deps.orders.latestForConversation(conversationId);
    if (!order?.isEditable()) return;
    const ref = isOption ? refOffering(order, text) : null;
    const event = ref ? order.answerOption(ref, text) : null;
    order.customerReplied();
    saveWithEvents(this.deps, order, event);
  }
}
