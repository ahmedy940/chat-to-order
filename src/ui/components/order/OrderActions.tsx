"use client";

import { useState } from "react";
import type { OrderView } from "@/application/queries/orderViews";
import { errorText, postJson } from "../../api";

interface Props {
  order: OrderView;
  onChanged: () => void;
}

/** Refund (paid orders) or Cancel order (before payment). Both ask first: neither can be undone. */
export function OrderActions({ order, onChanged }: Props) {
  if (order.canRefund) {
    const payer = order.payment?.payerName ?? "the customer";
    return (
      <ConfirmAction
        label="Refund"
        question={`Refund ${order.total} to ${payer}? This can't be undone.`}
        confirmLabel="Yes, refund"
        url={`/api/orders/${order.id}/refund`}
        onDone={onChanged}
      />
    );
  }
  if (!order.canCancel) return null;
  return (
    <ConfirmAction
      label="Cancel order"
      question={`Cancel order #${order.number}? Its pay link will stop taking payment.`}
      confirmLabel="Yes, cancel it"
      url={`/api/orders/${order.id}/cancel`}
      onDone={onChanged}
    />
  );
}

interface ConfirmProps {
  label: string;
  question: string;
  confirmLabel: string;
  url: string;
  onDone: () => void;
}

/** A button that asks before it acts, then shows PayPal's reason if it was refused. */
function ConfirmAction({ label, question, confirmLabel, url, onDone }: ConfirmProps) {
  const [asking, setAsking] = useState(false);
  const { busy, error, run } = useAction(url, () => {
    setAsking(false);
    onDone();
  });
  return (
    <section className="flex flex-col gap-2 border-t border-line px-3 py-3">
      {asking ? (
        <ConfirmBox
          question={question}
          confirmLabel={confirmLabel}
          busy={busy}
          onYes={run}
          onNo={() => setAsking(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="rounded-full border border-line px-4 py-2 font-medium hover:bg-page"
        >
          {label}
        </button>
      )}
      {error && <p className="text-[13px] text-missing-fg">{error}</p>}
    </section>
  );
}

interface BoxProps {
  question: string;
  confirmLabel: string;
  busy: boolean;
  onYes: () => void;
  onNo: () => void;
}

function ConfirmBox({ question, confirmLabel, busy, onYes, onNo }: BoxProps) {
  return (
    <div className="flex flex-col gap-2 rounded-card bg-missing-row p-3">
      <p className="text-[14px] font-medium">{question}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onYes}
          className="rounded-full bg-ink px-4 py-1.5 text-[14px] font-medium text-white disabled:opacity-40"
        >
          {busy ? "Working…" : confirmLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onNo}
          className="rounded-full px-3 py-1.5 text-[14px] text-muted"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}

/** Posts once (the button is disabled while it runs) and keeps the server's reason on failure. */
function useAction(url: string, onSuccess: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = () => {
    setBusy(true);
    setError(null);
    postJson(url, {})
      .then(onSuccess)
      .catch((failure: unknown) => setError(errorText(failure)))
      .finally(() => setBusy(false));
  };
  return { busy, error, run };
}
