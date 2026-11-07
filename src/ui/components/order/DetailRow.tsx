"use client";

import { useState, type FormEvent } from "react";
import type { DetailView } from "@/application/queries/orderViews";
import { errorText } from "../../api";

const BADGES: Record<string, { text: string; tone: string }> = {
  found: { text: "Found", tone: "bg-found-bg text-found-fg" },
  missing: { text: "Missing", tone: "bg-missing-bg text-missing-fg" },
  set_by_you: { text: "Set by you", tone: "bg-set-bg text-set-fg" },
};

interface Props {
  detail: DetailView;
  editable: boolean;
  onSave: (value: string) => Promise<void>;
}

/** One line of the order card: label, value and its status. Tap the value to type it. */
export function DetailRow({ detail, editable, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const badge = BADGES[detail.status];
  const missing = detail.status === "missing";
  return (
    <div className={`flex flex-col gap-1 px-3 py-2 ${missing ? "bg-missing-row" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted">{detail.label}</span>
        {badge && <span className={`rounded-full px-2 py-0.5 text-[12px] ${badge.tone}`}>{badge.text}</span>}
      </div>
      {editing ? (
        <ValueEditor detail={detail} onSave={onSave} onDone={() => setEditing(false)} />
      ) : (
        <ValueButton detail={detail} editable={editable} onEdit={() => setEditing(true)} />
      )}
      {detail.quote && <p className="text-[12px] text-muted">“{detail.quote}”</p>}
    </div>
  );
}

function ValueButton({
  detail,
  editable,
  onEdit,
}: {
  detail: DetailView;
  editable: boolean;
  onEdit: () => void;
}) {
  const empty = detail.status === "optional" ? "Optional" : "Never mentioned";
  const text = detail.display ?? empty;
  if (!editable) return <span className={detail.display ? "" : "text-muted"}>{text}</span>;
  return (
    <button type="button" onClick={onEdit} className="text-left hover:underline">
      <span className={detail.display ? "" : "text-muted"}>{text}</span>
      <span className="ml-2 text-[12px] text-muted">Edit</span>
    </button>
  );
}

const PLACEHOLDERS: Record<string, string> = { unit_price: "60.00", delivery_fee: "8.00", quantity: "2" };

/** Saves the typed value; on success closes the editor, on failure keeps it open with the reason. */
function useSave(onSave: (value: string) => Promise<void>, onDone: () => void) {
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent, value: string) => {
    event.preventDefault();
    try {
      await onSave(value);
      onDone();
    } catch (failure) {
      setError(errorText(failure));
    }
  };
  return { error, submit };
}

function ValueEditor({ detail, onSave, onDone }: Pick<Props, "detail" | "onSave"> & { onDone: () => void }) {
  const [value, setValue] = useState(detail.value ?? "");
  const { error, submit } = useSave(onSave, onDone);
  return (
    <form onSubmit={(event) => void submit(event, value)} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={PLACEHOLDERS[detail.field] ?? detail.label}
          aria-label={detail.label}
          className="min-w-0 flex-1 rounded-md border border-line px-2 py-1"
        />
        <button type="submit" className="rounded-md bg-ink px-3 py-1 text-[14px] text-white">
          Save
        </button>
        <button type="button" onClick={onDone} className="px-1 text-[14px] text-muted">
          Cancel
        </button>
      </div>
      {error && <p className="text-[13px] text-missing-fg">{error}</p>}
    </form>
  );
}
