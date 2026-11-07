import type { DetailReading, DetailSnapshot } from "./OrderDetail";
import type { ItemReading, ItemSnapshot } from "./OrderItem";
import type { PaymentSnapshot } from "./Payment";
import type { OrderStatus } from "./types";

/** What the AI read from the conversation, in our own shape (already validated at the edge). */
export interface OrderReading {
  items: ItemReading[];
  deliveryFee: DetailReading | null;
}

/** An order as plain data, for saving and restoring. */
export interface OrderSnapshot {
  id: string;
  number: number;
  conversationId: string;
  status: OrderStatus;
  items: ItemSnapshot[];
  deliveryFee: DetailSnapshot;
  frozenTotalCents: number | null;
  payToken: string | null;
  payment: PaymentSnapshot | null;
  amountMismatch: boolean;
}
