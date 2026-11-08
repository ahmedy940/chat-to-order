"use client";

import { useState } from "react";
import { SHOP_NAME } from "@/domain/types";
import { ConversationView } from "./ConversationView";
import { Inbox } from "./Inbox";
import { OrdersList } from "./OrdersList";

type Tab = "inbox" | "orders";

interface Opened {
  conversationId: string;
  /** Opened from the Orders tab: show the order card straight away. */
  openCard: boolean;
}

/** The seller's phone: the Inbox and Orders tabs, or one open conversation. */
export function SellerApp() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [opened, setOpened] = useState<Opened | null>(null);
  const open = (openCard: boolean) => (conversationId: string) => setOpened({ conversationId, openCard });
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-card px-4 pt-6 pb-2">
        <p className="text-[13px] text-muted">{SHOP_NAME} · Seller</p>
        {!opened && <Tabs tab={tab} onChange={setTab} />}
      </header>
      {opened && (
        <ConversationView
          key={opened.conversationId}
          conversationId={opened.conversationId}
          openCard={opened.openCard}
          backLabel={opened.openCard ? "Orders" : "Inbox"}
          onBack={() => setOpened(null)}
        />
      )}
      {!opened && tab === "inbox" && <Inbox onOpen={open(false)} />}
      {!opened && tab === "orders" && <OrdersList onOpen={open(true)} />}
    </div>
  );
}

function Tabs({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const item = (value: Tab, label: string) => (
    <button
      type="button"
      aria-pressed={tab === value}
      onClick={() => onChange(value)}
      className={`border-b-2 pb-1 text-lg font-semibold ${tab === value ? "border-ink" : "border-transparent text-muted"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="mt-1 flex gap-5">
      {item("inbox", "Inbox")}
      {item("orders", "Orders")}
    </div>
  );
}
