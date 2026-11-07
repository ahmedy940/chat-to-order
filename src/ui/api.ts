/** How the screens talk to the server: plain JSON over the app's own API routes. */

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(json.error ?? "Something went wrong. Try again.");
  return json;
}

/** A fresh ID for each new message, kept while retrying so the server saves it only once. */
export function newClientId(): string {
  return crypto.randomUUID();
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
