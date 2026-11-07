import type { DetailField } from "@/domain/types";
import { saveQuestion, writeQuestionText } from "./orderText";
import { requireOrder, type OrderDeps } from "./orderSupport";
import type { AiProvider } from "./ports/AiProvider";
import type { MessageRepository } from "./ports/MessageRepository";

export interface AskCustomerInput {
  orderId: string;
  itemId: string | null;
  field: DetailField;
  /** Up to 3 choices the customer can tap. Never for a price. */
  options: string[];
}

interface Deps extends OrderDeps {
  messages: MessageRepository;
  ai: AiProvider;
}

/**
 * The seller ticks Ask customer and offers up to 3 options. The AI rewrites the question in the reply box to
 * ask for everything still open, with the options as tap buttons. If the AI is down, a plain question is used.
 */
export class AskCustomer {
  constructor(private readonly deps: Deps) {}

  async execute(input: AskCustomerInput): Promise<{ orderId: string }> {
    const ref = { itemId: input.itemId, field: input.field };
    const preview = requireOrder(this.deps.orders, input.orderId);
    preview.askCustomer(ref, input.options); // checks the rules before spending an AI call
    const text = await writeQuestionText(this.deps, preview);
    return this.deps.uow.run(() => {
      const order = requireOrder(this.deps.orders, input.orderId);
      order.askCustomer(ref, input.options);
      this.deps.orders.save(order);
      saveQuestion(this.deps, order, text);
      return { orderId: order.id };
    });
  }
}
