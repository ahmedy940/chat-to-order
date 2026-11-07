import {
  AiUnavailable,
  type AiProvider,
  type IntentInput,
  type IntentOutput,
  type PaymentLeadInInput,
  type QuestionInput,
  type ReadOrderInput,
  type ReadOrderOutput,
} from "@/application/ports/AiProvider";
import type { DetailReading } from "@/domain/OrderDetail";
import { Intent } from "@/domain/types";

/** Shorthands for writing what the pretend AI "read". */
export const found = (value: string, quote: string): DetailReading => ({ value, status: "found", quote });
export const missing = (): DetailReading => ({ value: null, status: "missing", quote: null });

/**
 * A pretend AI the tests steer: what it reads, what it writes, or that it fails. It records what it was asked,
 * so tests can check, for example, that seller-set values were passed along.
 */
export class FakeAiProvider implements AiProvider {
  reading: ReadOrderOutput = { reading: { items: [], deliveryFee: null }, question: "" };
  question = "Which size would you like?";
  /** null: the AI "fails" to write the payment line, so the fixed sentence is used. */
  leadIn: string | null = null;
  failure: AiUnavailable | null = null;
  readonly asked: { read: ReadOrderInput[]; questions: QuestionInput[]; leadIns: PaymentLeadInInput[] } = {
    read: [],
    questions: [],
    leadIns: [],
  };

  readOrder(input: ReadOrderInput): Promise<ReadOrderOutput> {
    this.asked.read.push(input);
    return this.failure ? Promise.reject(this.failure) : Promise.resolve(structuredClone(this.reading));
  }

  /** What the customer "wants" in their latest message. */
  intent: IntentOutput = { intent: Intent.Other, quote: null };
  readonly intentsAsked: IntentInput[] = [];

  classifyIntent(input: IntentInput): Promise<IntentOutput> {
    this.intentsAsked.push(input);
    return this.failure ? Promise.reject(this.failure) : Promise.resolve({ ...this.intent });
  }

  writeQuestion(input: QuestionInput): Promise<string> {
    this.asked.questions.push(input);
    return this.failure ? Promise.reject(this.failure) : Promise.resolve(this.question);
  }

  writePaymentLeadIn(input: PaymentLeadInInput): Promise<string> {
    this.asked.leadIns.push(input);
    if (this.failure || this.leadIn === null)
      return Promise.reject(this.failure ?? new AiUnavailable(false, "off"));
    return Promise.resolve(this.leadIn);
  }
}
