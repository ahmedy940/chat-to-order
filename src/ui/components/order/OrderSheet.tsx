"use client";

import { useState } from "react";
import type { DetailView, ItemView, OrderView } from "@/application/queries/orderViews";
import { OrderStatus } from "@/domain/types";
import { errorText, patchJson, postJson } from "../../api";
import { DetailRow } from "./DetailRow";
import { OrderActions } from "./OrderActions";
import { OrderTimeline } from "./OrderTimeline";
import { PaymentSection } from "./PaymentSection";
import { StatusBadge } from "./StatusBadge";

interface Props {
  order: OrderView;
  onClose: () => void;
  /** Reload the conversation after a change. */
  onChanged: () => void;
}

type Save = (detail: DetailView) => (value: string) => Promise<void>;

/** The order card, as a sheet over the conversation: what's sold, the total, payment, and the timeline. */
export function OrderSheet({ order, onClose, onChanged }: Props) {
  const save: Save = (detail) => async (value) => {
    await patchJson(`/api/orders/${order.id}/details`, { itemId: detail.itemId, field: detail.field, value });
    onChanged();
  };
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-ink/30">
      <div className="mt-auto flex max-h-[90%] flex-col overflow-y-auto rounded-t-[20px] bg-card pb-4">
        <SheetHeader order={order} onClose={onClose} />
        {order.items.map((item, index) => (
          <ItemSection key={item.id} item={item} index={index} editable={order.editable} save={save} />
        ))}
        <AddItemButton order={order} onChanged={onChanged} />
        <DetailRow detail={order.deliveryFee} editable={order.editable} onSave={save(order.deliveryFee)} />
        <TotalAndRequest order={order} onChanged={onChanged} />
        <OrderActions order={order} onChanged={onChanged} />
        {order.payment && <PaymentSection order={order} payment={order.payment} />}
        <OrderTimeline order={order} />
      </div>
    </div>
  );
}

function SheetHeader({ order, onClose }: Pick<Props, "order" | "onClose">) {
  return (
    <header className="sticky top-0 flex items-center gap-2 border-b border-line bg-card px-3 py-3">
      <h2 className="flex-1 font-semibold">Order #{order.number}</h2>
      <StatusBadge label={order.statusLabel} />
      <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-[14px] hover:bg-page">
        Close
      </button>
    </header>
  );
}

interface ItemProps {
  item: ItemView;
  index: number;
  editable: boolean;
  save: Save;
}

function ItemSection({ item, index, editable, save }: ItemProps) {
  return (
    <section className="border-b border-line">
      <p className="flex justify-between px-3 pt-2 text-[13px] font-semibold text-muted">
        <span>Item {index + 1}</span>
        <span>{item.lineTotal}</span>
      </p>
      {item.details.map((detail) => (
        <DetailRow key={detail.field} detail={detail} editable={editable} onSave={save(detail)} />
      ))}
    </section>
  );
}

function AddItemButton({ order, onChanged }: Pick<Props, "order" | "onChanged">) {
  if (!order.editable) return null;
  const add = async () => {
    await postJson(`/api/orders/${order.id}/items`, {});
    onChanged();
  };
  return (
    <button type="button" onClick={() => void add()} className="px-3 py-2 text-left text-[14px] underline">
      + Add item
    </button>
  );
}

function TotalAndRequest({ order, onChanged }: Pick<Props, "order" | "onChanged">) {
  return (
    <section className="flex flex-col gap-2 border-t border-line px-3 py-3">
      <p className="flex justify-between text-lg font-semibold">
        <span>Total</span>
        <span className={order.status === OrderStatus.Cancelled ? "text-muted line-through" : ""}>
          {order.total}
        </span>
      </p>
      {order.editable && <RequestPaymentButton order={order} onChanged={onChanged} />}
    </section>
  );
}

/** Enabled only when nothing is missing; otherwise it says what's left to settle. */
function RequestPaymentButton({ order, onChanged }: Pick<Props, "order" | "onChanged">) {
  const [error, setError] = useState<string | null>(null);
  const request = async () => {
    try {
      await postJson(`/api/orders/${order.id}/request-payment`, {});
      onChanged();
    } catch (failure) {
      setError(errorText(failure));
    }
  };
  return (
    <>
      <button
        type="button"
        disabled={order.paymentBlocker !== null}
        onClick={() => void request()}
        className="rounded-full bg-ink px-4 py-2 font-medium text-white disabled:opacity-40"
      >
        Request payment
      </button>
      {order.paymentBlocker && <p className="text-[13px] text-muted">{order.paymentBlocker}</p>}
      {error && <p className="text-[13px] text-missing-fg">{error}</p>}
    </>
  );
}
