import type { NewOrderEvent, OrderEvent } from "@/domain/OrderEvent";

/** The order timeline. Append-only: there is no update or delete. */
export interface OrderEventRepository {
  /** Stamps the event with the order's next sequence number and the time, and saves it. */
  append(orderId: string, event: NewOrderEvent, at: Date): OrderEvent;
  /** Oldest first. */
  listByOrder(orderId: string): OrderEvent[];
}
