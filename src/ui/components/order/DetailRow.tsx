"use client";

import { useState, type FormEvent } from "react";
import type { DetailView } from "@/application/queries/orderViews";
import { MAX_OPTIONS } from "@/domain/types";
import { errorText } from "../../api";

const BADGES: Record<string, { text: string; tone: string }> = {
  found: { text: "Found", tone: "bg-found-bg text-found-fg" },
  missing: { text: "Missing", tone: "bg-missing-bg text-missing-fg" },
  set_by_you: { text: "Set by you", tone: "bg-set-bg text-set-fg" },
};

const PLACEHOLDERS: Record<string, string> = { unit_price: "60.00", delivery_fee: "8.00", quantity: "2" };

type Mode = "view" | "edit" | "ask";

interface Props {
  detail: DetailView;
  editable: boolean;
  onSave: (value: string) => Promise<void>;
  /** Offer options to the customer. Absent where asking isn't allowed. */
  onAsk?: (options: string[]) => Promise<void>;
}

/** One line of the order card: label, value and status. Type the value, or ask the customer (never for a price). */
export function DetailRow({ detail, editable, onSave, onAsk }: Props) {
  const [mode, setMode] = useState<Mode>("view");
  return (
    <div className={`flex flex-col gap-1 px-3 py-2 ${detail.status === "missing" ? "bg-missing-row" : ""}`}>
      <RowHeader detail={detail} />
      <RowBody
        detail={detail}
        editable={editable}
        onSave={onSave}
        onAsk={onAsk}
        mode={mode}
        setMode={setMode}
      />
      {detail.options.length > 0 && (
        <p className="text-[12px] text-ai">Asked customer: {detail.options.join(" · ")}</p>
      )}
      {detail.quote && <p className="text-[12px] text-muted">“{detail.quote}”</p>}
    </div>
  );
}

function RowHeader({ detail }: { detail: DetailView }) {
  const badge = BADGES[detail.status];
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] text-muted">{detail.label}</span>
      {badge && <span className={`rounded-full px-2 py-0.5 text-[12px] ${badge.tone}`}>{badge.text}</span>}
    </div>
  );
}

/** Ask customer only for an open detail the customer can answer: never a price. */
function canAsk(detail: DetailView, editable: boolean): boolean {
  const open = detail.status === "missing" || detail.status === "optional";
  return editable && open && !detail.sellerOnly;
}

function RowBody(props: Props & { mode: Mode; setMode: (mode: Mode) => void }) {
  const { detail, editable, onSave, onAsk, mode, setMode } = props;
  const done = () => setMode("view");
  if (mode === "edit") return <ValueForm detail={detail} onSave={onSave} onDone={done} />;
  if (mode === "ask" && onAsk) return <AskForm detail={detail} onAsk={onAsk} onDone={done} />;
  const ask = onAsk && canAsk(detail, editable) ? () => setMode("ask") : null;
  return <ValueLine detail={detail} editable={editable} onEdit={() => setMode("edit")} onAsk={ask} />;
}

interface LineProps {
  detail: DetailView;
  editable: boolean;
  onEdit: () => void;
  onAsk: (() => void) | null;
}

function ValueLine({ detail, editable, onEdit, onAsk }: LineProps) {
  const text = detail.display ?? (detail.status === "optional" ? "Optional" : "Never mentioned");
  const tone = detail.display ? "" : "text-muted";
  if (!editable) return <span className={tone}>{text}</span>;
  return (
    <div className="flex flex-wrap items-center gap-x-3">
      <button type="button" onClick={onEdit} className="text-left hover:underline">
        <span className={tone}>{text}</span>
        <span className="ml-2 text-[12px] text-muted">Edit</span>
      </button>
      {onAsk && (
        <button type="button" onClick={onAsk} className="text-[12px] font-medium text-ai hover:underline">
          Ask customer
        </button>
      )}
    </div>
  );
}

function ValueForm({ detail, onSave, onDone }: Pick<Props, "detail" | "onSave"> & { onDone: () => void }) {
  const placeholder = PLACEHOLDERS[detail.field] ?? detail.label;
  return (
    <TextForm
      label={detail.label}
      initial={detail.value ?? ""}
      placeholder={placeholder}
      action="Save"
      onSubmit={onSave}
      onDone={onDone}
    />
  );
}

function AskForm({
  detail,
  onAsk,
  onDone,
}: {
  detail: DetailView;
  onAsk: (options: string[]) => Promise<void>;
  onDone: () => void;
}) {
  const toOptions = (text: string) =>
    text
      .split(",")
      .map((option) => option.trim())
      .filter(Boolean);
  return (
    <>
      <p className="text-[12px] text-muted">
        Options the customer can tap, up to {MAX_OPTIONS}, separated by commas.
      </p>
      <TextForm
        label={`Options for ${detail.label}`}
        initial={detail.options.join(", ")}
        placeholder="S, M"
        action="Ask"
        onSubmit={(text) => onAsk(toOptions(text))}
        onDone={onDone}
      />
    </>
  );
}

interface FormProps {
  label: string;
  initial: string;
  placeholder: string;
  action: string;
  onSubmit: (value: string) => Promise<void>;
  onDone: () => void;
}

/** A one-line form that closes when saved and shows the reason when refused. */
function TextForm({ label, initial, placeholder, action, onSubmit, onDone }: FormProps) {
  const [value, setValue] = useState(initial);
  const { error, busy, submit } = useSubmit(onSubmit, onDone);
  return (
    <form onSubmit={(event) => void submit(event, value)} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className="min-w-0 flex-1 rounded-md border border-line px-2 py-1"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-ink px-3 py-1 text-[14px] text-white disabled:opacity-40"
        >
          {busy ? "…" : action}
        </button>
        <button type="button" onClick={onDone} className="px-1 text-[14px] text-muted">
          Cancel
        </button>
      </div>
      {error && <p className="text-[13px] text-missing-fg">{error}</p>}
    </form>
  );
}

function useSubmit(onSubmit: (value: string) => Promise<void>, onDone: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent, value: string) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit(value);
      onDone();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, submit };
}
