import { Channel } from "./types";

export interface ConversationSnapshot {
  id: string;
  customerName: string;
  channel: Channel;
  lastCustomerMessageId: string | null;
  /** The last customer message the agent has looked at (used from step 6). */
  lastHandledMessageId: string | null;
  createdAt: Date;
}

/** Made-up demo customers, handed out in turn. After the list runs out, names get a number: "Maya Brooks 2". */
const MADE_UP_NAMES = [
  "Maya Brooks",
  "Daniel Kim",
  "Sofia Martinez",
  "Omar Haddad",
  "Grace Okafor",
  "Leo Fischer",
  "Hana Sato",
  "Noah Bennett",
] as const;

/** One customer's chat with the shop. */
export class Conversation {
  private constructor(private data: ConversationSnapshot) {}

  /** `existingCount` is how many conversations exist already; it picks the next made-up name. */
  static start(id: string, existingCount: number, at: Date): Conversation {
    return new Conversation({
      id,
      customerName: Conversation.nameFor(existingCount),
      channel: Channel.Demo,
      lastCustomerMessageId: null,
      lastHandledMessageId: null,
      createdAt: at,
    });
  }

  static restore(snapshot: ConversationSnapshot): Conversation {
    return new Conversation({ ...snapshot });
  }

  static nameFor(index: number): string {
    const name = MADE_UP_NAMES[index % MADE_UP_NAMES.length] ?? MADE_UP_NAMES[0];
    const round = Math.floor(index / MADE_UP_NAMES.length);
    return round === 0 ? name : `${name} ${round + 1}`;
  }

  get id(): string {
    return this.data.id;
  }

  get customerName(): string {
    return this.data.customerName;
  }

  get createdAt(): Date {
    return this.data.createdAt;
  }

  recordCustomerMessage(messageId: string): void {
    this.data = { ...this.data, lastCustomerMessageId: messageId };
  }

  snapshot(): ConversationSnapshot {
    return { ...this.data };
  }
}
