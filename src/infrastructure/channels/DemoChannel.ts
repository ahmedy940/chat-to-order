import type { MessageChannel } from "@/application/ports/MessageChannel";
import type { MessageRepository } from "@/application/ports/MessageRepository";
import type { Message } from "@/domain/Message";

/** The two-phone demo: "sending" saves the message, and the customer phone reads it from the same store. */
export class DemoChannel implements MessageChannel {
  constructor(private readonly messages: MessageRepository) {}

  send(message: Message): void {
    this.messages.add(message);
  }
}
