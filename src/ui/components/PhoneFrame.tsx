import type { ReactNode } from "react";

/** A phone-shaped frame, about 390 × 760 on wide screens, and as tall as fits on a real phone. */
export function PhoneFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      className="flex h-[min(760px,calc(100dvh-170px))] min-h-[520px] w-full max-w-[390px] flex-col overflow-hidden rounded-[44px] border-[8px] border-ink bg-card shadow-sm"
    >
      {children}
    </section>
  );
}
