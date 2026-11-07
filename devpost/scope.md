---
doc: scope
status: approved
target: PayPal AI Hackathon (Thu 12 Nov 2026, 12:00 pm Pacific)
---

# chat-to-order: Chat to Paid

Keep selling in your chat. The AI turns the conversation into an order, the customer pays it on a PayPal page that shows exactly what was agreed, and the payment, the customer's address and any refund stay attached to that order. No catalog, no retyping, no matching payments by hand.

## The Unique Kernel
**The conversation becomes the order, and the order becomes the payment.**
1. The AI reads the chat and fills in the order. It marks what's missing and drafts one question. The seller sends it.
2. The seller taps **Request payment**. The app creates a PayPal order **from the order itself** (items, delivery fee, total, order number #1001) and drafts a message with a link to a **pay-for-this-order page**.
3. The customer sees what was agreed and pays with PayPal. Their **name and shipping address come from PayPal**, so the chat doesn't have to ask for them.
4. The order turns **Paid** by itself. A refund is one approved tap in the same order.

The AI also works as a **seller-approved agent**: it reads the chat, proposes the next step (ask a question, request payment, remind, refund), and the seller approves each one. Money actions never run without the seller's tap.

What existing tools miss:
- **Payment links** (PayPal, Stripe): the seller retypes the amount and matches payments to orders by hand.
- **PayPal invoicing:** the seller types every item again, and the invoice is built for email, not chat.
- **Catalog checkouts** (Take App, Shopify, the WhatsApp catalog): they need a product catalog, which most small social sellers don't keep.
- **Chat bots:** a bot talks to the buyer, and buyers prefer people.
- **Order readers** (ZVYA AI, Inbox2Order AI, pasting the chat into ChatGPT): they stop at "here's what I read". Payment isn't connected.

## Who It's For
A one-person or tiny-team seller (for example, clothing) who sells through chat in English, takes payment with PayPal, and has no full online store.
Today they write orders in a notebook, type amounts into payment links, scroll chats to find an address, check PayPal to see who paid, and do refunds by finding the right payment in PayPal.

## The Core Loop
A customer chats an order. The seller taps **Read order**. The card fills in, and a question is drafted for anything the seller still needs. The seller sends it. When the order is complete, the seller taps **Request payment** and sends the drafted link. The customer opens their order page, pays with a PayPal account, and the order turns Paid with their name and address. If the customer later asks to return it, the agent proposes a refund, the seller approves, and the order turns Refunded.
Sellers come back because every paid order is already recorded and matched, with nothing to type and nothing to reconcile.

## Inspiration and Identity
- **Phone-first.** Sellers live on their phones.
- **The seller stays in control.** The AI drafts and proposes; the seller sends and approves. 9 in 10 UAE consumers in a YouGov survey for Zbooni prefer human support ([source](https://seamlessxtra.com/survey-nine-out-of-ten-uae-consumers-prefer-real-human-customer-support-not-ai/)).
- **A pay page you can trust:** shop name, order number, items and total, with PayPal's own buttons. It looks nothing like a bare amount link.
- **A generic chat look.** No WhatsApp, Instagram or Facebook branding.
- Visual style: carried over from the approved PRD (Shopify-calm, iPhone-chat familiar).

## Why This Matters to the Learner
- Co-founded DropX, a B2B dropshipping marketplace in Egypt, and knows the seller side of chat selling.
- Wants a "winning project that can add value", and a possible startup.
- Wants "only what needs to be built for paypal with no extra work that may lead to bugs or unfinished flow".

## What "Working" Looks Like
A judge opens one hosted link. A demo page shows two phones side by side: the **customer chat** on the left and the **seller app** on the right.
1. The judge types an order as the customer ("2 beige linen dresses please").
2. On the seller side, they tap **Read order**. The card fills in and marks the size as Missing. The seller offers S and M, and the drafted question goes out with tap buttons.
3. The customer taps **M**. The seller taps **Request payment**, and the drafted message with the order link goes out.
4. The customer opens the link: "Linen and Co. · Order #1001 · 2 × Beige linen dress (M) · Delivery $8 · Total $128". They pay with the sandbox buyer account.
5. The seller's order turns **Paid**, showing the buyer's name and shipping address from PayPal.
6. The customer writes "can I return them?". The agent proposes **Refund #1001**. The seller approves, and the order turns **Refunded**.

**The "oh, that's cool" beat:** the order turns Paid on its own, already carrying the customer's address, and the refund needs one tap with no searching in PayPal.

## The POC Boundary
- **One demo page, two phones:** a built-in customer chat and the seller app. It's the only message source.
- **Read order** (seller-triggered AI reading): items (product, size or variant, quantity, price) and a delivery fee. Each detail is Found, Missing or Set by you. One total in US dollars.
- **The seller owns what's sold:** types a missing price or size, or offers up to 3 options for the customer to tap.
- **One drafted message at a time.** Only the seller sends.
- **Request payment:** creates the PayPal order from the domain order and a one-time pay page link. Statuses: Draft → Awaiting payment → Paid → Refunded, plus Cancelled before payment.
- **Pay page:** order summary plus PayPal buttons (PayPal sandbox). The server captures the payment and saves the payer's name, email and shipping address.
- **Refund:** full refund only, from the order, after the seller approves.
- **Seller-approved agent:** after each new customer message, the AI proposes at most one next action (ask, request payment, remind, refund). The seller approves or dismisses it.
- **Orders tab:** one row per order with status, total and payer.
- **Hosted** so judges can use it without installing anything, plus local setup instructions in the README.
- Made-up demo data only. API keys and PayPal credentials stay in environment variables, never in the repo.

## Later
- **Real channels:** a WhatsApp Cloud API adapter (the same channel interface), possibly with Meta's "coexistence" so the seller keeps their own WhatsApp Business app (availability not yet verified). Then Instagram and Messenger.
- **Live, automatic reading** as the customer types, instead of the Read order button.
- Unclear details with clashing quotes, and editing items by hand.
- Partial refunds, disputes and chargebacks shown on the order (through PayPal notifications).
- Payments made outside the app (cash, bank transfer).
- A product list, a customers view, and analytics.
- Login and several sellers, each connecting their own PayPal account.

## Explicitly Cut
- **The real WhatsApp test number in this build.** Judges can't easily use it (Meta app, recipient limits, webhooks). The channel interface keeps it one adapter away.
- **Automatic buying detection and live filling.** The seller taps Read order. It's more reliable, cheaper on the free AI tier, and easier to show.
- **Unclear and clash handling, editing items, the wide three-column layout.** Not needed to prove Chat to Paid.
- **Asking for name, phone and address in the chat.** PayPal supplies the name and shipping address at payment.
- **A bare payment link or bank details.** Replaced by the pay-for-this-order page.
- **An autonomous agent.** It never messages customers or moves money without the seller's tap.
- **Product, customer and inventory tables, and analytics.**
- **Arabic chats for now.**
