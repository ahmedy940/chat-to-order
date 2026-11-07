"use client";

import type { OrderView } from "@/application/queries/orderViews";
import type { SellerConversationView } from "@/application/queries/views";
import { useAction } from "../../hooks/useAction";
import { StatusBadge } from "./StatusBadge";

interface Props {
  conversationId: string;
  order: OrderView | null;
  readAction: SellerConversationView["readAction"];
  onOpen: () => void;
  /** After Read order or Start order: reload and open the card. */
  onStarted: () => void;
}

/**
 * The bar on top of a conversation: the order at a glance ("#1001 · $128.00 · Awaiting payment"), plus
 * Read order (or Read again after new messages) and, before any order, Start order to type it by hand.
 */
export function OrderBar({ conversationId, order, readAction, onOpen, onStarted }: Props) {
  const showActions = readAction !== null || !order;
  return (
    <div className="border-b border-line bg-card">
      {order && <OrderSummaryButton order={order} onOpen={onOpen} />}
      {showActions && (
        <BarActions
          conversationId={conversationId}
          hasOrder={order !== null}
          readAction={readAction}
          onStarted={onStarted}
        />
      )}
    </div>
  );
}

interface ActionsProps {
  conversationId: string;
  hasOrder: boolean;
  readAction: SellerConversationView["readAction"];
  onStarted: () => void;
}

function BarActions({ conversationId, hasOrder, readAction, onStarted }: ActionsProps) {
  const reader = useAction(`/api/conversations/${conversationId}/read-order`, onStarted);
  const starter = useAction(`/api/conversations/${conversationId}/order`, onStarted);
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <BarNote busy={reader.busy} error={reader.error ?? starter.error} hasOrder={hasOrder} />
      {readAction && (
        <button
          type="button"
          disabled={reader.busy}
          onClick={reader.run}
          className="rounded-full border border-ai px-3 py-1 text-[14px] font-medium text-ai hover:bg-ai-soft disabled:opacity-50"
        >
          {reader.busy ? "Reading…" : readAction}
        </button>
      )}
      {!hasOrder && (
        <button
          type="button"
          disabled={starter.busy || reader.busy}
          onClick={starter.run}
          className="rounded-full border border-line px-3 py-1 text-[14px] font-medium hover:bg-page disabled:opacity-50"
        >
          Start order
        </button>
      )}
    </div>
  );
}

function BarNote({ busy, error, hasOrder }: { busy: boolean; error: string | null; hasOrder: boolean }) {
  if (busy) return <span className="flex-1 text-[13px] text-ai">Reading the conversation…</span>;
  if (error) return <span className="flex-1 text-[13px] text-missing-fg">{error}</span>;
  const note = hasOrder ? "New messages since the last reading." : "No order yet.";
  return <span className="flex-1 text-[13px] text-muted">{note}</span>;
}

function OrderSummaryButton({ order, onOpen }: { order: OrderView; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-page"
    >
      <span className="flex-1 font-medium">
        #{order.number} · {order.total}
      </span>
      <StatusBadge label={order.statusLabel} />
      <span className="text-[13px] text-muted">Open ›</span>
    </button>
  );
}
