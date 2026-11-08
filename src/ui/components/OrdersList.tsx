"use client";

import type { OrderListRow } from "@/application/queries/ListOrders";
import { OrderStatus } from "@/domain/types";
import { formatDate } from "../api";
import { usePolling } from "../hooks/usePolling";
import { StatusBadge } from "./order/StatusBadge";

/** The Orders tab: one row per order, newest first. Tapping a row opens its conversation and card. */
export function OrdersList({ onOpen }: { onOpen: (conversationId: string) => void }) {
  const { data, error } = usePolling<OrderListRow[]>("/api/orders");
  const rows = data ?? [];
  return (
    <div className="flex-1 overflow-y-auto">
      {error && <p className="bg-missing-row px-4 py-2 text-[13px] text-missing-fg">{error}</p>}
      {data && rows.length === 0 && <p className="px-6 py-16 text-center text-muted">No orders yet.</p>}
      <ul>
        {rows.map((row) => (
          <li key={row.orderId} className="border-b border-line">
            <OrderRowButton row={row} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function OrderRowButton({ row, onOpen }: { row: OrderListRow; onOpen: (conversationId: string) => void }) {
  const cancelled = row.status === OrderStatus.Cancelled;
  return (
    <button
      type="button"
      onClick={() => onOpen(row.conversationId)}
      className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-page"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold">
          #{row.number} · {row.customerName}
        </span>
        <StatusBadge label={row.statusLabel} />
      </span>
      <span className="truncate text-[14px] text-muted">{row.items}</span>
      <span className="flex justify-between gap-2 text-[13px]">
        <span className={cancelled ? "text-muted line-through" : "font-medium"}>{row.total}</span>
        <span className="truncate text-muted">
          {row.payer ? `Paid by ${row.payer} · ` : ""}
          {formatDate(row.date)}
        </span>
      </span>
    </button>
  );
}
