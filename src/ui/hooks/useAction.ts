"use client";

import { useState } from "react";
import { errorText, postJson } from "../api";

/** A button's one server action: posts once (callers disable the button while busy) and keeps the reason if refused. */
export function useAction(url: string, onSuccess: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = () => {
    setBusy(true);
    setError(null);
    postJson(url, {})
      .then(onSuccess)
      .catch((failure: unknown) => setError(errorText(failure)))
      .finally(() => setBusy(false));
  };
  return { busy, error, run };
}
