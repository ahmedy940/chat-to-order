"use client";

import { useCallback, useEffect, useState } from "react";

/** Both phones re-read their view this often, so a message shows on the other phone within about 2 seconds. */
export const POLL_MS = 1500;

type Result<T> = { kind: "ok"; data: T } | { kind: "failed"; error: string } | { kind: "offline" };

interface PollState<T> {
  url: string | null;
  data: T | null;
  error: string | null;
}

/** Loads `url` now and every 1.5 seconds. `refresh()` reloads at once (after sending, for example). */
export function usePolling<T>(url: string | null, intervalMs = POLL_MS) {
  const [state, setState] = useState<PollState<T>>({ url: null, data: null, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    let active = true;
    const load = async () => {
      const result = await fetchView<T>(url);
      if (active) setState((previous) => nextState(previous, url, result));
    };
    void load();
    const timer = setInterval(() => void load(), intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [url, intervalMs, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const isCurrent = state.url === url && url !== null;
  return { data: isCurrent ? state.data : null, error: isCurrent ? state.error : null, refresh };
}

async function fetchView<T>(url: string): Promise<Result<T>> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    const body = (await response.json()) as T & { error?: string };
    if (response.ok) return { kind: "ok", data: body };
    return { kind: "failed", error: body.error ?? "Couldn't load this view." };
  } catch {
    return { kind: "offline" };
  }
}

/** A brief network blip keeps what's on screen; a real error (like a reset conversation) clears it. */
function nextState<T>(previous: PollState<T>, url: string, result: Result<T>): PollState<T> {
  if (result.kind === "ok") return { url, data: result.data, error: null };
  if (result.kind === "failed") return { url, data: null, error: result.error };
  const kept = previous.url === url ? previous.data : null;
  return { url, data: kept, error: "Can't reach the app. Retrying…" };
}
