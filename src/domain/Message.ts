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

  static fromCustomer(input: NewMessage): Message {
    return Message.create(input, MessageDirection.In);
  }

  static fromShop(input: NewMessage): Message {
    return Message.create(input, MessageDirection.Out);
  }

  static restore(snapshot: MessageSnapshot): Message {
    return new Message({ ...snapshot, options: [...snapshot.options] });
  }

  private static create(input: NewMessage, direction: MessageDirection): Message {
    return new Message({
      id: input.id,
      conversationId: input.conversationId,
      clientId: input.clientId,
      direction,
      kind: MessageKind.Text,
      text: cleanText(input.text),
      options: [],
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
