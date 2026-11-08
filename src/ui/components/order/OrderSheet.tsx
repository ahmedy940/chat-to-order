"use client";

import type { ReactNode } from "react";
import type { DetailView, ItemView, OrderView } from "@/application/queries/orderViews";
import { DetailStatus, OrderStatus } from "@/domain/types";
import { deleteJson, errorText, patchJson, postJson } from "../../api";
import { useAction } from "../../hooks/useAction";
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
type Ask = (detail: DetailView) => (options: string[]) => Promise<void>;

/** Typing a value, or offering options to the customer (the AI then rewrites the question in the reply box). */
function detailActions(order: OrderView, onChanged: () => void): { save: Save; ask: Ask } {
  const at = (detail: DetailView) => ({ itemId: detail.itemId, field: detail.field });
  return {
    save: (detail) => async (value) => {
      await patchJson(`/api/orders/${order.id}/details`, { ...at(detail), value });
      onChanged();
    },
    ask: (detail) => async (options) => {
      await postJson(`/api/orders/${order.id}/ask`, { ...at(detail), options });
      onChanged();
    },
  };
}

/** The order card, as a sheet over the conversation: what's sold, the total, payment, and the timeline. */
export function OrderSheet({ order, onClose, onChanged }: Props) {
  const { save, ask } = detailActions(order, onChanged);
  return (
    <SheetFrame onClose={onClose}>
      <SheetHeader order={order} onClose={onClose} />
      {order.items.map((item, index) => (
        <ItemSection
          key={item.id}
          item={item}
          index={index}
          editable={order.editable}
          save={save}
          ask={ask}
          onRemove={order.editable && order.items.length > 1 ? remover(order, item, index, onChanged) : null}
        />
      ))}
      <AddItemButton order={order} onChanged={onChanged} />
      <DetailRow detail={order.deliveryFee} editable={order.editable} onSave={save(order.deliveryFee)} />
      <TotalAndRequest order={order} onChanged={onChanged} />
      <OrderActions order={order} onChanged={onChanged} />
      {order.payment && <PaymentSection order={order} payment={order.payment} />}
      <OrderTimeline order={order} />
    </SheetFrame>
  );
}

/** The dimmed backdrop and the card that slides up from the bottom. Tapping the backdrop closes it. */
function SheetFrame({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-ink/30">
      <button
        type="button"
        aria-label="Close the order card"
        onClick={onClose}
        className="absolute inset-0"
      />
      <div className="relative mt-auto flex max-h-[90%] flex-col overflow-y-auto rounded-t-[20px] bg-card pb-4">
        {children}
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
  ask: Ask;
  /** Null when the item can't be removed: the order is locked or it's the only item. */
  onRemove: (() => Promise<void>) | null;
}

/** Removes an item line. Asks first when the item already has values, so nothing read or typed is lost by a slip. */
function remover(order: OrderView, item: ItemView, index: number, onChanged: () => void) {
  const filled = item.details.some(
    (d) => d.status === DetailStatus.Found || d.status === DetailStatus.SetByYou,
  );
  return async () => {
    if (filled && !window.confirm(`Remove item ${index + 1} from order #${order.number}?`)) return;
    try {
      await deleteJson(`/api/orders/${order.id}/items/${item.id}`);
    } catch (error) {
      window.alert(errorText(error));
    }
    onChanged();
  };
}

function ItemSection({ item, index, editable, save, ask, onRemove }: ItemProps) {
  return (
    <section className="border-b border-line">
      <p className="flex items-center gap-2 px-3 pt-2 text-[13px] font-semibold text-muted">
        <span className="flex-1">Item {index + 1}</span>
        {onRemove && (
          <button
            type="button"
            onClick={() => void onRemove()}
            className="rounded-full px-2 py-0.5 font-normal underline hover:bg-page hover:text-ink"
          >
            Remove
          </button>
        )}
        <span>{item.lineTotal}</span>
      </p>
      {item.details.map((detail) => (
        <DetailRow
          key={detail.field}
          detail={detail}
          editable={editable}
          onSave={save(detail)}
          onAsk={ask(detail)}
        />
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
  // Takes a moment: the AI writes the payment message's opening line first.
  const { busy, error, run } = useAction(`/api/orders/${order.id}/request-payment`, onChanged);
  return (
    <>
      <button
        type="button"
        disabled={order.paymentBlocker !== null || busy}
        onClick={run}
        className="rounded-full bg-ink px-4 py-2 font-medium text-white disabled:opacity-40"
      >
        {busy ? "Preparing the payment message…" : "Request payment"}
      </button>
      {order.paymentBlocker && <p className="text-[13px] text-muted">{order.paymentBlocker}</p>}
      {error && <p className="text-[13px] text-missing-fg">{error}</p>}
    </>
  );
}
