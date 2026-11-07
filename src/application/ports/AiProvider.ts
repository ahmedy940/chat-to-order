import type { OrderReading } from "@/domain/OrderSnapshot";

/** One line of the chat, as the AI sees it. */
export interface ChatLine {
  from: "customer" | "shop";
  text: string;
}

export interface ReadOrderInput {
  chat: ChatLine[];
  /** Details the seller already set ("Item 1 price: $60.00"). The AI must not ask for these. */
  settled: string[];
}

export interface ReadOrderOutput {
  reading: OrderReading;
  /** A short friendly question for whatever the customer can still answer. */
  question: string;
}

export interface QuestionInput {
  chat: ChatLine[];
  /** What to ask, with the options the seller offered (empty when the customer types the answer). */
  asks: { label: string; options: string[] }[];
}

export interface PaymentLeadInInput {
  customerName: string;
  /** "2 × Beige linen dress (M)". The AI never sees or writes amounts or links. */
  items: string;
}

/**
 * The AI behind an interface, so the order rules are tested without Gemini. The AI reads and writes text;
 * it never supplies an amount, a link or a decision.
 */
export interface AiProvider {
  readOrder(input: ReadOrderInput): Promise<ReadOrderOutput>;
  writeQuestion(input: QuestionInput): Promise<string>;
  writePaymentLeadIn(input: PaymentLeadInInput): Promise<string>;
}

/** The AI couldn't answer: rate-limited ("busy"), unreachable, or its answer didn't fit the shape we asked for. */
export class AiUnavailable extends Error {
  constructor(
    readonly busy: boolean,
    message: string,
  ) {
    super(message);
    this.name = "AiUnavailable";
  }

  /** The message the seller sees when Read order fails. Typing the details by hand always still works. */
  static forReading(error: unknown): AiUnavailable {
    const busy = error instanceof AiUnavailable && error.busy;
    const message = busy
      ? "The AI is busy. Try again in a minute."
      : "Couldn't read this conversation. Try again.";
    return new AiUnavailable(busy, message);
  }
}
