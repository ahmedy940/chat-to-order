"use client";

import { useState, type ReactNode } from "react";
import type { PayPageState, PayPageView } from "@/application/queries/GetPayPage";
import { PayPalCheckout } from "./PayPalCheckout";

interface Props {
  payToken: string;
  view: PayPageView | null;
  clientId: string;
}

const CLOSED_STATES: Record<Exclude<PayPageState, "awaiting">, string> = {
  paid: "This order is already paid.",
  refunded: "This order was refunded.",
  checking: "We've received your payment and the shop is checking it. No need to pay again.",
  cancelled: "This order was cancelled by the shop.",
};

/** The customer's pay page: the frozen order exactly as on the seller's card, and PayPal's button. */
export function PayPage({ payToken, view, clientId }: Props) {
  const [justPaid, setJustPaid] = useState(false);
  if (!view) return <Card>This pay link isn&apos;t valid. Ask the shop for a new one.</Card>;
  return (
    <Card>
      <p className="text-[13px] text-muted">{view.shopName}</p>
      <h1 className="text-xl font-semibold">Order #{view.orderNumber}</h1>
      <OrderLines view={view} />
      {justPaid ? (
        <Notice tone="paid" title="Paid. Thank you!">
          Order #{view.orderNumber} is paid. You can close this page.
        </Notice>
      ) : view.state === "awaiting" ? (
        <div className="flex flex-col gap-3">
          <PayPalCheckout payToken={payToken} clientId={clientId} onPaid={() => setJustPaid(true)} />
          <p className="text-center text-[13px] text-muted">
            Your name and delivery address come from your PayPal account.
          </p>
        </div>
      ) : (
        <Notice tone={view.state === "paid" ? "paid" : "closed"} title={CLOSED_STATES[view.state]} />
      )}
      <p className="text-center text-[12px] text-muted">PayPal sandbox: no real money moves.</p>
    </Card>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen justify-center px-4 py-10">
      <section className="flex h-fit w-full max-w-[420px] flex-col gap-4 rounded-card border border-line bg-card p-6">
        {children}
      </section>
    </main>
  );
}

function OrderLines({ view }: { view: PayPageView }) {
  return (
    <div className="flex flex-col gap-2 border-y border-line py-3">
      {view.lines.map((line, index) => (
        <p key={index} className="flex justify-between gap-3">
          <span>
            {line.quantity} × {line.name}
            <span className="block text-[13px] text-muted">{line.unitPrice} each</span>
          </span>
          <span>{line.lineTotal}</span>
        </p>
      ))}
      <p className="flex justify-between text-muted">
        <span>Delivery</span>
        <span>{view.deliveryFee}</span>
      </p>
      <p className="flex justify-between text-lg font-semibold">
        <span>Total (USD)</span>
        <span>{view.total}</span>
      </p>
    </div>
  );
}

function Notice({ tone, title, children }: { tone: "paid" | "closed"; title: string; children?: ReactNode }) {
  const colours = tone === "paid" ? "bg-found-bg text-found-fg" : "bg-set-bg text-set-fg";
  return (
    <div className={`rounded-card px-4 py-3 ${colours}`}>
      <p className="font-semibold">{title}</p>
      {children && <p className="text-[14px]">{children}</p>}
    </div>
  );
}
