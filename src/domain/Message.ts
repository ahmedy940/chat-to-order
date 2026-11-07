import { InvalidMessage } from "./errors";
import { MAX_MESSAGE_LENGTH, MessageDirection, MessageKind } from "./types";

export interface MessageSnapshot {
  id: string;
  conversationId: string;
  /** Made by the sending screen, so a double-tapped Send or a retry is saved only once. */
  clientId: string;
  direction: MessageDirection;
  kind: MessageKind;
  text: string;
  options: readonly string[];
  /** Set on a payment message: the customer phone shows it as a "Pay with PayPal" card. */
  payToken: string | null;
  createdAt: Date;
}

export interface NewMessage {
  id: string;
  conversationId: string;
  clientId: string;
  text: string;
  at: Date;
}

/** One chat bubble. Never edited once written: the chat is the record of what was said. */
export class Message {
  private constructor(private readonly data: MessageSnapshot) {}

  /** A customer message. `isOption`: they tapped one of the buttons the shop offered. */
  static fromCustomer(input: NewMessage, isOption = false): Message {
    const kind = isOption ? MessageKind.OptionReply : MessageKind.Text;
    return Message.create(input, { direction: MessageDirection.In, kind, options: [], payToken: null });
  }

  /** A shop message, with tap buttons (`options`), or a pay-link card when it carries a pay token. */
  static fromShop(input: NewMessage, extras: { payToken?: string | null; options?: readonly string[] } = {}) {
    const payToken = extras.payToken ?? null;
    const kind = payToken ? MessageKind.PayLink : MessageKind.Text;
    const options = [...(extras.options ?? [])];
    return Message.create(input, { direction: MessageDirection.Out, kind, options, payToken });
  }

  static restore(snapshot: MessageSnapshot): Message {
    return new Message({ ...snapshot, options: [...snapshot.options] });
  }

  private static create(
    input: NewMessage,
    shape: Pick<MessageSnapshot, "direction" | "kind" | "options" | "payToken">,
  ) {
    return new Message({
      id: input.id,
      conversationId: input.conversationId,
      clientId: input.clientId,
      ...shape,
      text: cleanText(input.text),
      createdAt: input.at,
    });
  }

  get id(): string {
    return this.data.id;
  }

  get conversationId(): string {
    return this.data.conversationId;
  }

  get createdAt(): Date {
    return this.data.createdAt;
  }

  snapshot(): MessageSnapshot {
    return { ...this.data, options: [...this.data.options] };
  }
}

function cleanText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new InvalidMessage("Type a message first.");
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new InvalidMessage(`Keep messages under ${MAX_MESSAGE_LENGTH} characters.`);
  }
  return trimmed;
}
