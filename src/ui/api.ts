/** How the screens talk to the server: plain JSON over the app's own API routes. */

export async function postJson<T>(
  url: string,
  body: unknown,
  method: "POST" | "PATCH" | "DELETE" = "POST",
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(json.error ?? "Something went wrong. Try again.");
  return json;
}

export function patchJson<T>(url: string, body: unknown): Promise<T> {
  return postJson<T>(url, body, "PATCH");
}

export function deleteJson<T>(url: string): Promise<T> {
  return postJson<T>(url, {}, "DELETE");
}

/** A fresh ID for each new message, kept while retrying so the server saves it only once. */
export function newClientId(): string {
  return crypto.randomUUID();
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "Nov 8, 3:04 PM": the Orders tab's date. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** A failed action's message, for showing on screen. */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
