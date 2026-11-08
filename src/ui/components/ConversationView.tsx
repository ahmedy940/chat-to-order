"use client";

import { useState } from "react";
import type { SellerConversationView } from "@/application/queries/views";
import { MessageDirection } from "@/domain/types";
import { postJson } from "../api";
import { usePolling } from "../hooks/usePolling";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { OrderBar } from "./order/OrderBar";
import { OrderSheet } from "./order/OrderSheet";
import { ProposalCard } from "./ProposalCard";

interface Props {
  conversationId: string;
  onBack: () => void;
  /** Show the order card straight away (opened from the Orders tab). */
  openCard?: boolean;
  /** Where the back button goes: "Inbox" or "Orders". */
  backLabel?: string;
}

/** One customer's chat, as the seller sees it: the order bar, the messages, the order card and the reply box. */
export function ConversationView({ conversationId, onBack, openCard = false, backLabel = "Inbox" }: Props) {
  const { data, error, refresh } = usePolling<SellerConversationView>(`/api/conversations/${conversationId}`);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line bg-card px-2 py-2">
        <button type="button" onClick={onBack} className="rounded-full px-2 py-1 text-[14px] hover:bg-page">
          ‹ {backLabel}
        </button>
        <p className="truncate font-semibold">{data?.customerName ?? ""}</p>
      </div>
      {data ? (
        <ConversationBody data={data} error={error} refresh={refresh} openCard={openCard} />
      ) : (
        <p className="m-auto px-6 text-center text-muted">{error ?? "Loading…"}</p>
      )}
    </div>
  );
}

interface BodyProps {
  data: SellerConversationView;
  error: string | null;
  refresh: () => void;
  openCard?: boolean;
}

/** Sends the reply (or the draft), then reloads so a refused stale draft is replaced at once. */
function sender(conversationId: string, refresh: () => void) {
  return async (text: string, clientId: string, draftId: string | null) => {
    try {
      await postJson(`/api/conversations/${conversationId}/send`, { clientId, text, draftId });
    } finally {
      refresh();
    }
  };
}

function ConversationBody({ data, error, refresh, openCard = false }: BodyProps) {
  const [sheetOpen, setSheetOpen] = useState(openCard);
  const started = () => {
    refresh();
    setSheetOpen(true);
  };
  return (
    <>
      <OrderBar
        conversationId={data.conversationId}
        order={data.order}
        readAction={data.readAction}
        onOpen={() => setSheetOpen(true)}
        onStarted={started}
      />
      <MessageList messages={data.messages} mine={MessageDirection.Out} empty="" />
      {error && <p className="bg-missing-row px-3 py-1 text-[13px] text-missing-fg">{error}</p>}
      <ReplyArea data={data} refresh={refresh} />
      {sheetOpen && data.order && (
        <OrderSheet order={data.order} onClose={() => setSheetOpen(false)} onChanged={refresh} />
      )}
    </>
  );
}

/** The agent's suggestion (if any), then the reply box with the draft (if any). */
function ReplyArea({ data, refresh }: Pick<BodyProps, "data" | "refresh">) {
  return (
    <>
      {data.proposal && <ProposalCard key={data.proposal.id} proposal={data.proposal} onDone={refresh} />}
      <Composer
        key={data.draft?.id ?? "typed"}
        placeholder="Reply to the customer"
        onSend={sender(data.conversationId, refresh)}
        draft={data.draft}
      />
    </>
  );
}
