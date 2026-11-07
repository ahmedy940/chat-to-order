import type {
  ChatLine,
  IntentInput,
  PaymentLeadInInput,
  QuestionInput,
  ReadOrderInput,
} from "@/application/ports/AiProvider";
import { SHOP_NAME } from "@/domain/types";

/** Every instruction the AI gets, in one place. The rules here mirror the order rules in the domain. */

const VOICE =
  `You write for ${SHOP_NAME}, a small clothing shop that sells over chat. ` +
  "Warm, friendly and brief, like a real person texting. English, US dollars. At most one emoji.";

export const READ_SYSTEM = [
  `You read a chat between ${SHOP_NAME} (the shop) and a customer, and fill in the order the customer wants.`,
  "Only what the customer clearly asked for; one item per distinct product.",
  "Never invent or guess a price or a delivery fee: if the exact amount isn't written in the chat, it is missing.",
  "For every value you found, quote the exact message it came from.",
  "variant means colour or style; size only for products sold in sizes; use null for a field that doesn't apply.",
  "Then write draft.text: one short friendly message asking the customer only for what they can answer",
  "(such as size, colour or quantity), never for prices or delivery fees, which the shop sets. Leave draft.options empty.",
  VOICE,
].join(" ");

export function readPrompt(input: ReadOrderInput): string {
  const settled =
    input.settled.length > 0
      ? `\n\nAlready settled by the shop (don't ask for these):\n${input.settled.join("\n")}`
      : "";
  return `Chat:\n${chatText(input.chat)}${settled}`;
}

export const WRITE_SYSTEM =
  `${VOICE} You write one message that the shop owner reviews and sends. ` +
  "Never mention prices, totals, links or order numbers: the shop adds those itself.";

export function questionPrompt(input: QuestionInput): string {
  const asks = input.asks
    .map((ask) =>
      ask.options.length > 0 ? `- ${ask.label}: offer exactly ${ask.options.join(", ")}` : `- ${ask.label}`,
    )
    .join("\n");
  return (
    `Recent chat:\n${chatText(input.chat)}\n\nWrite one short message asking the customer for:\n${asks}\n` +
    "Mention the options in the text; they also appear as buttons the customer can tap."
  );
}

export const INTENT_SYSTEM =
  `You read a chat between ${SHOP_NAME} and a customer and say what the customer wants in their LATEST message, ` +
  "and quote their exact words. order_details: about what to buy (product, size, colour, quantity). " +
  "ready_to_pay: wants to pay or asks for the link. payment_question: a question about paying. " +
  "refund_request: wants to return, cancel or get their money back. other: anything else (thanks, hello).";

export function intentPrompt(input: IntentInput): string {
  return `The order is: ${input.orderStatus}.\n\nChat:\n${chatText(input.chat)}`;
}

export function leadInPrompt(input: PaymentLeadInInput): string {
  return (
    `${input.customerName} ordered: ${input.items}. Write one short, warm sentence that starts the payment message ` +
    "(for example, thanking them for the order). No amounts, links or order numbers: they follow your sentence."
  );
}

function chatText(chat: ChatLine[]): string {
  return chat.map((line) => `${line.from === "customer" ? "Customer" : "Shop"}: ${line.text}`).join("\n");
}
