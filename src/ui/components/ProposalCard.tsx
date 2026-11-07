"use client";

import { useState } from "react";
import type { ProposalView } from "@/application/queries/views";
import { useAction } from "../hooks/useAction";

interface Props {
  proposal: ProposalView;
  /** Reload the conversation after a decision. */
  onDone: () => void;
}

/**
 * The agent's suggestion, in AI blue above the reply box. Nothing happens until the seller taps Approve; a
 * refund asks once more before money moves.
 */
export function ProposalCard({ proposal, onDone }: Props) {
  const [confirming, setConfirming] = useState(false);
  const approve = useAction(`/api/proposals/${proposal.id}/approve`, onDone);
  const dismiss = useAction(`/api/proposals/${proposal.id}/dismiss`, onDone);
  const error = approve.error ?? dismiss.error;
  return (
    <section
      aria-label="Agent suggestion"
      className="mx-3 mb-2 flex flex-col gap-1 rounded-card border border-ai bg-ai-soft p-3"
    >
      <p className="text-[12px] font-medium text-ai">Agent suggests</p>
      <p className="font-semibold">{proposal.title}</p>
      <p className="text-[13px] text-muted">{proposal.reason}</p>
      {proposal.quote && <p className="text-[13px] italic">“{proposal.quote}”</p>}
      {confirming && proposal.confirm && <p className="pt-1 text-[14px] font-medium">{proposal.confirm}</p>}
      <ProposalButtons
        proposal={proposal}
        confirming={confirming}
        busy={approve.busy || dismiss.busy}
        onApprove={() => (proposal.confirm && !confirming ? setConfirming(true) : approve.run())}
        onSecondary={() => (confirming ? setConfirming(false) : dismiss.run())}
      />
      {error && <p className="text-[13px] text-missing-fg">{error}</p>}
    </section>
  );
}

interface ButtonProps {
  proposal: ProposalView;
  confirming: boolean;
  busy: boolean;
  onApprove: () => void;
  onSecondary: () => void;
}

function ProposalButtons({ proposal, confirming, busy, onApprove, onSecondary }: ButtonProps) {
  const approveText = busy ? "Working…" : confirming ? "Yes, refund" : proposal.approveLabel;
  return (
    <div className="mt-1 flex gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={onApprove}
        className="rounded-full bg-ai px-4 py-1.5 text-[14px] font-medium text-white disabled:opacity-50"
      >
        {approveText}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onSecondary}
        className="rounded-full px-3 py-1.5 text-[14px] text-ai"
      >
        {confirming ? "Keep it" : "Dismiss"}
      </button>
    </div>
  );
}
