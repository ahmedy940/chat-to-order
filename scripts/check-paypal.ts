/**
 * Slice 1 risk check: a real PayPal sandbox round trip. Creates a $128 order, waits while you pay as the
 * sandbox buyer, captures it, then refunds it in full, printing exactly what PayPal sends back.
 * Run with `npm run check:paypal`. Sandbox only: no real money moves.
 */
import { createServer } from "node:http";
import type { PayPalOrderRequest } from "@/application/ports/PaymentGateway";
import { Money } from "@/domain/Money";
import type { CaptureResult } from "@/domain/Payment";
import { SHOP_NAME } from "@/domain/types";
import { PAYPAL_SANDBOX_URL, PayPalRestGateway } from "@/infrastructure/payments/PayPalRestGateway";
import { heading, requireEnv } from "./env";

const PORT = 4321;
const WAIT_MS = 10 * 60 * 1000;
const RUN = Date.now().toString(36);

function sampleOrder(): PayPalOrderRequest {
  return {
    referenceId: `check-${RUN}`,
    invoiceId: `CHECK-${RUN}`,
    description: `${SHOP_NAME} · sandbox check`,
    lines: [{ name: "Beige linen dress (M)", quantity: 2, unitAmountCents: 6000 }],
    itemTotalCents: 12000,
    shippingCents: 800,
    totalCents: 12800,
    brandName: SHOP_NAME,
    returnUrl: `http://localhost:${PORT}/approved`,
    cancelUrl: `http://localhost:${PORT}/cancelled`,
  };
}

/** PayPal sends the buyer back to this tiny local page after they approve or cancel. */
const OUTCOMES: Record<string, "approved" | "cancelled"> = {
  "/approved": "approved",
  "/cancelled": "cancelled",
};

function waitForBuyer(): Promise<"approved" | "cancelled"> {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const outcome = OUTCOMES[new URL(request.url ?? "/", `http://localhost:${PORT}`).pathname];
      if (!outcome) return void response.writeHead(404).end(); // e.g. the browser asking for a tab icon
      response.on("finish", () => server.close(() => undefined).closeAllConnections());
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(`<h2 style="font-family:sans-serif">Payment ${outcome}. Go back to the terminal.</h2>`);
      resolve(outcome);
    }).listen(PORT);
    setTimeout(() => {
      server.close();
      reject(new Error("No approval within 10 minutes."));
    }, WAIT_MS).unref();
  });
}

const show = (value: string | null | undefined) => value ?? "(not returned)";

function printCapture(capture: CaptureResult): void {
  const address = capture.payer.shipAddress;
  console.log(`   Status          ${capture.status}`);
  console.log(`   Amount          ${Money.ofCents(capture.amountCents).format()} ${capture.currency}`);
  console.log(`   Capture ID      ${capture.captureId}`);
  console.log(`   Payer name      ${show(capture.payer.name)}`);
  console.log(`   Payer email     ${show(capture.payer.email)}`);
  console.log(`   Ship to         ${show(capture.payer.shipName)}`);
  console.log(
    `   Address         ${address ? Object.values(address).filter(Boolean).join(", ") : "(not returned)"}`,
  );
  const fee = capture.feeCents === null ? "(not returned)" : Money.ofCents(capture.feeCents).format();
  const net = capture.netCents === null ? "(not returned)" : Money.ofCents(capture.netCents).format();
  console.log(`   PayPal fee      ${fee} · net ${net}`);
}

async function main(): Promise<void> {
  const config = {
    clientId: requireEnv("PAYPAL_CLIENT_ID"),
    clientSecret: requireEnv("PAYPAL_CLIENT_SECRET"),
  };
  const gateway = new PayPalRestGateway({ ...config, baseUrl: PAYPAL_SANDBOX_URL });
  heading("1. Create a $128.00 sandbox order");
  const created = await gateway.createOrder(sampleOrder(), `check-create-${RUN}`);
  console.log(`   PayPal order ${created.paypalOrderId} (${created.status})`);
  heading("2. Open this link, log in as your sandbox BUYER (personal account) and pay:");
  console.log(`   ${created.approveUrl ?? "(PayPal returned no approval link)"}`);
  if ((await waitForBuyer()) === "cancelled")
    throw new Error("You cancelled on PayPal. Run it again to retry.");
  heading("3. Capture the payment");
  const capture = await gateway.capture(created.paypalOrderId, `check-capture-${RUN}`);
  printCapture(capture);
  const again = await gateway.capture(created.paypalOrderId, `check-capture-${RUN}`);
  console.log(
    `   Same request again → same capture: ${again.captureId === capture.captureId ? "yes" : "NO"}`,
  );
  heading("4. Refund it in full");
  const refund = await gateway.refund(capture.captureId, `check-refund-${RUN}`);
  console.log(
    `   Refund ${refund.refundId}: ${refund.status}, ${Money.ofCents(refund.amountCents).format()}`,
  );
  const twice = await gateway.refund(capture.captureId, `check-refund-${RUN}`);
  console.log(`   Same request again → same refund: ${twice.refundId === refund.refundId ? "yes" : "NO"}`);
  heading("PayPal check passed: paid, then refunded.");
}

main().catch((error: unknown) => {
  console.error(`\nPayPal check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
