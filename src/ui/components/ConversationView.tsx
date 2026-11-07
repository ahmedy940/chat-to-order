"use client";

import type { SellerConversationView } from "@/application/queries/views";
import { MessageDirection } from "@/domain/types";
import { postJson } from "../api";
import { usePolling } from "../hooks/usePolling";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";

interface Props {
  conversationId: string;
  onBack: () => void;
}

/** One customer's chat, as the seller sees it. Later steps add the order bar, the draft and the agent card. */
export function ConversationView({ conversationId, onBack }: Props) {
  const { data, error, refresh } = usePolling<SellerConversationView>(`/api/conversations/${conversationId}`);

  const send = async (text: string, clientId: string) => {
    await postJson(`/api/conversations/${conversationId}/send`, { clientId, text });
    refresh();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line bg-card px-2 py-2">
        <button type="button" onClick={onBack} className="rounded-full px-2 py-1 text-[14px] hover:bg-page">
          ‹ Inbox
        </button>
        <p className="truncate font-semibold">{data?.customerName ?? ""}</p>
      </div>
      <MessageList messages={data?.messages ?? []} mine={MessageDirection.Out} empty="" />
      {error && <p className="bg-missing-row px-3 py-1 text-[13px] text-missing-fg">{error}</p>}
      <Composer placeholder="Reply to the customer" onSend={send} />
    </div>
  );
}
