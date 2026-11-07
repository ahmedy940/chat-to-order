import type { Order } from "@/domain/Order";

export interface OrderRepository {
  get(id: string): Order | null;
  findByPayToken(payToken: string): Order | null;
  /** The conversation's newest order, whatever its status. */
  latestForConversation(conversationId: string): Order | null;
  /** Inserts a new order or replaces a saved one: items, details and payment included. */
  save(order: Order): void;
  /** The next order number: #1001, #1002, … (restarts at #1001 after Reset demo). */
  nextNumber(): number;
}
