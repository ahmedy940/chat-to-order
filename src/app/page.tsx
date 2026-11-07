import { connection } from "next/server";
import { container } from "@/server/container";
import { DemoPage } from "@/ui/components/DemoPage";

/** The two-phone demo. Read at request time, so the customer phone reopens on the newest conversation. */
export default async function Home() {
  await connection();
  const latest = container().getCustomerConversation.latestId();
  return <DemoPage initialConversationId={latest} />;
}
