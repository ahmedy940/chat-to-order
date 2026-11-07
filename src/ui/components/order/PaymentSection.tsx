"use client";

import { useState } from "react";
import type { OrderView, PaymentView } from "@/application/queries/orderViews";

/** The Payment part of the order card: the pay link, then who paid and the PayPal references. */
export function PaymentSection({ order, payment }: { order: OrderView; payment: PaymentView }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line px-3 py-3">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">Payment</h3>
      {order.amountMismatch && (
        <p className="rounded-md bg-missing-bg px-2 py-1 text-[13px] text-missing-fg">
          Payment amount mismatch, check PayPal.
        </p>
      )}
      {payment.payUrl && <PayLinkRow url={payment.payUrl} />}
      <Field label="Paid by" value={payment.payerName} />
      <Field label="Email" value={payment.payerEmail} />
      <Field
        label="Ship to"
        value={[payment.shipName, payment.shipAddress].filter(Boolean).join(", ") || null}
      />
      <Field label="PayPal order" value={payment.paypalOrderId} mono />
      <Field label="Transaction ID" value={payment.captureId} mono />
      <Field label="Refund ID" value={payment.refundId} mono />
      {payment.clearing && (
        <p className="rounded-md bg-awaiting-bg px-2 py-1 text-[13px] text-awaiting-fg">
          PayPal is still clearing this payment (paid from a bank account).
        </p>
      )}
    </section>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <span className="text-[12px] text-muted">{label}</span>
      <span className={`break-words ${mono ? "font-mono text-[13px]" : ""}`}>{value}</span>
    </div>
  );
}

function PayLinkRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 truncate text-[13px] underline"
      >
        {url}
      </a>
      <button
        type="button"
        onClick={() => void copy()}
        className="rounded-md border border-line px-2 py-0.5 text-[13px]"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
