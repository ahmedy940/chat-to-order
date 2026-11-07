import { Money } from "@/domain/Money";
import { OrderStatus, SHOP_NAME } from "@/domain/types";
import { requireOrderByToken } from "../orderSupport";
import type { OrderRepository } from "../ports/OrderRepository";

export type PayPageState = "awaiting" | "checking" | "paid" | "refunded" | "cancelled";

export interface PayPageLine {
  name: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface PayPageView {
  shopName: string;
  orderNumber: number;
  state: PayPageState;
  lines: PayPageLine[];
  deliveryFee: string;
  total: string;
}

const STATE_BY_STATUS: Partial<Record<OrderStatus, PayPageState>> = {
  [OrderStatus.AwaitingPayment]: "awaiting",
  [OrderStatus.Paid]: "paid",
  [OrderStatus.Refunded]: "refunded",
  [OrderStatus.Cancelled]: "cancelled",
};

/** The pay page shows the frozen order exactly as on the seller's card. */
export class GetPayPage {
  constructor(private readonly deps: { orders: OrderRepository }) {}

  execute(payToken: string): PayPageView {
    const order = requireOrderByToken(this.deps.orders, payToken);
    return {
      shopName: SHOP_NAME,
      orderNumber: order.number,
      // A pay link only exists once payment was requested, so an unknown status means it's cancelled.
      state: order.amountMismatch ? "checking" : (STATE_BY_STATUS[order.status] ?? "cancelled"),
      lines: order.items().map((item) => ({
        name: item.name(),
        quantity: item.quantity(),
        unitPrice: item.unitPrice().format(),
        lineTotal: item.lineTotal().format(),
      })),
      deliveryFee: (order.deliveryFee().money ?? Money.zero()).format(),
      total: order.total().format(),
    };
  }
}
