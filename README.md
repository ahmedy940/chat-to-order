# chat-to-order: Chat to Paid

Small sellers take orders in chat, then retype amounts into payment links, scroll back for addresses and match payments by hand. **chat-to-order** turns the conversation into a **PayPal order**:

1. The customer orders in chat. The seller taps **Read order**, and Gemini fills in the order card, quoting the message each detail came from. Anything missing is marked, never guessed (prices included).
2. The seller settles what's missing, by typing it or asking the customer with tap-to-answer options.
3. **Request payment** creates a PayPal order from the order itself: items, delivery fee, total and order number. The customer gets a pay page showing exactly what was agreed, with PayPal's own buttons.
4. PayPal confirms the payment, and the order turns **Paid** with the buyer's name and shipping address from PayPal, so the chat never has to ask.
5. If the customer asks to return it, the agent proposes **Refund**, quoting their message. One approved tap issues a real PayPal refund.

Nothing is sent and no money moves without the seller's tap. The agent only proposes.

## Try it

**Hosted demo:** https://chat-to-order.onrender.com

- On a laptop, the page shows two phones: the **Customer** on the left and the **Seller** on the right. On a phone, a switch flips between them.
- To pay, log in on PayPal's page as the **sandbox buyer** from the Devpost testing instructions and pay with the saved **card**. A sandbox bank payment stays "pending".
- **Reset demo** (top of the page) clears everything and restarts order numbers at #1001.
- The free hosting sleeps when idle, so the first open can take up to a minute. A restart also clears the demo data, which Reset does anyway.

It's PayPal's **sandbox**: no real money.

## Run it locally

You need Node 22 or newer.

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `GEMINI_API_KEY`: a free key from [Google AI Studio](https://aistudio.google.com).
   - `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`: a **sandbox** REST app from the [PayPal developer dashboard](https://developer.paypal.com/dashboard) (Apps & Credentials → Sandbox).
   - `NEXT_PUBLIC_PAYPAL_CLIENT_ID`: the same client ID. It's public by design: the pay page loads PayPal's buttons with it.
   - `APP_BASE_URL=http://localhost:3000`
3. `npm run dev`, then open http://localhost:3000.
4. Pay as a sandbox **personal** account (PayPal dashboard → Testing tools → Sandbox accounts).

Other commands:

- `npm test`, `npm run lint` and `npm run typecheck`.
- `npm run check:ai` and `npm run check:paypal` to test your keys.
- `npm run db:reset` to clear the local data.

To run a production build: `npm ci && npm run build && npm start`.

## Deploy on Render

`render.yaml` describes one free web service. In Render, choose **New → Blueprint**, pick this repository, and type the four keys when asked. They're never stored in the repo. Pay links use Render's own address automatically. Set `APP_BASE_URL` only for a custom domain.

## How it's built

- **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS 4**, **SQLite** (better-sqlite3), **Zod**.
- **PayPal:**
  - Orders v2 (create and capture, with idempotent request IDs and the order number as `invoice_id`);
  - Payments v2 (refund);
  - the PayPal JS SDK v6 buttons on the pay page.
- **Gemini** (Google GenAI SDK) reads the chat into a structured order, guided by a schema. It also writes short drafts and classifies the customer's intent for the agent.
- **Ports and adapters:** routes → use cases → domain. PayPal, Gemini, SQLite and the chat channel are adapters behind interfaces, so WhatsApp or another payment step is one adapter away.
- **Money rules** live in the `Order` domain object and are covered by tests:
  - amounts in integer cents, taken only from the frozen order;
  - one payment per order;
  - every status change saved with its timeline line in one transaction.

## License

[MIT](LICENSE)
