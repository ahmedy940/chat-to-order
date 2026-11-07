"use client";

import type { InboxRow } from "@/application/queries/views";
import { MessageDirection } from "@/domain/types";
import { formatTime } from "../api";
import { usePolling } from "../hooks/usePolling";
import { StatusBadge } from "./order/StatusBadge";

/** The seller's list of customers, most recent first. */
export function Inbox({ onOpen }: { onOpen: (conversationId: string) => void }) {
  const { data, error } = usePolling<InboxRow[]>("/api/inbox");
  const rows = data ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      {error && <p className="bg-missing-row px-4 py-2 text-[13px] text-missing-fg">{error}</p>}
      {data && rows.length === 0 && (
        <p className="px-6 py-16 text-center text-muted">
          No messages yet. Type as the customer on the left.
        </p>
      )}
      <ul>
        {rows.map((row) => (
          <li key={row.conversationId} className="border-b border-line">
            <InboxRowButton row={row} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function InboxRowButton({ row, onOpen }: { row: InboxRow; onOpen: (id: string) => void }) {
  const last = row.lastMessage;
  const preview = last ? `${last.direction === MessageDirection.Out ? "You: " : ""}${last.text}` : "";
  return (
    <button
      type="button"
      onClick={() => onOpen(row.conversationId)}
      className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-page"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate font-semibold">{row.customerName}</span>
        {last && <span className="shrink-0 text-[12px] text-muted">{formatTime(last.at)}</span>}
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-[14px] text-muted">{preview}</span>
        <StatusBadge label={row.status} />
      </span>
    </button>
  );
}
