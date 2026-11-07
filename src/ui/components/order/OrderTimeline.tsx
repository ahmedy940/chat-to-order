import type { OrderView, TimelineLine } from "@/application/queries/orderViews";
import { formatTime } from "../../api";

/** Every step of the order, who did it and when; money lines with amounts; and the balance. */
export function OrderTimeline({ order }: { order: OrderView }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line px-3 py-3">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Timeline</h3>
      {order.timeline.length === 0 && <p className="text-[13px] text-muted">Nothing has happened yet.</p>}
      <ol className="flex flex-col gap-2">
        {order.timeline.map((line) => (
          <TimelineRow key={line.seq} line={line} />
        ))}
      </ol>
      <div className="flex justify-between border-t border-line pt-2 font-semibold">
        <span>Balance</span>
        <span>{order.balance}</span>
      </div>
    </section>
  );
}

function TimelineRow({ line }: { line: TimelineLine }) {
  const isRefund = line.amount?.startsWith("−") ?? false;
  return (
    <li className="flex flex-col text-[14px]">
      <div className="flex justify-between gap-2">
        <span>{line.summary}</span>
        {line.amount && (
          <span className={`shrink-0 font-semibold ${isRefund ? "text-ink" : "text-found-fg"}`}>
            {line.amount}
          </span>
        )}
      </div>
      <span className="text-[12px] text-muted">
        {line.actor} · {formatTime(line.at)}
        {line.fee && line.net ? ` · PayPal fee ${line.fee}, you receive ${line.net}` : ""}
      </span>
      {line.quote && <span className="text-[12px] text-muted">“{line.quote}”</span>}
    </li>
  );
}
