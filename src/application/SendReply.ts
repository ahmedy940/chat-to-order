import { ConversationNotFound } from "@/domain/errors";
import { Message } from "@/domain/Message";
import type { Clock, IdGenerator } from "./ports/Clock";
import type { ConversationRepository } from "./ports/ConversationRepository";
import type { MessageChannel } from "./ports/MessageChannel";
import type { MessageRepository } from "./ports/MessageRepository";
import type { UnitOfWork } from "./ports/UnitOfWork";

export interface SendReplyInput {
  conversationId: string;
  clientId: string;
  text: string;
}

interface Deps {
  conversations: ConversationRepository;
  messages: MessageRepository;
  channel: MessageChannel;
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
}

/** The seller sends a reply. Only the seller ever sends: nothing goes out on its own. */
export class SendReply {
  constructor(private readonly deps: Deps) {}

  execute(input: SendReplyInput): { messageId: string } {
    const { conversations, messages, channel, uow, clock, ids } = this.deps;
    return uow.run(() => {
      const existing = messages.findByClientId(input.clientId);
      if (existing) return { messageId: existing.id };
      if (!conversations.get(input.conversationId)) throw new ConversationNotFound();
      const message = Message.fromShop({
        id: ids.newId(),
        conversationId: input.conversationId,
        clientId: input.clientId,
        text: input.text,
        at: clock.now(),
      });
      channel.send(message);
      return { messageId: message.id };
    });
  }
}
