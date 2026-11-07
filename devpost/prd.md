---
doc: prd
status: approved
target: PayPal AI Hackathon (Thu 12 Nov 2026, 12:00 pm Pacific)
---

# chat-to-order: Chat to Paid — Product Requirements

The conversation becomes the order, and the order becomes the payment. The seller approves every step.
Source: `scope.md > The Unique Kernel`.

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. **Open the demo.** The judge opens the hosted link. The demo page shows two phones: **Customer** (left) and **Linen and Co. — Seller** (right). A one-line guide on top: "Type an order as the customer, then run the shop on the right." A **Reset demo** link clears everything.
2. **The customer writes.** They type, for example, "hi, 2 of the beige linen dress please". The message appears in both phones within about 2 seconds.
3. **Read order.** On the seller phone, the conversation shows a **Read order** button. The seller taps it. The order card opens and fills in: product, quantity and price, each marked **Found**, **Missing** or **Set by you**, with the quoted message it came from.
4. **Settle what's sold.** Size is Missing. The seller ticks **Ask customer** and offers S and M (up to 3 options), or types the value. A missing price can only be typed by the seller. The seller sets the delivery fee.
5. **The drafted question.** The reply box holds an AI draft that asks only for what's still missing, with the options as tap buttons. The seller presses **Send**. The order becomes **Waiting for customer**.
6. **The customer answers.** They tap **M**. The order fills in. When nothing is missing, the agent proposes **Request payment**.
7. **Request payment.** The seller taps it (or approves the agent's proposal). The app freezes the order card, creates its pay link, and drafts a message: "Here's your order #1001, total $128. Pay securely here: [link]". The seller presses **Send**. The order becomes **Awaiting payment**.
8. **The customer pays.** They tap the link in their chat. The **pay page** opens in a new tab: shop name, order number, each item with size, quantity and price, the delivery fee, the total, and PayPal's buttons. They pay with the sandbox buyer account and see "Paid. Thank you!".
9. **Paid.** Within about 2 seconds, the seller's order shows **Paid**, with the buyer's name, email and shipping address from PayPal, and the PayPal transaction ID. A thank-you message is drafted for the seller to send.
10. **The customer asks for a refund.** They write "sorry, can I return them?". The agent proposes **Refund #1001 · $128** with its reason quoted. The seller taps **Approve refund** and confirms.
11. **Refunded.** The order shows **Refunded** with the refund ID, and a short refund message is drafted for the seller to send. The order's timeline now reads: read by AI → size from customer → payment requested (approved by you) → +$128.00 paid → refund proposed by agent → −$128.00 refunded (approved by you) → balance $0.00.
12. **Orders tab.** Every order as one row: number, customer, items, total, status, payer, date.

## Screens and Layout

### Demo page (`/`)
- **Wide screens (judges' laptops):** two phone frames side by side, Customer left and Seller right, about 390 × 760 each.
- **Phones:** a switch at the top flips between Customer and Seller.
- Small notes under the frames: "Payments use PayPal's sandbox. No real money." and the sandbox buyer login hint (the login itself goes in the submission notes, not the repo).

### Customer phone
- A generic chat with "Linen and Co.": bubbles, times and a text box. Buttons appear under a seller message when options are offered. Payment links show as a link card ("Order #1001 · $128 · Pay with PayPal").
- **New customer** starts a second conversation under a different made-up name.

### Seller phone
- **Inbox (tab):** one row per customer: name, last message, time, status badge (Chatting, Draft, Waiting for customer, Awaiting payment, Paid, Refunded, Cancelled). Rows with an agent proposal show a blue dot and come first.
- **Conversation:** header with the customer's name. An **order bar** on top when an order exists ("#1001 · $128 · Awaiting payment"); tapping it opens the order card. Messages in the middle. An **agent proposal card** above the reply box when there is one ("Request payment for #1001?" with **Approve** and **Dismiss**). Then the reply box with the draft and **Send**. A **Read order** button when there's no order yet, or new messages since the last reading.
- **Order card (bottom sheet):** What's being sold (items, delivery fee), the total, then **Payment**: status, link (copy), payer name, email, shipping address, PayPal IDs. Buttons depend on status: **Request payment**, **Cancel order**, **Refund**. At the bottom, the order's **Timeline**: every step with who did it and when, and money lines with amounts (+$128.00 paid, −$128.00 refunded), plus the order's balance.
- **Orders (tab):** the list described in step 12.

### Pay page (`/pay/[token]`)
- Shop name, "Order #1001", items, delivery, total in US dollars, PayPal buttons. A line: "Your name and delivery address come from your PayPal account."
- After payment: "Paid. Thank you!" with the order number. If opened again: "This order is already paid." If the order was cancelled: "This order was cancelled by the shop."

## Look and Feel
Carried over from the approved PRD (learner: "i like the ui of shopify … the whats app ui as in iphone").
- Calm, Shopify-admin style: page #F1F1F1, white cards with 12px corners and thin borders, small pill badges.
- iPhone-messaging chat: customer bubbles white with a border, seller bubbles ink (#1A1A1A) with white text.
- **AI blue (#4A5BD6) only for what the AI wrote or proposes:** the Draft chip, the dashed draft outline, the agent proposal card.
- Status colours: Found soft green, Missing soft red with a tinted row, Set by you gray. Paid green, Awaiting payment amber, Refunded gray, Cancelled gray with a strikethrough total.
- The pay page uses the same calm card style with PayPal's official buttons, unchanged.
- The system font. No WhatsApp green, no platform logos, no gradients or glowing AI effects.

## Features and Behavior

### Chat (customer ↔ seller)
- [ ] A customer message appears on both phones within about 2 seconds.
- [ ] Seller messages show option buttons when options were offered. Tapping one sends that option as the customer's reply.
- [ ] Payment links show as a link card that opens the pay page in a new tab.
- [ ] **Only the seller sends** seller messages. Nothing is sent automatically.

### Read Order
- [ ] **Read order** sends the conversation (since the last finished order) to the AI and fills in the card.
- [ ] Items: product, size or variant, quantity, unit price. Several items are supported.
- [ ] Each detail shows Found (with the quoted message), Missing ("Never mentioned") or Set by you.
- [ ] The AI never invents a price. A price not written in the chat is Missing.
- [ ] Values the seller set are never overwritten by a later reading.
- [ ] If the AI fails or times out: "Couldn't read this conversation. Try again." The seller can retry or type the details.
- [ ] The button reappears ("Read again") when new customer messages arrived after the last reading.

### Settling What's Sold
- [ ] The seller can type any item value or the delivery fee.
- [ ] **Ask customer** offers up to 3 options for a missing detail (not for price).
- [ ] The total = sum of quantity × unit price + delivery fee, in US dollars, shown on the card at all times.

### Drafted Message
- [ ] There's one draft at a time in the reply box, labelled **Draft**. The seller can edit it before sending.
- [ ] Drafts ask only for what's still missing, in one short friendly message in the shop's voice.
- [ ] After **Request payment**, the draft contains the order number, the total and the pay link.
- [ ] After Paid and after Refunded, a short thank-you or refund message is drafted.
- [ ] Pressing Send twice sends once.

### Seller-Approved Agent
- [ ] After each new customer message (and after Read order), the agent proposes **at most one** next action: **Ask** (missing details), **Request payment** (nothing missing, not yet requested), **Remind** (awaiting payment and the customer wrote without paying), **Refund** (paid, and the customer asks to return or cancel).
- [ ] Each proposal shows a one-line reason quoting the customer's message where relevant.
- [ ] **Approve** runs the action. **Dismiss** hides it until the next customer message.
- [ ] The agent can't move money or send messages without the seller's tap. Amounts always come from the order card, never from the AI.
- [ ] If the AI is unavailable, the buttons on the order card still work.

### Request Payment
- [ ] Available only when nothing is missing and the total is above $0.
- [ ] Freezes the items and the total and creates a one-time pay link. When the customer pays, the PayPal order (sandbox) carries the items, the delivery fee as shipping, the total in USD, and the order number as the reference.
- [ ] Pressing it twice creates one pay link, and paying never charges twice.
- [ ] The order becomes **Awaiting payment**, and the order card shows the pay link.
- [ ] Items can't be changed after payment is requested. To change them, the seller cancels the order and starts a new one.

### Pay Page
- [ ] Shows the order exactly as on the seller's card: items, delivery, total, shop name, order number.
- [ ] Pays with PayPal's buttons in the sandbox. The payer's name and shipping address come from their PayPal account.
- [ ] The server confirms (captures) the payment and checks the amount matches the order before marking it Paid.
- [ ] A second open of a paid order shows "already paid" with no buttons. A cancelled order shows "cancelled".
- [ ] If the customer closes PayPal's window without paying, the page stays as it was and they can try again.
- [ ] If the payment is declined: "PayPal couldn't take this payment. Please try again."

### Paid
- [ ] The order shows **Paid** within about 2 seconds of payment, with payer name, email, shipping address and the PayPal transaction ID.
- [ ] The payer's name replaces the chat name on the order (the chat name is kept on the conversation).

### Refund
- [ ] Available only on Paid orders. Full refund only.
- [ ] Asks for confirmation: "Refund $128 to Sarah Lee? This can't be undone."
- [ ] Pressing it twice refunds once.
- [ ] The order shows **Refunded** with the refund ID.
- [ ] If PayPal refuses (for example, past the refund window): the reason is shown, and the order stays Paid.

### Order Timeline
- [ ] Every change to an order adds one line: what happened, who did it (Customer, AI, Agent, You, PayPal), the time, and a quote where it helps ("can I return them?").
- [ ] The lines include: order read, details set, question sent, payment requested, paid, refund proposed, proposal approved or dismissed, refunded, refund failed, cancelled.
- [ ] Agent proposals show whether the seller approved or dismissed them.
- [ ] Money lines show the amount: **+$128.00** paid, **−$128.00** refunded, and PayPal's fee and the net received when PayPal reports them.
- [ ] A **Balance** line shows paid minus refunded. Paid ⇒ the balance equals the order total; Refunded ⇒ $0.00.
- [ ] Lines are never edited or removed; the timeline only grows.

### Cancel
- [ ] Available before payment. The pay page then shows "cancelled" and can't take payment.

### Orders Tab
- [ ] One row per order, newest first: number, customer, item summary, total, status, payer, date.
- [ ] Tapping a row opens that conversation with the order card.

### Demo Data and Reset
- [ ] **Reset demo** clears conversations and orders and restarts numbering at #1001.
- [ ] Data survives a page refresh.

## States and Boundaries
- **Empty:** the seller Inbox says "No messages yet. Type as the customer on the left."
- **AI busy:** "Reading the conversation…" on the card. Buttons are disabled meanwhile.
- **AI free-tier limit reached:** "The AI is busy. Try again in a minute." Manual settling and payment still work.
- **PayPal unreachable:** "PayPal is not responding. Try again." Nothing changes on the order.
- **Payment made but the seller's screen was closed:** opening it later shows Paid.
- **Hosted app asleep (free hosting):** the first open may take up to a minute. The demo notes say so.
- **Order statuses:** Draft ↔ Waiting for customer → Awaiting payment → Paid → Refunded. Draft, Waiting or Awaiting payment → Cancelled.

## Product Decisions
- **Name: chat-to-order**, shop **"Linen and Co."**, orders from **#1001**, US dollars with a delivery fee. Carried over from the approved PRD.
- **Chat to Paid is the whole product for this build.** The learner: build "only what needs to be built for paypal".
- **A demo page with two phones, not real WhatsApp.** Judges must be able to use it, and the learner wanted "something that judges can use".
- **Read order button instead of automatic detection.** Fewer moving parts, fewer AI calls on the free tier.
- **A pay-for-this-order page instead of a bare link.** It fixes the trust, "what am I paying for" and wrong-amount problems the learner asked about.
- **Name and address from PayPal.** The chat asks only about what's sold.
- **Refunds inside the app.** The learner asked "cant we do it from our app".
- **A seller-approved agent, not an autonomous one.** It qualifies the project for agentic commerce while keeping money actions safe.
- **Full refunds only.** Partial refunds are Later.
- **Statuses plus an order timeline with money lines, not full event sourcing.** It records who approved what (trust in the agent) and keeps paid and refunded amounts adding up, without rebuilding orders from events. The learner: "Yes, add it".

## What We're Building
- The demo page with the customer phone and the seller phone.
- Read order, settling, offered options, one draft at a time, seller-only sending.
- The seller-approved agent with four proposals: Ask, Request payment, Remind, Refund.
- Request payment, the pay page with PayPal buttons, server-side capture, Paid with PayPal's payer details.
- Full refund and cancel.
- The order timeline with money lines and a balance.
- The Orders tab, Reset demo, and a hosted URL.

## Deferred From the POC
- **Real WhatsApp, Instagram, Messenger:** need Meta setup that judges can't do. One adapter each, later.
- **Automatic reading as the customer types:** more AI calls, more timing bugs.
- **Unclear and clashing details, editing items:** not needed for Chat to Paid.
- **Partial refunds, disputes, chargebacks:** need PayPal notifications (webhooks).
- **Payments outside the app, login, several sellers, settings.**

## Non-Goals
- No messages or money moved without the seller's tap.
- No product catalog or browsing.
- No bare payment links or bank details.
- No platform branding.
- No analytics dashboards.

## Open Questions
- **PayPal's refund rules:** the developer docs say refunds must be within 180 days of payment. Whether PayPal returns its fee on a refund isn't confirmed; it doesn't affect the sandbox demo.
- **The payer details in the capture response:** expected (name, email, shipping address). Verify with the first sandbox call in the build.
