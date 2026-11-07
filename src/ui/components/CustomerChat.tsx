"use client";

import { useState } from "react";
import type { CustomerConversationView } from "@/application/queries/views";
import { MessageDirection, SHOP_NAME } from "@/domain/types";
import { newClientId, postJson } from "../api";
import { usePolling } from "../hooks/usePolling";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";

/** The customer's phone: a plain chat with the shop. */
export function CustomerChat({ initialConversationId }: { initialConversationId: string | null }) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const { data, error, refresh } = usePolling<CustomerConversationView>(
    conversationId ? `/api/customer/conversations/${conversationId}` : null,
  );

  /** `option`: the customer tapped one of the shop's buttons (the text is that option). */
  const send = async (text: string, clientId: string, option = false) => {
    const body = { conversationId, clientId, text, option };
    const sent = await postJson<{ conversationId: string }>("/api/customer/messages", body);
    setConversationId(sent.conversationId);
    refresh();
  };

  return (
    <div className="flex h-full flex-col">
      <CustomerHeader name={data?.customerName ?? null} onNewCustomer={() => setConversationId(null)} />
      <MessageList
        messages={data?.messages ?? []}
        mine={MessageDirection.In}
        empty={conversationId ? "" : `You're a new customer. Say hi to ${SHOP_NAME}.`}
        onOption={(option) => void send(option, newClientId(), true).catch(() => undefined)}
      />
      {error && <p className="bg-missing-row px-3 py-1 text-[13px] text-missing-fg">{error}</p>}
      <Composer placeholder={`Message ${SHOP_NAME}`} onSend={(text, clientId) => send(text, clientId)} />
    </div>
  );
}

function CustomerHeader({ name, onNewCustomer }: { name: string | null; onNewCustomer: () => void }) {
  return (
    <header className="flex items-center gap-3 border-b border-line bg-card px-4 pt-6 pb-3">
      <span
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-semibold text-white"
      >
        L
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{SHOP_NAME}</p>
        <p className="truncate text-[13px] text-muted">{name ? `You're ${name}` : "New customer"}</p>
      </div>
      <button
        type="button"
        onClick={onNewCustomer}
        className="rounded-full border border-line px-3 py-1 text-[13px] font-medium hover:bg-page"
      >
        New customer
      </button>
    </header>
  );
}
