import { ConversationNotFound } from "@/domain/errors";
import type { Conversation } from "@/domain/Conversation";
import type { ConversationRepository } from "../ports/ConversationRepository";
import type { MessageRepository } from "../ports/MessageRepository";
import { toMessageView, type CustomerConversationView, type SellerConversationView } from "./views";

interface Deps {
  conversations: ConversationRepository;
  messages: MessageRepository;
}

abstract class ConversationQuery {
  constructor(protected readonly deps: Deps) {}

  protected load(id: string): { conversation: Conversation; messages: ReturnType<typeof toMessageView>[] } {
    const conversation = this.deps.conversations.get(id);
    if (!conversation) throw new ConversationNotFound();
    return { conversation, messages: this.deps.messages.listByConversation(id).map(toMessageView) };
  }
}

/** The seller's view of one conversation. Later steps add the order, draft, proposal and timeline. */
export class GetSellerConversation extends ConversationQuery {
  execute(id: string): SellerConversationView {
    const { conversation, messages } = this.load(id);
    return { conversationId: conversation.id, customerName: conversation.customerName, messages };
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
