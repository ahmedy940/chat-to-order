---
doc: spec
status: approved
target: PayPal AI Hackathon (Thu 12 Nov 2026, 12:00 pm Pacific)
---

# chat-to-order: Chat to Paid — Technical Spec

## How This Works, In Plain Language
chat-to-order is **one Next.js app**, hosted on Render's free tier so judges just open a link. It has three kinds of screens and one back office:
- **Demo page:** the customer phone and the seller phone side by side.
- **Pay page:** the customer's "pay for this order" page with PayPal's buttons.
- **Server routes:** the back office. It is the only place that holds the Gemini key and the PayPal credentials.

1. **Every message is saved** in a **SQLite file** on the server.
2. **Read order:** the server asks **Gemini** (free tier) to fill in the order in a **fixed shape we define**, and checks that shape before saving.
3. **The agent:** after each customer message, Gemini says what the customer wants (for example "wants a refund"). A small rule in our own code turns that, plus the order's status, into **one proposal** the seller can approve. The AI never picks amounts.
4. **Payment:** when the customer pays on the pay page, PayPal's buttons hand over to our server, which **captures** the payment through PayPal's REST API, checks the amount, and marks the order Paid with the payer's name and address.
5. **Refund:** the seller approves, and our server calls PayPal's refund API for that exact payment.
6. **Every change is also written to the order's timeline:** an append-only list of what happened, who did it (customer, AI, agent, seller, PayPal) and, for money, the amount. Rows are never edited or deleted. The order's status stays the source of truth for the rules; the timeline is its audit trail and money ledger.
7. **Screens ask "anything new?" every ~1.5 seconds** (polling) and redraw.

