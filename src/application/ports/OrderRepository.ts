import type { Order } from "@/domain/Order";

/** An order with the time it was first saved: the Orders tab shows it as the order's date. */
export interface ListedOrder {
  order: Order;
  createdAt: Date;
}

export interface OrderRepository {
  get(id: string): Order | null;
  findByPayToken(payToken: string): Order | null;
  /** The conversation's newest order, whatever its status. */
  latestForConversation(conversationId: string): Order | null;
  /** Every order, newest first (the Orders tab). */
  listAll(): ListedOrder[];
  /** All of the conversation's orders, oldest first. */
  listForConversation(conversationId: string): Order[];
  /** Inserts a new order or replaces a saved one: items, details and payment included. */
  save(order: Order): void;
  /** The next order number: #1001, #1002, … (restarts at #1001 after Reset demo). */
  nextNumber(): number;
}
