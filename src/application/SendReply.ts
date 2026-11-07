import type { Draft } from "@/domain/Draft";
import { ConversationNotFound, DraftOutdated } from "@/domain/errors";
import { Message } from "@/domain/Message";
import type { Clock, IdGenerator } from "./ports/Clock";
import type { ConversationRepository } from "./ports/ConversationRepository";
import type { DraftRepository } from "./ports/DraftRepository";
import type { MessageChannel } from "./ports/MessageChannel";
import type { MessageRepository } from "./ports/MessageRepository";
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
  channel: MessageChannel;
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
}

/** The seller sends a reply. Only the seller ever sends: nothing goes out on its own. */
export class SendReply {
  constructor(private readonly deps: Deps) {}

  execute(input: SendReplyInput): { messageId: string } {
    const { conversations, messages, drafts, channel, uow, clock, ids } = this.deps;
    return uow.run(() => {
      const existing = messages.findByClientId(input.clientId);
      if (existing) return { messageId: existing.id };
      if (!conversations.get(input.conversationId)) throw new ConversationNotFound();
      const draft = this.currentDraft(input);
      const message = Message.fromShop(
        {
          id: ids.newId(),
          conversationId: input.conversationId,
          clientId: input.clientId,
          text: input.text,
          at: clock.now(),
        },
        draft?.payToken ?? null,
      );
      channel.send(message);
      if (draft) drafts.clear(input.conversationId);
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
}