Every business rule lives in **domain classes** (`Order`, `Payment`). Every action is one **use case**. Every outside service (Gemini, PayPal, the database, the chat channel) plugs in through an **interface (port)**, so WhatsApp or Claude later is one new adapter, not a rewrite.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **Open the demo.** `/` renders both phones. Each polls its own view (`GET /api/customer/conversations/[id]`, `GET /api/conversations/[id]`). **Reset demo** calls `POST /api/demo/reset`.
2. **The customer writes.** `POST /api/customer/messages` runs `ReceiveCustomerMessage`. The message is saved once (client-generated ID, unique).
3. **Read order.** `POST /api/conversations/[id]/read-order` runs `ReadOrder`: it sends the messages since the last finished order, plus seller-set details, to `AiProvider.readOrder` (Gemini Flash). The answer is validated with `OrderReadingSchema` (Zod) and merged into the `Order` (seller values never overwritten). A new Draft order gets the next number (from #1001). The draft question is saved.
4. **Settle.** `PATCH /api/orders/[id]/details` runs `SettleDetail` (type a value or Ask customer with up to 3 options). The draft is regenerated from the open details.
5. **Send.** `POST /api/conversations/[id]/send` runs `SendReply` with the draft ID. Stale draft → `409`. Idempotent per draft ID. The order becomes `WaitingForCustomer` if it asked something.
6. **Customer taps an option.** It arrives as a customer message carrying the option ID, and `SettleDetail` applies it as the customer's answer. The agent pass runs.
7. **Agent pass.** On the next poll, `ProposeNextAction` runs for conversations with an unhandled customer message (under a per-conversation lock). `AiProvider.classifyIntent` (Gemini Flash-Lite) returns `{ intent, quote }`. `NextActionPolicy` (domain) turns intent + order status into at most one `AgentProposal` (Ask, RequestPayment, Remind, Refund) or none.
8. **Request payment.** `POST /api/orders/[id]/request-payment` (or approving the proposal) runs `RequestPayment`: `Order.requestPayment()` freezes items and total, sets `AwaitingPayment`, and creates a random pay token. The payment message with `/pay/[token]` is drafted.
9. **The customer pays.** `/pay/[token]` shows the frozen order. PayPal's buttons call `POST /api/pay/[token]/paypal-order`, which runs `PreparePayPalOrder`: reuse the stored PayPal order if it's still payable, otherwise create one through `PaymentGateway.createOrder` (items, shipping = delivery fee, total, `invoice_id` = order number, `PayPal-Request-Id` for idempotency). After approval, the buttons call `POST /api/pay/[token]/capture`, which runs `CapturePayment`: capture through `PaymentGateway.capture`, check status `COMPLETED` and amount = frozen total, save capture ID and payer details, set `Paid`. Idempotent: capturing a Paid order returns Paid.
10. **Paid.** The next seller poll shows Paid. A thank-you message is drafted.
11. **Refund.** The customer's "can I return them?" leads the policy to propose Refund. Approving calls `POST /api/orders/[id]/refund`, which runs `RefundPayment`: `PaymentGateway.refund(captureId)` with `PayPal-Request-Id = refund-{orderId}`, then `Refunded` with the refund ID. A refund message is drafted.
12. **Orders tab.** `GET /api/orders`.

## Stack
All free. Versions are pinned at build step 1.

| Piece | Choice | Why | Docs |
|---|---|---|---|
| App | **Next.js (App Router), React, TypeScript strict** | Carried over; screens and server routes in one project | https://nextjs.org/docs |
| Styling | **Tailwind CSS** with the Look and Feel tokens | Carried over | https://tailwindcss.com/docs |
| Data | **SQLite through better-sqlite3** (fallback `node:sqlite`) | One file, no setup. On Render's free tier the file resets on redeploy or restart, which is fine for a demo with Reset. | https://github.com/WiseLibs/better-sqlite3 |
| Validation | **Zod** | Checks Gemini output, PayPal responses and route inputs at runtime | https://zod.dev |
| AI | **Gemini free tier via `@google/genai`**: Flash for Read order and drafts, Flash-Lite for intent | No budget ("i dont have any money"), structured output | https://ai.google.dev/gemini-api/docs |
| Payments (server) | **PayPal REST APIs** with plain `fetch`: OAuth token, Orders v2 (create, get, capture), Payments v2 (refund) | Exact control over amounts, idempotency through `PayPal-Request-Id`, no extra SDK | https://developer.paypal.com/docs/api/orders/v2/ · https://developer.paypal.com/api/payments/v2/captures-refund.md |
| Payments (pay page) | **PayPal JavaScript SDK buttons via `@paypal/react-paypal-js`** | PayPal's own trusted buttons (PayPal, Pay Later, card where available) | https://developer.paypal.com/sdk/js/ |
| Hosting | **Render free web service** | Judges open a link; runs Node with a writable disk. Sleeps after idle (first open can take about a minute). | https://render.com/docs/free |
| Tests | **Vitest** | Domain and use cases, with fakes | https://vitest.dev |
| Code quality | **ESLint and Prettier** | Carried over: file and function size limits, layer boundaries | https://eslint.org |
| Runtime | **Node.js 23** locally; Render's Node version pinned in `package.json` `engines` | | |

**Not used at runtime: the PayPal Agent Toolkit.** Its tools let the AI fill in amounts and parameters. We keep money parameters out of the AI's hands: the AI only proposes *which* action, and our code supplies the amounts from the order. The toolkit's tool names also differ across versions (`pay_order` vs `capture_order`). If time remains on day 4, a `PayPalAgentToolkitGateway` can sit behind the same `PaymentGateway` port. This is disclosed in the submission.

**Verify at build step 1:** Gemini model IDs and free limits; the `@google/genai` structured-output call; `better-sqlite3` on Node 23 and on Render; the payer and shipping fields in a real sandbox capture response.

## Where It Runs and How Someone Tries It
- **Hosted (for judges):** a Render URL such as `https://chat-to-order.onrender.com` (name confirmed at deploy). Open it on a laptop. The sandbox buyer login goes in the Devpost testing instructions, never in the repo.
- **Local:**
  1. `npm install`
  2. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (a sandbox REST app at https://developer.paypal.com/dashboard), `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (the same client ID; it's public by design), `APP_BASE_URL=http://localhost:3000`.
  3. `npm run dev`, then open http://localhost:3000.
  4. Pay with a sandbox **personal** account from the PayPal dashboard (Testing tools → Sandbox accounts).
- **Reset:** the Reset demo link, or `npm run db:reset`.
- **Submission needs:** a public repo with an **MIT LICENSE**, a README with setup, the hosted URL, a video under 3 minutes on YouTube, and the list of tools used (Gemini, PayPal Orders v2 and Payments v2, PayPal JS SDK, Render).

## Look and Feel
Carried over from `prd.md > Look and Feel` as Tailwind tokens:
- `page #F1F1F1`, `card #FFFFFF`, `border #E3E3E3`, `ink #1A1A1A`, `muted #616161`.
- `ai #4A5BD6`, `ai-soft #E8EBFC`: the Draft chip, the dashed draft outline, the agent proposal card.
- Detail states: found `#E3F1DF/#205B1D`; missing `#FDE2DD/#8E1F0B` with row `#FFF4F2`; set by you `#EDEDED/#4A4A4A`.
- Payment states: Awaiting payment amber `#FFF1C2/#6A4A00`; Paid green `#E3F1DF/#205B1D`; Refunded and Cancelled gray.
- System font, 15px body, 13px badges. 12px card radius, 16px bubble radius.
- Layout: at 1024px and wider, two phone frames (390 × 760) centred side by side. Below that, one phone with a Customer / Seller switch. The pay page is a single centred card (max 420px).
- Never: WhatsApp green, platform logos, gradients, glowing AI effects. PayPal's buttons are left as PayPal renders them.

## Architecture and Code Principles
Carried over from the approved spec (learner: clean, object-oriented, no huge files; approach delegated to the agent).
- **Modular monolith, ports and adapters.** Routes → use cases → domain. Adapters (Gemini, PayPal, SQLite, DemoChannel) implement ports and are wired in `src/server/container.ts`.
- **Patterns:** Repository, Strategy (AI provider, payment gateway, channel), Adapter (PayPal and Gemini payloads ↔ domain), Factory (order numbers, pay tokens), State (status transitions only through `Order` methods), Policy (`NextActionPolicy`).
- **Money safety rules:**
  - Amounts come only from the frozen order, in integer cents. The AI never supplies an amount.
  - The server checks that the captured amount and currency equal the frozen total before marking Paid. A mismatch stays `AwaitingPayment` and is flagged.
  - Every PayPal write sends a `PayPal-Request-Id`: `create-{orderId}-{attempt}`, `capture-{orderId}`, `refund-{orderId}`. Retries and double taps don't double-charge or double-refund.
  - Capture and refund are idempotent at our level too (Paid stays Paid, Refunded stays Refunded).
  - The pay token is random (128 bits) and only reveals that one order.
- **Order timeline (statuses plus an append-only event log, not full event sourcing):**
  - Every state-changing `Order` method returns the `OrderEvent` it caused (for example `PaymentRequested`, `PaymentCaptured`, `RefundIssued`). The use case saves the order and appends the event **in the same SQLite transaction**, so the status and the timeline can never disagree.
  - Event types: `OrderRead`, `DetailSet`, `QuestionSent`, `PaymentRequested`, `PaymentCaptured`, `PaymentMismatch`, `RefundProposed`, `ProposalApproved`, `ProposalDismissed`, `RefundIssued`, `RefundFailed`, `OrderCancelled`.
  - Each event records the actor (`customer`, `ai`, `agent`, `seller`, `paypal`), the time, a short summary, optional quote, and PayPal references.
  - **Money entries:** money events carry a signed `amount_cents` (capture `+12800`, refund `−12800`) and, when PayPal returns it, the PayPal fee and net amount. The order's **balance** = the sum of its money entries. Tests assert: Paid ⇒ balance = frozen total; Refunded ⇒ balance = 0.
  - Why not full event sourcing: rebuilding state by replaying events adds projections and versioning for no gain in 5 days, and PayPal is already the system of record for the money. The log can later feed partial refunds (balance-based) and reporting.
- **Other idempotency:** client message IDs are unique; `SendReply` is keyed by draft ID; the agent pass has a per-conversation lock and runs once per customer message.
- **Validate at the edges** with Zod: route inputs, Gemini output, PayPal responses.
- **Size limits** (ESLint): ~250 lines per file, ~30 per function, `complexity`, and `no-restricted-imports` for layers.
- **Typed errors** (`OrderNotPayable`, `AmountMismatch`, `RefundNotAllowed`, `DraftOutdated`, `PayPalUnavailable`) mapped to clear messages.
- **Tests:** domain rules, the policy and every use case, with in-memory repositories, a fake AI and a fake payment gateway. Plus one manual sandbox run for each build step that touches PayPal.

## Components

### Domain (`src/domain/`)
- `Conversation`: customer display name, channel (`demo`), last customer message ID, last handled message ID.
- `Message`: direction (`in`/`out`), kind (`text`, `option_reply`, `pay_link`), text, options, client ID, time.
- `Order`: number, status (`Draft`, `WaitingForCustomer`, `AwaitingPayment`, `Paid`, `Refunded`, `Cancelled`), items, delivery fee, frozen total, pay token, payment. Methods: `total()`, `openDetails()`, `canRequestPayment()`, `applyReading()`, `settle()`, `askCustomer(options)`, `requestPayment(tokenFactory)`, `markPaid(capture)` (checks the amount), `markRefunded(refund)`, `cancel()`. Illegal transitions throw.
- `OrderItem`, `OrderDetail` (value, status `found`/`missing`/`set_by_you`, source quote, offered options).
- `Payment`: PayPal order ID, attempt, capture ID, refund ID, payer name, email, shipping name and address.
- `Money`: integer cents in USD; converts to PayPal's `"128.00"` strings.
- `OrderEvent`: type, actor, time, summary, quote, `amount_cents` (money events only, signed), PayPal fee and net (if known), PayPal reference. Immutable. `Order.balance(events)` sums the money entries.
- `NextActionPolicy`: `(intent, order) → AgentProposal | null`. Ask only with open details; RequestPayment only when `canRequestPayment()`; Remind only when AwaitingPayment; Refund only when Paid.

### Use Cases (`src/application/`)
`ReceiveCustomerMessage`, `ReadOrder`, `SettleDetail`, `SendReply`, `ProposeNextAction`, `ApproveProposal`, `DismissProposal`, `RequestPayment`, `PreparePayPalOrder`, `CapturePayment`, `RefundPayment`, `CancelOrder`, `ResetDemo`, and the queries `GetInbox`, `GetSellerConversation`, `GetCustomerConversation`, `GetPayPage`, `ListOrders`.

### Ports (`src/application/ports/`)
- `AiProvider`:
  - `readOrder({ messages, sellerSet }) → OrderReading` (items and details with status and quote, plus `draft { text, options[] }`).
  - `classifyIntent({ recentMessages, orderStatus }) → { intent: 'order_details' | 'ready_to_pay' | 'payment_question' | 'refund_request' | 'other', quote }`.
  - `draftMessage({ purpose, order }) → text` for payment, thanks, refund and reminder messages. The link and amounts are inserted by our code, not the AI.
- `PaymentGateway`: `createOrder(frozenOrder, requestId) → { paypalOrderId, status }`; `getOrder(id)`; `capture(paypalOrderId, requestId) → CaptureResult`; `refund(captureId, requestId) → RefundResult`.
- `MessageChannel`: `send(conversation, { text, options[] })`. Only `DemoChannel` now; `WhatsAppChannel` later.
- Repositories (including `OrderEventRepository` with only `append` and `listByOrder`, no update or delete), a `UnitOfWork` that runs a use case's writes in one transaction, `Clock`, `TokenFactory`.

### Adapters (`src/infrastructure/`)
- `ai/GeminiAiProvider.ts` with Zod schemas (`OrderReadingSchema`, `IntentSchema`) used both to request JSON and to validate it. Prompts in `ai/prompts/`: English, US dollars, never invent a price, ask only for open details, at most 3 options, the shop voice of "Linen and Co.".
- `payments/PayPalRestGateway.ts`:
  - OAuth client-credentials token, cached until it expires.
  - `POST /v2/checkout/orders`: intent `CAPTURE`; `purchase_units[0]` with `reference_id`, `invoice_id` = order number, `items[]`, `amount.breakdown.item_total` and `shipping`; `payment_source.paypal.experience_context` with `shipping_preference: GET_FROM_FILE`, `brand_name: "Linen and Co."`, `user_action: PAY_NOW`.
  - `GET /v2/checkout/orders/{id}`, `POST /v2/checkout/orders/{id}/capture`, `POST /v2/payments/captures/{id}/refund` (an empty body means a full refund).
  - From the capture response, also read `seller_receivable_breakdown` (PayPal fee and net amount) when present, for the money entry. Optional in the schema; to confirm with the first sandbox capture.
  - Base URL `https://api-m.sandbox.paypal.com`. Zod schemas for every response.
- `channels/DemoChannel.ts`: sending saves an outgoing message.
- `db/`: `database.ts`, `schema.sql`, `Sqlite*Repository.ts`.

### Routes (`src/app/api/`)
Thin: validate → use case → JSON.

| Route | Purpose |
|---|---|
| `POST /api/customer/messages` | Customer sends text or an option |
| `GET /api/customer/conversations/[id]` | Customer view |
| `GET /api/inbox` | Seller inbox (runs the agent pass first) |
| `GET /api/conversations/[id]` | Seller view: messages, order, draft, proposal, order timeline and balance (runs the agent pass) |
| `POST /api/conversations/[id]/read-order` | Read order |
| `POST /api/conversations/[id]/send` | Seller sends the draft or edited text |
| `POST /api/proposals/[id]/approve` · `/dismiss` | Agent proposals |
| `PATCH /api/orders/[id]/details` | Settle a detail |
| `POST /api/orders/[id]/request-payment` | Freeze the order and create the pay link |
| `POST /api/orders/[id]/refund` | Full refund |
| `POST /api/orders/[id]/cancel` | Cancel before payment |
| `GET /api/orders` | Orders tab |
| `GET /api/pay/[token]` | Pay page data |
| `POST /api/pay/[token]/paypal-order` | Create or reuse the PayPal order |
| `POST /api/pay/[token]/capture` | Capture and mark Paid |
| `POST /api/demo/reset` | Reset demo |

### Screens (`src/app/`, `src/ui/`)
- `/` demo page: `PhoneFrame`, `CustomerChat`, `SellerApp` (Inbox and Orders tabs; `ConversationView`, `OrderBar`, `OrderSheet`, `DetailRow`, `ProposalCard`, `DraftComposer`, `PayLinkCard`).
- `/pay/[token]`: `PayPage` with `PayPalScriptProvider` and `PayPalButtons` (`createOrder` → our route, `onApprove` → our capture route, plus `onError` and `onCancel` messages).
- A shared `usePolling(url, 1500)` hook.

## Data Model
SQLite `data/chat-to-order.db`. Money in integer cents (USD).

```
conversations(id PK, customer_name, channel, last_customer_message_id, last_handled_message_id, created_at)
messages(id PK, conversation_id FK, client_id UNIQUE, direction, kind, text, options_json, created_at)
orders(id PK, number UNIQUE, conversation_id FK, status, delivery_fee_cents, frozen_total_cents,
       pay_token UNIQUE, first_message_id, last_read_message_id,
       draft_id, draft_text, draft_options_json, created_at, updated_at)
order_items(id PK, order_id FK, position)
order_details(id PK, order_id FK, item_id FK NULL, field, value, status, source_quote,
              offered_options_json, updated_at)
payments(id PK, order_id FK UNIQUE, paypal_order_id, attempt, paypal_status, capture_id UNIQUE,
         refund_id UNIQUE, payer_name, payer_email, ship_name, ship_address_json,
         captured_cents, captured_at, refunded_at)
proposals(id PK, conversation_id FK, order_id FK NULL, kind, reason, quote, based_on_message_id,
          status, created_at)                     -- status: open | approved | dismissed
order_events(id PK, order_id FK, seq, type, actor, summary, quote, amount_cents NULL,
             fee_cents NULL, net_cents NULL, paypal_ref NULL, created_at,
             UNIQUE(order_id, seq))               -- append-only: never updated or deleted
sequences(name PK, next_value)                    -- order numbers start at 1001
```
Item fields: `product`, `variant`, `size`, `quantity`, `unit_price`. The customer's name and address come from `payments`, not the chat.

## File Structure
```
chat-to-order/
├── src/
│   ├── domain/            Order.ts, OrderItem.ts, OrderDetail.ts, Payment.ts, Money.ts,
│   │                      Conversation.ts, Message.ts, NextActionPolicy.ts, types.ts, errors.ts
│   ├── application/       ports/, one file per use case, queries/
│   ├── infrastructure/    ai/ (GeminiAiProvider, schemas, prompts/), payments/ (PayPalRestGateway,
│   │                      paypalSchemas), channels/DemoChannel.ts, db/
│   ├── server/container.ts
│   ├── app/               page.tsx (demo), pay/[token]/page.tsx, api/…, layout.tsx, globals.css
│   └── ui/                components/, hooks/usePolling.ts
├── tests/                 domain/, application/, fakes/ (InMemory repos, FakeAi, FakePaymentGateway)
├── data/                  (gitignored)
├── devpost/               scope, PRD, spec, checklist
├── .env.example           GEMINI_API_KEY=, PAYPAL_CLIENT_ID=, PAYPAL_CLIENT_SECRET=,
│                          NEXT_PUBLIC_PAYPAL_CLIENT_ID=, APP_BASE_URL=
├── render.yaml            Render service definition (no secrets)
├── LICENSE (MIT) · README.md · package.json · tsconfig · eslint and prettier config
```

## External Services
- **Gemini:** `GEMINI_API_KEY` from https://aistudio.google.com, server-side only. About 1 call per Read order tap, and about 1 Flash-Lite call per customer message for the intent. Check the free limits in AI Studio.
- **PayPal sandbox:** a REST app in the developer dashboard gives the client ID and secret. A sandbox business account (the shop) and a personal account (the buyer) come with it. Refunds must be within 180 days of capture (PayPal docs); not relevant to the demo.
- **Render:** a free web service from the GitHub repo. Environment variables set in Render's dashboard. Build `npm ci && npm run build`, start `npm start`.

## Important Failure Modes
- **Gemini limited or invalid output:** "Couldn't read this conversation. Try again." The seller can type the details and still request payment. The agent falls back to no proposal; the order card buttons still work.
- **PayPal unreachable or 5xx:** nothing changes on the order; the error is shown; retries are safe because of `PayPal-Request-Id`.
- **Customer approves but capture fails** (declined, `INSTRUMENT_DECLINED`): the pay page asks them to try again through PayPal's buttons (`actions.restart()`), and the order stays Awaiting payment.
- **Captured amount differs from the frozen total:** not marked Paid, and flagged on the order card ("Payment amount mismatch, check PayPal").
- **The customer pays twice** (two tabs): the second capture sees the order already Paid and returns Paid. PayPal also refuses to capture an already captured order.
- **The PayPal order expired before payment:** `PreparePayPalOrder` creates a new one (next attempt number).
- **Render asleep or restarted:** the first load is slow, and a restart clears the SQLite file. Reset demo makes this a normal state. Record the video locally.
- **`better-sqlite3` fails to build:** use `node:sqlite` behind the same repositories.

## What Was Simplified and Why
- **Demo channel only.** Real WhatsApp is one adapter later; judges can't set up Meta.
- **Read order button** instead of automatic detection: fewer AI calls and timing bugs.
- **Capture on approval instead of webhooks.** The pay page tells our server right away. Webhooks (for disputes and payments outside the page) come later.
- **Full refunds only.**
- **Single seller, sandbox only, fixed shop name.** No login or PayPal account connection (that needs PayPal partner onboarding).
- **SQLite on free hosting,** reset on restart. Postgres later.
- **Polling every 1.5 seconds** instead of live sync.

## Decisions and Open Issues
**From the learner:** build only what PayPal needs, "no extra work that may lead to bugs or unfinished flow"; judges must be able to use it; refunds from the app; a better payment step than a bare link; no money for paid services.

**Decided with the learner (Sat 7 Nov):** keep ports and adapters rather than plain n-tier (payment rules testable without PayPal), and add an append-only order timeline with money entries rather than full event sourcing. The learner: "Yes, add it".

**Decided by the agent at the learner's request:** the two-phone demo page; the Read order button; the pay-for-this-order page; REST instead of the Agent Toolkit at runtime; an agent where the AI proposes, the policy guards and the seller approves; Render hosting.

**To verify at build step 1:** Gemini IDs and limits; the structured-output call; `better-sqlite3` locally and on Render; a sandbox create → approve → capture → refund round trip, recording which payer and shipping fields come back.

**Suggested build order for `5-build`** (today is Sat 7 Nov; deadline Thu 12 Nov, 12:00 pm Pacific):
1. Skeleton, domain classes (including `OrderEvent` and the balance rules), policy and tests (Sat)
2. Storage, and the demo page with both phones chatting, no AI (Sat–Sun)
3. **PayPal first:** gateway, Request payment by hand, pay page, capture, Paid, refund, with a real sandbox round trip (Sun–Mon)
4. Gemini Read order, settling, options and drafts (Mon)
5. Agent proposals (Tue)
6. Orders tab, Reset demo, polish (Tue)
7. Deploy to Render, README, LICENSE (Wed)
8. Video and submission (Wed, with Thu morning as buffer)

PayPal comes before the AI on purpose: it's the part judges score most, and the order card can be filled by hand if the AI step slips.

**If time is short, cut in this order:** the Remind proposal, the payer column in the Orders tab, the AI-written thank-you and refund messages (use fixed text), then the agent (keep the buttons).
