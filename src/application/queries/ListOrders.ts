import { ORDER_STATUS_LABELS, type OrderStatus } from "@/domain/types";
import type { ConversationRepository } from "../ports/ConversationRepository";
import type { ListedOrder, OrderRepository } from "../ports/OrderRepository";

/** One row of the Orders tab. */
export interface OrderListRow {
  orderId: string;
  conversationId: string;
  number: number;
  customerName: string;
  /** "2 × Beige linen dress (M)" */
  items: string;
  total: string;
  status: OrderStatus;
  statusLabel: string;
  /** From PayPal once paid; null before. */
  payer: string | null;
  /** When the order was started (ISO). */
  date: string;
}

/** The Orders tab: every order, newest first. */
export class ListOrders {
  constructor(private readonly deps: { orders: OrderRepository; conversations: ConversationRepository }) {}

  execute(): OrderListRow[] {
    return this.deps.orders.listAll().map((listed) => this.toRow(listed));
  }

  private toRow({ order, createdAt }: ListedOrder): OrderListRow {
    const s = order.snapshot();
    return {
      orderId: s.id,
      conversationId: s.conversationId,
      number: s.number,
      customerName: this.deps.conversations.get(s.conversationId)?.customerName ?? "Customer",
      items:
        order
          .items()
          .map((item) => item.summary())
          .join(", ") || "No items yet",
      total: order.total().format(),
      status: s.status,
      statusLabel: ORDER_STATUS_LABELS[s.status],
      payer: s.payment?.payer?.name ?? null,
      date: createdAt.toISOString(),
    };
  }
}
