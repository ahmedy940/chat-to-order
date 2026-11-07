"use client";

import { useState } from "react";
import { SHOP_NAME } from "@/domain/types";
import { ConversationView } from "./ConversationView";
import { Inbox } from "./Inbox";

/** The seller's phone: the Inbox, or one open conversation. (The Orders tab arrives in step 7.) */
export function SellerApp() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-card px-4 pt-6 pb-3">
        <p className="text-[13px] text-muted">{SHOP_NAME} · Seller</p>
        {!openId && <p className="text-lg font-semibold">Inbox</p>}
      </header>
      {openId ? (
        <ConversationView conversationId={openId} onBack={() => setOpenId(null)} />
      ) : (
        <Inbox onOpen={setOpenId} />
      )}
    </div>
  );
}
