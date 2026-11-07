import type { Draft } from "@/domain/Draft";
import { ConversationNotFound, DraftOutdated } from "@/domain/errors";
import { Message } from "@/domain/Message";
import { DraftKind } from "@/domain/types";
import { saveWithEvents } from "./orderSupport";
import type { Clock, IdGenerator } from "./ports/Clock";
import type { ConversationRepository } from "./ports/ConversationRepository";
import type { DraftRepository } from "./ports/DraftRepository";
import type { MessageChannel } from "./ports/MessageChannel";
import type { MessageRepository } from "./ports/MessageRepository";
import type { OrderEventRepository } from "./ports/OrderEventRepository";
import type { OrderRepository } from "./ports/OrderRepository";
import type { UnitOfWork } from "./ports/UnitOfWork";

export interface SendReplyInput {
  conversationId: string;
  clientId: string;
  /** The text in the reply box (the seller may have edited the draft). */
  text: string;
  /** Set when the reply box held a draft: it must still be the current one. */
  draftId?: string | null;
}

interface Deps {
  conversations: ConversationRepository;
  messages: MessageRepository;
  drafts: DraftRepository;
  orders: OrderRepository;
  events: OrderEventRepository;
  channel: MessageChannel;
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * The seller sends a reply or the draft. Only the seller ever sends: nothing goes out on its own. Each draft
 * is sent once (a replaced or already-sent draft is refused), and sending a question makes the order
 * Waiting for customer.
 */
export class SendReply {
  constructor(private readonly deps: Deps) {}

  execute(input: SendReplyInput): { messageId: string } {
    const { conversations, messages, drafts, channel, uow, clock, ids } = this.deps;
    return uow.run(() => {
      const existing = messages.findByClientId(input.clientId);
      if (existing) return { messageId: existing.id };
      if (!conversations.get(input.conversationId)) throw new ConversationNotFound();
      const draft = this.currentDraft(input);
      const base = {
        id: ids.newId(),
        conversationId: input.conversationId,
        clientId: input.clientId,
        at: clock.now(),
      };
      const message = Message.fromShop(
        { ...base, text: input.text },
        { payToken: draft?.payToken, options: draft?.options },
      );
      channel.send(message);
      if (draft) {
        drafts.clear(input.conversationId);
        this.markQuestionSent(draft, message.snapshot().text);
      }
      return { messageId: message.id };
    });
  }

  /** The draft being sent, or null for a typed reply. A replaced draft is refused, so stale text never goes out. */
  private currentDraft(input: SendReplyInput): Draft | null {
    if (!input.draftId) return null;
    const draft = this.deps.drafts.get(input.conversationId);
    if (!draft || draft.id !== input.draftId) throw new DraftOutdated();
    return draft;
  }

  private markQuestionSent(draft: Draft, text: string): void {
    if (draft.kind !== DraftKind.Question || !draft.orderId) return;
    const order = this.deps.orders.get(draft.orderId);
    if (!order?.isEditable()) return;
    saveWithEvents(this.deps, order, order.markQuestionSent(text));
  }
}
