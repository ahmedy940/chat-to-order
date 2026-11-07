import { ConversationNotFound, NothingToRead, OrderLocked } from "@/domain/errors";
import type { Message } from "@/domain/Message";
import { Order } from "@/domain/Order";
import { FINISHED_ORDER_STATUSES, MessageDirection } from "@/domain/types";
import { saveQuestion, settledLines, toChat } from "./orderText";
import { saveWithEvents, type OrderDeps } from "./orderSupport";
import { AiUnavailable, type AiProvider, type ReadOrderOutput } from "./ports/AiProvider";
import type { ConversationRepository } from "./ports/ConversationRepository";
import type { MessageRepository } from "./ports/MessageRepository";

interface Deps extends OrderDeps {
  conversations: ConversationRepository;
  messages: MessageRepository;
  ai: AiProvider;
}

/**
 * Read order: the AI reads the chat since the last finished order and fills in the card. Values the seller
 * set are never overwritten, a price not written in the chat stays Missing, and if the AI fails nothing is
 * saved (the seller can still type the details).
 */
export class ReadOrder {
  constructor(private readonly deps: Deps) {}

  async execute(conversationId: string): Promise<{ orderId: string }> {
    if (!this.deps.conversations.get(conversationId)) throw new ConversationNotFound();
    const current = this.editableOrder(conversationId);
    const messages = this.messagesSinceLastOrder(conversationId, current);
    if (!messages.some((m) => m.snapshot().direction === MessageDirection.In)) throw new NothingToRead();
    const result = await this.read(messages, current);
    return this.deps.uow.run(() => this.apply(conversationId, current?.id ?? null, result));
  }

  /** The order to fill in: the open one, or none (a new order starts). A frozen order can't be re-read. */
  private editableOrder(conversationId: string): Order | null {
    const latest = this.deps.orders.latestForConversation(conversationId);
    if (!latest || FINISHED_ORDER_STATUSES.includes(latest.status)) return null;
    if (!latest.isEditable()) throw new OrderLocked();
    return latest;
  }

  /** Earlier, finished orders were about other purchases: read only what was said after the last one ended. */
  private messagesSinceLastOrder(conversationId: string, current: Order | null): Message[] {
    const finished = this.deps.orders
      .listForConversation(conversationId)
      .filter((o) => o.id !== current?.id && FINISHED_ORDER_STATUSES.includes(o.status));
    const last = finished.at(-1);
    const endedAt = last ? this.deps.events.listByOrder(last.id).at(-1)?.at : undefined;
    const all = this.deps.messages.listByConversation(conversationId);
    return endedAt ? all.filter((m) => m.createdAt > endedAt) : all;
  }

  private async read(messages: Message[], current: Order | null): Promise<ReadOrderOutput> {
    try {
      return await this.deps.ai.readOrder({
        chat: toChat(messages),
        settled: current ? settledLines(current) : [],
      });
    } catch (error) {
      throw AiUnavailable.forReading(error);
    }
  }

  private apply(
    conversationId: string,
    currentId: string | null,
    result: ReadOrderOutput,
  ): { orderId: string } {
    const { orders, ids } = this.deps;
    const existing = currentId ? orders.get(currentId) : null;
    const order = existing ?? Order.open(ids.newId(), orders.nextNumber(), conversationId);
    const event = order.applyReading(result.reading, () => ids.newId());
    saveWithEvents(this.deps, order, event);
    saveQuestion(this.deps, order, result.question);
    return { orderId: order.id };
  }
}
