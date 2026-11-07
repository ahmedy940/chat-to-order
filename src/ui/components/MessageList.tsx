"use client";

import { useEffect, useRef } from "react";
import type { MessageView } from "@/application/queries/views";
import { MessageDirection } from "@/domain/types";
import { formatTime } from "../api";

interface Props {
  messages: MessageView[];
  /** Whose phone this is: their own bubbles sit on the right. */
  mine: MessageDirection;
  empty: string;
  /** The customer phone: tapping an offered option sends it as the reply. */
  onOption?: (option: string) => void;
}

/** The chat bubbles. Customer bubbles are white with a border; the shop's are dark with white text. */
export function MessageList({ messages, mine, empty, onOption }: Props) {
  const list = useRef<HTMLDivElement>(null);
  // Keep the newest message in view. Scrolls only this list, never the whole page.
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages.length]);
  const last = messages.at(-1);
  // Options are tappable only while the shop's question is the latest message.
  const tappable =
    onOption && last?.direction === MessageDirection.Out && last.options.length > 0 ? last : null;

  return (
    <div ref={list} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-page px-3 py-4">
      {messages.length === 0 && <p className="m-auto max-w-[260px] text-center text-muted">{empty}</p>}
      {messages.map((message) => (
        <Bubble key={message.id} message={message} isMine={message.direction === mine} />
      ))}
      {tappable && onOption && <OptionButtons options={tappable.options} onOption={onOption} />}
    </div>
  );
}

/** The options the shop offered, as buttons under its question. */
function OptionButtons({ options, onOption }: { options: string[]; onOption: (option: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 self-start">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onOption(option)}
          className="rounded-full border border-ink bg-card px-4 py-1.5 text-[14px] font-medium hover:bg-page"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function Bubble({ message, isMine }: { message: MessageView; isMine: boolean }) {
  const fromShop = message.direction === MessageDirection.Out;
  const colours = fromShop ? "bg-ink text-white" : "border border-line bg-card text-ink";
  return (
    <div className={`flex max-w-[78%] flex-col ${isMine ? "items-end self-end" : "items-start self-start"}`}>
      {/* wrap-anywhere: long links break inside the bubble instead of pushing it past the phone's edge */}
      <p className={`max-w-full rounded-bubble px-3 py-2 whitespace-pre-wrap wrap-anywhere ${colours}`}>
        {message.text}
      </p>
      {message.payLink && <PayLinkCard url={message.payLink.url} label={message.payLink.label} />}
      <time dateTime={message.at} className="mt-0.5 px-1 text-[11px] text-muted">
        {formatTime(message.at)}
      </time>
    </div>
  );
}

/** A payment message's link card: "Order #1001 · $128.00 · Pay with PayPal". Opens the pay page in a new tab. */
function PayLinkCard({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex w-60 max-w-full flex-col rounded-card border border-line bg-card px-3 py-2 text-ink hover:bg-page"
    >
      <span className="text-[13px] text-muted">{label}</span>
      <span className="font-semibold">Pay with PayPal ›</span>
    </a>
  );
}
