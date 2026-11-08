import { LastItem, UnknownDetail } from "./errors";
import { Money } from "./Money";
import { OrderDetail, type DetailReading, type DetailSnapshot } from "./OrderDetail";
import { ITEM_FIELD_ORDER, ItemField, REQUIRED_ITEM_FIELDS } from "./types";

export interface ItemSnapshot {
  id: string;
  position: number;
  details: DetailSnapshot[];
}

/** What the AI reported for one item. Size and variant are null when they don't apply. */
export type ItemReading = Partial<Record<ItemField, DetailReading | null>>;

/** One line of the order: product, variant or size, quantity and unit price. */
export class OrderItem {
  private constructor(
    readonly id: string,
    readonly position: number,
    private readonly details: Map<ItemField, OrderDetail>,
  ) {}

  static blank(id: string, position: number): OrderItem {
    const details = new Map(REQUIRED_ITEM_FIELDS.map((field) => [field, OrderDetail.missing(field)]));
    return new OrderItem(id, position, details);
  }

  static restore(snapshot: ItemSnapshot): OrderItem {
    const details = new Map(snapshot.details.map((d) => [d.field as ItemField, OrderDetail.restore(d)]));
    return new OrderItem(snapshot.id, snapshot.position, details);
  }

  /** The same item at a new place in the list (after another item is removed). */
  movedTo(position: number): OrderItem {
    return new OrderItem(this.id, position, this.details);
  }

  /** True when the customer has been offered options for one of this item's details. */
  awaitsCustomer(): boolean {
    return this.allDetails().some((detail) => detail.offeredOptions.length > 0);
  }

  detail(field: ItemField): OrderDetail | undefined {
    return this.details.get(field);
  }

  /** Details in display order. */
  allDetails(): OrderDetail[] {
    return ITEM_FIELD_ORDER.flatMap((field) => this.details.get(field) ?? []);
  }

  openDetails(): OrderDetail[] {
    return this.allDetails().filter((detail) => detail.isOpen);
  }

  /** 0 while still missing. */
  quantity(): number {
    return Number(this.details.get(ItemField.Quantity)?.value ?? 0);
  }

  /** $0 while still missing. */
  unitPrice(): Money {
    return this.details.get(ItemField.UnitPrice)?.money ?? Money.zero();
  }

  /** Quantity × unit price. Zero while either is still missing. */
  lineTotal(): Money {
    return this.unitPrice().times(this.quantity());
  }

  /** "Beige linen dress (M)": the product with its colour and size, as PayPal and the pay page show it. */
  name(): string {
    const value = (field: ItemField) => this.details.get(field)?.value ?? null;
    const extras = [value(ItemField.Variant), value(ItemField.Size)].filter((v) => v !== null);
    const product = value(ItemField.Product) ?? "Item";
    return extras.length > 0 ? `${product} (${extras.join(", ")})` : product;
  }

  /** "2 × Beige linen dress (M)" */
  summary(): string {
    return `${this.details.get(ItemField.Quantity)?.value ?? "?"} × ${this.name()}`;
  }

  /** Merges an AI reading into this item. Returns true when any detail changed. */
  applyReading(reading: ItemReading): boolean {
    let changed = false;
    for (const field of ITEM_FIELD_ORDER) {
      const detailReading = reading[field];
      if (detailReading === undefined || detailReading === null) continue;
      changed = this.ensureDetail(field).applyReading(detailReading) || changed;
    }
    return changed;
  }

  snapshot(): ItemSnapshot {
    return { id: this.id, position: this.position, details: this.allDetails().map((d) => d.snapshot()) };
  }

  /** The detail for a field, added as Missing when it isn't on the item yet (a size the seller adds by hand). */
  detailFor(field: ItemField): OrderDetail {
    return this.ensureDetail(field);
  }

  private ensureDetail(field: ItemField): OrderDetail {
    const existing = this.details.get(field);
    if (existing) return existing;
    const created = OrderDetail.missing(field);
    this.details.set(field, created);
    return created;
  }
}

/** The order's items without one, renumbered from 0. The last item can't be removed. */
export function withoutItem(items: readonly OrderItem[], itemId: string) {
  const index = items.findIndex((item) => item.id === itemId);
  const removed = items[index];
  if (!removed) throw new UnknownDetail();
  if (items.length === 1) throw new LastItem();
  const rest = items.filter((item) => item !== removed).map((item, at) => item.movedTo(at));
  return { items: rest, removed, index };
}
