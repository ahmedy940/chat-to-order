"use client";

import { useRef, useState, type FormEvent } from "react";
import { newClientId } from "../api";

type Send = (text: string, clientId: string) => Promise<void>;

interface Props {
  placeholder: string;
  onSend: Send;
}

/** The text box and Send button at the bottom of a phone. */
export function Composer({ placeholder, onSend }: Props) {
  const { text, setText, sending, error, submit } = useSender(onSend);
  return (
    <form onSubmit={(event) => void submit(event)} className="border-t border-line bg-card px-3 py-2">
      {error && (
        <p role="alert" className="pb-1 text-[13px] text-missing-fg">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={1000}
          className="min-w-0 flex-1 rounded-full border border-line bg-page px-4 py-2 outline-none focus:border-muted"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="rounded-full bg-ink px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </form>
  );
}

/** Keeps one client ID per message until it's sent, so a retry after an error can't send it twice. */
function useSender(onSend: Send) {
  const [text, setTextState] = useState("");
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
      await onSend(text, pendingId.current);
      setTextState("");
      pendingId.current = null;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  };

  return { text, setText, sending, error, submit };
}
