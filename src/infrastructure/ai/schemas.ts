import { z } from "zod";
import type { OrderReading } from "@/domain/OrderSnapshot";
import { Intent, MAX_OPTIONS } from "@/domain/types";

/**
 * One schema per AI answer, written once: it gives the TypeScript type, the JSON shape Gemini must follow,
 * and the runtime check of what Gemini actually returned.
 */

const DetailSchema = z.object({
  value: z.string().nullable().describe("The value in the customer's words, or null if never mentioned."),
  status: z.enum(["found", "missing"]),
  quote: z.string().nullable().describe("The exact customer message this came from, or null."),
});

const ItemSchema = z.object({
  product: DetailSchema,
  variant: DetailSchema.nullable().describe("Colour or style. Null when it doesn't apply to this product."),
  size: DetailSchema.nullable().describe("Size. Null when the product has no sizes."),
  quantity: DetailSchema,
  unit_price: DetailSchema.describe("Only a price written in the chat. Never guess one."),
});

export const OrderReadingSchema = z.object({
  items: z.array(ItemSchema).max(10),
  delivery_fee: DetailSchema.describe("Only a delivery fee written in the chat. Otherwise missing."),
  draft: z.object({
    text: z.string().describe("One short, friendly message asking only for what the customer can answer."),
    options: z.array(z.string()).max(MAX_OPTIONS),
  }),
});
export type OrderReadingDto = z.infer<typeof OrderReadingSchema>;

export const IntentSchema = z.object({
  intent: z.enum(Object.values(Intent) as [Intent, ...Intent[]]),
  quote: z.string().nullable().describe("The customer's words that show this intent."),
});
export type IntentDto = z.infer<typeof IntentSchema>;

/** Gemini's shape → our domain's reading. */
export function toOrderReading(dto: OrderReadingDto): OrderReading {
  return { items: dto.items.map((item) => ({ ...item })), deliveryFee: dto.delivery_fee };
}
