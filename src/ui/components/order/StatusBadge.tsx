/** A small pill for an order or chat status. Paid is green, Awaiting payment amber, everything else gray. */
const TONES: Record<string, string> = {
  "Awaiting payment": "bg-awaiting-bg text-awaiting-fg",
  Paid: "bg-found-bg text-found-fg",
};

export function StatusBadge({ label }: { label: string }) {
  const tone = TONES[label] ?? "bg-set-bg text-set-fg";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[13px] ${tone}`}>{label}</span>;
}
