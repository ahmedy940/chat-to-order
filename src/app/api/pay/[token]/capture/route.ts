import { z } from "zod";
import { container } from "@/server/container";
import { readJson, respond, type TokenParams } from "@/server/http";

const Body = z.object({ paypalOrderId: z.string().regex(/^[A-Z0-9]{8,40}$/) });

/** After the buyer approves on PayPal: capture the money and mark the order Paid. */
export function POST(request: Request, { params }: TokenParams): Promise<Response> {
  return respond(async () => {
    const [{ token }, body] = await Promise.all([params, readJson(request, Body)]);
    return container().capturePayment.execute(token, body.paypalOrderId);
  });
}
