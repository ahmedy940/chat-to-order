import type { DetailField } from "@/domain/types";
import { requireOrder, saveWithEvents, type OrderDeps } from "./orderSupport";

export interface SettleDetailInput {
  orderId: string;
  /** null for the order's delivery fee. */
  itemId: string | null;
  field: DetailField;
  value: string;
}

/** The seller types a value on the order card. It's marked "Set by you" and the AI never overwrites it. */
export class SettleDetail {
  constructor(private readonly deps: OrderDeps) {}

  execute(input: SettleDetailInput): { orderId: string } {
    return this.deps.uow.run(() => {
      const order = requireOrder(this.deps.orders, input.orderId);
      const event = order.settle({ itemId: input.itemId, field: input.field }, input.value);
      saveWithEvents(this.deps, order, event);
      return { orderId: order.id };
    });
  }
}

/** The seller adds another item line to the card. */
export class AddItem {
  constructor(private readonly deps: OrderDeps) {}

  execute(orderId: string): { itemId: string } {
    return this.deps.uow.run(() => {
      const order = requireOrder(this.deps.orders, orderId);
      const item = order.addBlankItem(this.deps.ids.newId());
      this.deps.orders.save(order);
      return { itemId: item.id };
    });
  }
}
