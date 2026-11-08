"use client";

import { useState, type ReactNode } from "react";
import { SHOP_NAME } from "@/domain/types";
import { errorText, postJson } from "../api";
import { CustomerChat } from "./CustomerChat";
import { PhoneFrame } from "./PhoneFrame";
import { SellerApp } from "./SellerApp";

type Side = "customer" | "seller";

const SELLER_LABEL = `${SHOP_NAME} — Seller`;

/** Two phones side by side on a laptop; below 1024px, one phone at a time with a switch on top. */
export function DemoPage({ initialConversationId }: { initialConversationId: string | null }) {
  const [side, setSide] = useState<Side>("customer");

  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col items-center gap-4 px-4 py-6">
      <p className="text-center text-[15px]">
        Type an order as the customer, then run the shop{" "}
        <span className="hidden lg:inline">on the right.</span>
        <span className="lg:hidden">from the Seller phone.</span>
        {" · "}
        <ResetDemoLink />
      </p>
      <PhoneSwitch side={side} onChange={setSide} />
      <div className="flex w-full justify-center gap-12">
        <PhoneSlot label="Customer" shown={side === "customer"}>
          <CustomerChat initialConversationId={initialConversationId} />
        </PhoneSlot>
        <PhoneSlot label={SELLER_LABEL} shown={side === "seller"}>
          <SellerApp />
        </PhoneSlot>
      </div>
      <div className="max-w-[560px] space-y-1 text-center text-[13px] text-muted">
        <p>Payments use PayPal&apos;s sandbox. No real money.</p>
        <p>To pay, log in as the sandbox buyer from the testing notes and pay with the saved card.</p>
      </div>
    </main>
  );
}

/** Clears every chat and order and starts again at #1001, after a confirm. */
function ResetDemoLink() {
  const [busy, setBusy] = useState(false);
  const reset = async () => {
    if (!window.confirm("Clear all chats and orders and start again at #1001?")) return;
    setBusy(true);
    try {
      await postJson("/api/demo/reset", {});
      window.location.reload();
    } catch (error) {
      setBusy(false);
      window.alert(errorText(error));
    }
  };
  return (
    <button
      type="button"
      onClick={() => void reset()}
      disabled={busy}
      className="text-muted underline hover:text-ink"
    >
      {busy ? "Resetting…" : "Reset demo"}
    </button>
  );
}

function PhoneSlot({ label, shown, children }: { label: string; shown: boolean; children: ReactNode }) {
  return (
    <div className={`${shown ? "flex" : "hidden"} w-full max-w-[390px] flex-col items-center gap-2 lg:flex`}>
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <PhoneFrame label={label}>{children}</PhoneFrame>
    </div>
  );
}

function PhoneSwitch({ side, onChange }: { side: Side; onChange: (side: Side) => void }) {
  const options: [Side, string][] = [
    ["customer", "Customer"],
    ["seller", "Seller"],
  ];
  return (
    <div
      role="group"
      aria-label="Show phone"
      className="flex rounded-full border border-line bg-card p-1 lg:hidden"
    >
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={side === value}
          onClick={() => onChange(value)}
          className={`rounded-full px-4 py-1.5 text-[14px] font-medium ${side === value ? "bg-ink text-white" : "text-muted"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
