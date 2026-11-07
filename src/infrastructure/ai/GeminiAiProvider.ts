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
import {
  DEFAULT_INTENT_MODEL,
  DEFAULT_READ_MODEL,
  GeminiError,
  GeminiJsonClient,
  ThinkingLevel,
} from "./GeminiJsonClient";
import {
  INTENT_SYSTEM,
  intentPrompt,
  leadInPrompt,
  questionPrompt,
  READ_SYSTEM,
  readPrompt,
  WRITE_SYSTEM,
} from "./prompts";
import { IntentSchema, OrderReadingSchema, TextSchema, toOrderReading } from "./schemas";

export interface GeminiConfig {
  apiKey: string;
  /** Reads the chat into the order card (needs a little reasoning). */
  readModel?: string;
  /** Writes short messages (a fast, light model is enough). */
  writeModel?: string;
}

/** The AI port, on Gemini's free tier. Every answer is checked against its schema before we use it. */
export class GeminiAiProvider implements AiProvider {
  private client: GeminiJsonClient | null = null;

  constructor(private readonly config: GeminiConfig) {}

  async readOrder(input: ReadOrderInput): Promise<ReadOrderOutput> {
    const model = this.config.readModel || DEFAULT_READ_MODEL;
    const dto = await this.ask((gemini) =>
      gemini.generate({ model, system: READ_SYSTEM, prompt: readPrompt(input), schema: OrderReadingSchema }),
    );
    return { reading: toOrderReading(dto), question: dto.draft.text };
  }

  async classifyIntent(input: IntentInput): Promise<IntentOutput> {
    const model = this.config.writeModel || DEFAULT_INTENT_MODEL;
    const thinking = ThinkingLevel.MINIMAL;
    const prompt = intentPrompt(input);
    return this.ask((gemini) =>
      gemini.generate({ model, system: INTENT_SYSTEM, prompt, schema: IntentSchema, thinking }),
    );
  }

  writeQuestion(input: QuestionInput): Promise<string> {
    return this.write(questionPrompt(input));
  }

  writePaymentLeadIn(input: PaymentLeadInInput): Promise<string> {
    return this.write(leadInPrompt(input));
  }

  private async write(prompt: string): Promise<string> {
    const model = this.config.writeModel || DEFAULT_INTENT_MODEL;
    const thinking = ThinkingLevel.MINIMAL;
    const dto = await this.ask((gemini) =>
      gemini.generate({ model, system: WRITE_SYSTEM, prompt, schema: TextSchema, thinking }),
    );
    return dto.text;
  }

  /** Gemini's errors become the app's AiUnavailable, so the use cases never depend on Gemini. */
  private async ask<T>(work: (gemini: GeminiJsonClient) => Promise<T>): Promise<T> {
    try {
      return await work(this.gemini());
    } catch (error) {
      if (error instanceof GeminiError) throw new AiUnavailable(error.kind === "rate_limited", error.message);
      throw error;
    }
  }

  /** Created on first use, so the app still starts (and works by hand) without a key. */
  private gemini(): GeminiJsonClient {
    if (!this.config.apiKey) throw new AiUnavailable(false, "The AI key isn't set on this server.");
    this.client ??= new GeminiJsonClient(this.config.apiKey);
    return this.client;
  }
}
