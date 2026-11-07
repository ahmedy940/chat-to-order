import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";

/** Free-tier models (checked on aistudio.google.com/docs/pricing, Nov 2026). Override in .env.local. */
export const DEFAULT_READ_MODEL = "gemini-3.6-flash";
export const DEFAULT_INTENT_MODEL = "gemini-3.5-flash-lite";

export { ThinkingLevel };

const TIMEOUT_MS = 30_000;
const HTTP_TOO_MANY_REQUESTS = 429;
const TIMEOUT_ERRORS = ["AbortError", "TimeoutError"];

export type GeminiFailure = "rate_limited" | "unavailable" | "invalid_output";

export class GeminiError extends Error {
  constructor(
    readonly kind: GeminiFailure,
    message: string,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

export interface JsonRequest<T> {
  model: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** How much the model reasons before answering. More is slower; LOW is enough to read a chat. */
  thinking?: ThinkingLevel;
}

/** Zod schema → the JSON Schema Gemini follows. Gemini doesn't accept the `$schema` marker. */
export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/** Asks Gemini for JSON in a fixed shape and checks the answer against that same shape. */
export class GeminiJsonClient {
  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate<T>(request: JsonRequest<T>): Promise<T> {
    const text = await this.callModel(request);
    const parsed = request.schema.safeParse(safeJson(text));
    if (!parsed.success)
      throw new GeminiError("invalid_output", "Gemini's answer didn't match the expected shape.");
    return parsed.data;
  }

  private async callModel<T>(request: JsonRequest<T>): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: request.model,
        contents: request.prompt,
        config: {
          systemInstruction: request.system,
          responseMimeType: "application/json",
          responseJsonSchema: toGeminiSchema(request.schema),
          temperature: 0.2,
          thinkingConfig: { thinkingLevel: request.thinking ?? ThinkingLevel.LOW },
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        },
      });
      return response.text ?? "";
    } catch (error) {
      throw toGeminiError(error);
    }
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toGeminiError(error: unknown): GeminiError {
  if (error instanceof ApiError && error.status === HTTP_TOO_MANY_REQUESTS) {
    return new GeminiError("rate_limited", "The AI is busy. Try again in a minute.");
  }
  if (error instanceof Error && TIMEOUT_ERRORS.includes(error.name)) {
    return new GeminiError("unavailable", "The AI took too long to answer. Try again.");
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new GeminiError("unavailable", `Couldn't reach the AI: ${detail}`);
}
