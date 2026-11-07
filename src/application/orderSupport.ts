import { OrderNotFound, PayLinkNotFound } from "@/domain/errors";
import type { Order } from "@/domain/Order";
import type { NewOrderEvent } from "@/domain/OrderEvent";
import type { Clock, IdGenerator } from "./ports/Clock";
import type { DraftRepository } from "./ports/DraftRepository";
import type { OrderEventRepository } from "./ports/OrderEventRepository";
import type { OrderRepository } from "./ports/OrderRepository";
import type { UnitOfWork } from "./ports/UnitOfWork";

/** What most order use cases need. */
export interface OrderDeps {
  orders: OrderRepository;
  events: OrderEventRepository;
  drafts: DraftRepository;
  uow: UnitOfWork;
  clock: Clock;
  ids: IdGenerator;
}

export function requireOrder(orders: OrderRepository, id: string): Order {
  const order = orders.get(id);
  if (!order) throw new OrderNotFound();
  return order;
}

export function requireOrderByToken(orders: OrderRepository, payToken: string): Order {
  const order = orders.findByPayToken(payToken);
  if (!order) throw new PayLinkNotFound();
  return order;
}

/**
 * Saves the order and appends the timeline events it returned. Always called inside `uow.run`, so the new
 * status and its timeline line are saved together or not at all.
 */
export function saveWithEvents(
  deps: Pick<OrderDeps, "orders" | "events" | "clock">,
  order: Order,
  ...events: (NewOrderEvent | null)[]
): void {
  deps.orders.save(order);
  for (const event of events) if (event) deps.events.append(order.id, event, deps.clock.now());
}
