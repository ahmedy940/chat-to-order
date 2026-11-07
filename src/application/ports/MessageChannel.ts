import type { Message } from "@/domain/Message";

/**
 * Delivers the shop's messages to the customer. Only the demo channel exists now: it saves the message, and the
 * customer phone reads it from there. A WhatsApp channel would plug in here later.
 */
export interface MessageChannel {
  send(message: Message): void;
}
