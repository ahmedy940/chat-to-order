import type { Metadata } from "next";
import { connection } from "next/server";
import type { PayPageView } from "@/application/queries/GetPayPage";
import { DomainError } from "@/domain/errors";
import { SHOP_NAME } from "@/domain/types";
import { container } from "@/server/container";
import { PayPage } from "@/ui/pay/PayPage";

export const metadata: Metadata = { title: `Pay your order · ${SHOP_NAME}` };

/** The customer's pay page, opened from the link in the chat. Read at request time: it must never be stale. */
export default async function Pay({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";
  return <PayPage payToken={token} view={loadPayPage(token)} clientId={clientId} />;
}

/** An unknown or reset link shows a friendly message instead of an error page. */
function loadPayPage(token: string): PayPageView | null {
  try {
    return container().getPayPage.execute(token);
  } catch (error) {
    if (error instanceof DomainError) return null;
    throw error;
  }
}
