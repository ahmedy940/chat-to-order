import { Draft } from "@/domain/Draft";
import type { Message } from "@/domain/Message";
import type { Order } from "@/domain/Order";
import type { OrderDetail } from "@/domain/OrderDetail";
import { DetailStatus, DraftKind, MessageDirection, type DetailRef } from "@/domain/types";
import type { OrderDeps } from "./orderSupport";
import type { AiProvider, ChatLine } from "./ports/AiProvider";
import type { MessageRepository } from "./ports/MessageRepository";

/** Turning chats and orders into the text the AI reads, and the question draft it writes. */

export interface Ask {
  label: string;
  options: string[];
}

/** How much of the chat the AI sees when writing a question: enough for tone, not the whole history. */
const RECENT_LINES = 12;

/** The AI's question for everything still open, or null when the AI is down (a plain question is used then). */
export async function writeQuestionText(
  deps: { messages: MessageRepository; ai: AiProvider },
  order: Order,
): Promise<string | null> {
  const chat = toChat(deps.messages.listByConversation(order.conversationId)).slice(-RECENT_LINES);
  try {
    return await deps.ai.writeQuestion({ chat, asks: asksFor(order) });
  } catch {
    return null;
  }
}

export function toChat(messages: Message[]): ChatLine[] {
  return messages.map((message) => {
    const s = message.snapshot();
    return { from: s.direction === MessageDirection.In ? "customer" : "shop", text: s.text };
  });
}

interface PlacedDetail {
  ref: DetailRef;
  detail: OrderDetail;
  itemNumber: number | null;
}

/** Every detail on the order with where it sits: an item, or the order's delivery fee. */
function placedDetails(order: Order): PlacedDetail[] {
  const items = order
    .items()
    .flatMap((item, index) =>
      item
        .allDetails()
        .map((detail) => ({ ref: { itemId: item.id, field: detail.field }, detail, itemNumber: index + 1 })),
    );
  const fee = order.deliveryFee();
  return [...items, { ref: { itemId: null, field: fee.field }, detail: fee, itemNumber: null }];
}

/** What the seller already set, so the AI doesn't ask for it: "Item 1 price: $60.00". */
export function settledLines(order: Order): string[] {
  return placedDetails(order)
    .filter(({ detail }) => detail.status === DetailStatus.SetByYou)
    .map(({ detail, itemNumber }) => {
      const where = itemNumber ? `Item ${itemNumber} ` : "";
      return `${where}${detail.label.toLowerCase()}: ${detail.money?.format() ?? detail.value}`;
    });
}

/** The open details the customer will be asked about, with any options the seller offered. Never a price. */
export function asksFor(order: Order): Ask[] {
  return order
    .askableDetails()
    .map((detail) => ({ label: detail.label, options: [...detail.offeredOptions] }));
}

/** The open detail that offered this option, so a tapped button settles the right detail. */
export function refOffering(order: Order, option: string): DetailRef | null {
  const match = placedDetails(order).find(
    ({ detail }) => detail.isOpen && detail.offeredOptions.includes(option),
  );
  return match?.ref ?? null;
}

/** Used when the AI can't write the question: plain, but always correct. */
export function fallbackQuestion(asks: Ask[]): string {
  const parts = asks.map(({ label, options }) =>
    options.length > 0
      ? `which ${label.toLowerCase()} you'd like (${options.join(" or ")})`
      : `the ${label.toLowerCase()}`,
  );
  const joined =
    parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return `Thanks! Could you tell us ${joined}?`;
}

/**
 * Puts the question in the reply box: the AI's text when it wrote one, otherwise the plain fallback, with the
 * offered options as tap buttons. When nothing is left to ask, an old question is removed.
 */
export function saveQuestion(
  deps: Pick<OrderDeps, "drafts" | "ids">,
  order: Order,
  aiText: string | null,
): void {
  const asks = asksFor(order);
  if (asks.length === 0) return dropQuestion(deps, order);
  const text = aiText?.trim() || fallbackQuestion(asks);
  const options = asks.flatMap((ask) => ask.options);
  const byAi = Boolean(aiText?.trim());
  const ids = { id: deps.ids.newId(), conversationId: order.conversationId, orderId: order.id };
  deps.drafts.save(Draft.question({ ...ids, text, options, byAi }));
}

/** Once nothing is left to ask, a question still waiting in the reply box is out of date. */
export function dropQuestion(deps: Pick<OrderDeps, "drafts">, order: Order): void {
  if (deps.drafts.get(order.conversationId)?.kind === DraftKind.Question)
    deps.drafts.clear(order.conversationId);
}
