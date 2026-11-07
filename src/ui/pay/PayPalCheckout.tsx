"use client";

import { PayPalOneTimePaymentButton, PayPalProvider } from "@paypal/react-paypal-js/sdk-v6";
import { useState } from "react";
import type { CaptureOutcome } from "@/application/CapturePayment";
import { postJson } from "../api";

const DECLINED = "PayPal couldn't take this payment. Please try again.";
const CLOSED = "You closed PayPal before paying. You can try again whenever you're ready.";
const MISMATCH = "PayPal took a different amount than this order. The shop will check it with PayPal.";

interface Props {
  payToken: string;
  /** The sandbox app's public client ID. It's safe in the browser; the secret never leaves the server. */
  clientId: string;
  onPaid: () => void;
}

/**
 * PayPal's own button (JS SDK v6). Our server creates the PayPal order from the frozen order, and after the
 * buyer approves, our server captures it and checks the amount. The browser never sets an amount.
 */
export function PayPalCheckout({ payToken, clientId, onPaid }: Props) {
  const { message, setMessage, createOrder, capture } = useCheckout(payToken, onPaid);
  if (!clientId) {
    return <p className="text-[14px] text-missing-fg">PayPal isn&apos;t set up on this server yet.</p>;
  }
  return (
    <PayPalProvider
      clientId={clientId}
      environment="sandbox"
      components={["paypal-payments"]}
      pageType="checkout"
    >
      <PayPalOneTimePaymentButton
        createOrder={createOrder}
        onApprove={({ orderId }) => capture(orderId)}
        onCancel={() => setMessage(CLOSED)}
        onError={() => setMessage(DECLINED)}
      />
      {message && (
        <p role="alert" className="mt-3 rounded-md bg-missing-row px-3 py-2 text-[14px] text-missing-fg">
          {message}
        </p>
      )}
    </PayPalProvider>
  );
}

/** The two calls to our server: make (or reuse) the PayPal order, then capture it after approval. */
function useCheckout(payToken: string, onPaid: () => void) {
  const [message, setMessage] = useState<string | null>(null);

  const createOrder = async () => {
    setMessage(null);
    const url = `/api/pay/${payToken}/paypal-order`;
    const { paypalOrderId } = await postJson<{ paypalOrderId: string }>(url, {});
    return { orderId: paypalOrderId };
  };

  const capture = async (paypalOrderId: string) => {
    try {
      const url = `/api/pay/${payToken}/capture`;
      const { outcome } = await postJson<{ outcome: CaptureOutcome }>(url, { paypalOrderId });
      if (outcome === "mismatch") setMessage(MISMATCH);
      else onPaid();
    } catch {
      setMessage(DECLINED);
    }
  };

  return { message, setMessage, createOrder, capture };
}
