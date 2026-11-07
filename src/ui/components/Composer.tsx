"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { DraftView } from "@/application/queries/orderViews";
import { errorText, newClientId } from "../api";

type Send = (text: string, clientId: string, draftId: string | null) => Promise<void>;

interface Props {
  placeholder: string;
  onSend: Send;
  /** A prepared message waiting to be sent. Remount the Composer (key = draft id) when it changes. */
  draft?: DraftView | null;
}

/** The text box and Send button at the bottom of a phone. Enter sends; Shift+Enter adds a line. */
export function Composer({ placeholder, onSend, draft = null }: Props) {
  const sender = useSender(onSend, draft);
  return (
    <form onSubmit={(event) => void sender.submit(event)} className="border-t border-line bg-card px-3 py-2">
      {sender.error && (
        <p role="alert" className="pb-1 text-[13px] text-missing-fg">
          {sender.error}
        </p>
      )}
      {draft && <DraftLabel draft={draft} />}
      <ComposerField sender={sender} placeholder={placeholder} draft={draft} />
    </form>
  );
}

interface FieldProps {
  sender: ReturnType<typeof useSender>;
  placeholder: string;
  draft: DraftView | null;
}

/** AI blue only for what the AI wrote; fixed-text drafts stay gray. Lists the tap buttons that go with it. */
function DraftLabel({ draft }: { draft: DraftView }) {
  const chip = draft.byAi ? "bg-ai-soft text-ai" : "bg-set-bg text-set-fg";
  return (
    <p className="flex flex-wrap items-center gap-2 pb-1 text-[12px] text-muted">
      <span className={`rounded-full px-2 py-0.5 font-medium ${chip}`}>
        {draft.byAi ? "Draft by AI" : "Draft"}
      </span>
      <span>Edit it or press Send</span>
      {draft.options.length > 0 && <span className="text-ai">Buttons: {draft.options.join(" · ")}</span>}
    </p>
  );
}

/** A dashed outline marks a draft: AI blue when the AI wrote it. */
function borderFor(draft: DraftView | null): string {
  if (!draft) return "border-line";
  return draft.byAi ? "border-dashed border-ai" : "border-dashed border-muted";
}

function ComposerField({ sender, placeholder, draft }: FieldProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) void sender.submit(event);
  };
  const border = borderFor(draft);
  return (
    <div className="flex items-end gap-2">
      <textarea
        value={sender.text}
        onChange={(event) => sender.setText(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={1000}
        rows={Math.min(5, Math.max(1, Math.ceil(sender.text.length / 34)))}
        className={`min-w-0 flex-1 resize-none rounded-[18px] border bg-page px-4 py-2 outline-none focus:border-muted ${border}`}
      />
      <button
        type="submit"
        disabled={sender.sending || !sender.text.trim()}
        className="rounded-full bg-ink px-4 py-2 font-medium text-white disabled:opacity-40"
      >
        Send
      </button>
    </div>
  );
}

/** Keeps one client ID per message until it's sent, so a retry after an error can't send it twice. */
function useSender(onSend: Send, draft: DraftView | null) {
  const [text, setTextState] = useState(draft?.text ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingId = useRef<string | null>(null);

  const setText = (value: string) => {
    pendingId.current = null;
    setTextState(value);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending || !text.trim()) return;
    pendingId.current ??= newClientId();
    setSending(true);
    setError(null);
    try {
      await onSend(text, pendingId.current, draft?.id ?? null);
      setTextState("");
      pendingId.current = null;
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setSending(false);
    }
  };

  return { text, setText, sending, error, submit };
}
