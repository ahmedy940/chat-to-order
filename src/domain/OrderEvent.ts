import type { Actor, EventType } from "./types";

/**
 * One line of an order's timeline: what happened, who did it, and for money, the signed amount.
 * Order methods return a NewOrderEvent; the use case stamps it (order, sequence, time) and appends it
 * in the same transaction as the order's new status. Events are never edited or removed.
 */
export interface NewOrderEvent {
  readonly type: EventType;
  readonly actor: Actor;
  readonly summary: string;
  readonly quote: string | null;
  /** Money moved: +captured, −refunded. Null for events that move no money. */
  readonly amountCents: number | null;
  readonly feeCents: number | null;
  readonly netCents: number | null;
  readonly paypalRef: string | null;
}

export interface OrderEvent extends NewOrderEvent {
  readonly orderId: string;
  readonly seq: number;
  readonly at: Date;
}

type EventExtras = Partial<
  Pick<NewOrderEvent, "quote" | "amountCents" | "feeCents" | "netCents" | "paypalRef">
>;

export function newEvent(
  type: EventType,
  actor: Actor,
  summary: string,
  extras: EventExtras = {},
): NewOrderEvent {
  return Object.freeze({
    type,
    actor,
    summary,
    quote: extras.quote ?? null,
    amountCents: extras.amountCents ?? null,
    feeCents: extras.feeCents ?? null,
    netCents: extras.netCents ?? null,
    paypalRef: extras.paypalRef ?? null,
  });
}

/** Paid minus refunded: the sum of the money entries. */
export function balanceCents(events: readonly Pick<NewOrderEvent, "amountCents">[]): number {
  return events.reduce((sum, event) => sum + (event.amountCents ?? 0), 0);
}
