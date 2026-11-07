/**
 * Slice 1 risk check: can our free Gemini key read a made-up chat into the order shape we defined?
 * Run with `npm run check:ai`. Uses about 2 free-tier requests.
 */
import { Order } from "@/domain/Order";
import {
  DEFAULT_INTENT_MODEL,
  DEFAULT_READ_MODEL,
  GeminiJsonClient,
  ThinkingLevel,
} from "@/infrastructure/ai/GeminiJsonClient";
import { IntentSchema, OrderReadingSchema, toOrderReading } from "@/infrastructure/ai/schemas";
import { heading, requireEnv } from "./env";

const SAMPLE_CHAT = [
  "Customer: hi! do you still have the linen dress?",
  "Customer: 2 of the beige one please",
  "Customer: how much is delivery to Brooklyn?",
].join("\n");

const READ_SYSTEM =
  "You read a chat between a clothing shop (Linen and Co.) and a customer, and fill in the order. " +
  "English only, US dollars. Never invent a price: a price not written in the chat is missing. " +
  "Quote the customer's exact words for every value you found.";

const INTENT_SYSTEM = "Say what the customer wants in their latest message, and quote their words.";

async function checkReading(client: GeminiJsonClient, model: string): Promise<void> {
  heading(`1. Read order with ${model}`);
  const started = Date.now();
  const dto = await client.generate({
    model,
    system: READ_SYSTEM,
    prompt: SAMPLE_CHAT,
    schema: OrderReadingSchema,
  });
  console.log(`   Answer passed the schema check in ${Date.now() - started} ms.`);
  const order = Order.open("check", 1001, "check");
  order.applyReading(toOrderReading(dto), () => `item-${order.items().length + 1}`);
  for (const detail of [...order.items().flatMap((item) => item.allDetails()), order.deliveryFee()]) {
    const source = detail.snapshot().sourceQuote;
    console.log(
      `   ${detail.label.padEnd(16)} ${detail.status.padEnd(8)} ${detail.value ?? "—"}${source ? `  ← "${source}"` : ""}`,
    );
  }
  console.log(`   Total so far ${order.total().format()} · ${order.openDetails().length} to settle`);
  console.log(`   Drafted question: "${dto.draft.text}"`);
}

async function checkIntent(client: GeminiJsonClient, model: string): Promise<void> {
  heading(`2. Customer intent with ${model}`);
  const prompt = "Customer: sorry, can I return them?";
  const thinking = ThinkingLevel.MINIMAL;
  const answer = await client.generate({
    model,
    system: INTENT_SYSTEM,
    prompt,
    schema: IntentSchema,
    thinking,
  });
  console.log(`   "${prompt.slice(10)}" → ${answer.intent} (quote: ${JSON.stringify(answer.quote)})`);
}

async function main(): Promise<void> {
  const client = new GeminiJsonClient(requireEnv("GEMINI_API_KEY"));
  await checkReading(client, process.env.GEMINI_READ_MODEL || DEFAULT_READ_MODEL);
  await checkIntent(client, process.env.GEMINI_INTENT_MODEL || DEFAULT_INTENT_MODEL);
  heading("Gemini check passed.");
}

main().catch((error: unknown) => {
  console.error(`\nGemini check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
