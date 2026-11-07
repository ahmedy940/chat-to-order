"use client";

import { useState } from "react";
import type { OrderView } from "@/application/queries/orderViews";
import { errorText, postJson } from "../../api";
import { StatusBadge } from "./StatusBadge";

interface Props {
  conversationId: string;
  order: OrderView | null;
  onOpen: () => void;
  onStarted: () => void;
}

/** The bar on top of a conversation: the order at a glance ("#1001 · $128.00 · Awaiting payment"), or Start order. */
export function OrderBar({ conversationId, order, onOpen, onStarted }: Props) {
  if (order) return <OrderSummaryButton order={order} onOpen={onOpen} />;
  return <StartOrderRow conversationId={conversationId} onStarted={onStarted} />;
}

function OrderSummaryButton({ order, onOpen }: { order: OrderView; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-2 border-b border-line bg-card px-3 py-2 text-left hover:bg-page"
    >
      <span className="flex-1 font-medium">
        #{order.number} · {order.total}
      </span>
      <StatusBadge label={order.statusLabel} />
      <span className="text-[13px] text-muted">Open ›</span>
    </button>
  );
}

function StartOrderRow({ conversationId, onStarted }: Pick<Props, "conversationId" | "onStarted">) {
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    try {
      await postJson(`/api/conversations/${conversationId}/order`, {});
      onStarted();
    } catch (failure) {
      setError(errorText(failure));
    }
  };
  return (
    <div className="flex items-center gap-2 border-b border-line bg-card px-3 py-2">
      <span className="flex-1 text-[13px] text-muted">{error ?? "No order yet."}</span>
      <button
        type="button"
        onClick={() => void start()}
        className="rounded-full border border-line px-3 py-1 text-[14px] font-medium hover:bg-page"
      >
        Start order
      </button>
    </div>
  );
}
