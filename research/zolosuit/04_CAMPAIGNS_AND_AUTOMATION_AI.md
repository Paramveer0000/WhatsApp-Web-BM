# 04. Broadcast Campaigns & Automation AI Engine

## 📢 1. Broadcast Campaigns (`/business/campaigns`)

Zolo Suit's broadcast engine emphasizes compliance, warmup rotation, and scheduled deliverability:

```
[ New Broadcast Campaign ]
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 1. Campaign Name & Target Instances (Multi-instance warmup selection)          │
│ 2. Audience Selection (Lists, Tags, Filtered segments)                          │
│ 3. Message Composition:                                                         │
│    - Spintax variation support: {Hello|Hi|Greetings} {{name}}                   │
│    - Media attachment (Selected from Media Library)                             │
│    - Dynamic variable substitution                                              │
│ 4. Pacing & Schedule:                                                           │
│    - Random delay window (e.g. 10 - 25 seconds between sends)                   │
│    - Active sending hours (e.g. 09:00 AM - 08:00 PM)                            │
│    - Daily instance send cap (e.g. Max 300 messages / day / number)             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Telemetry & Analytics Dashboard:
- **Real-time Funnel:** `Targeted` ➔ `Sent` ➔ `Delivered` ➔ `Read` ➔ `Replied` ➔ `Failed`.
- **Response Attribution:** Replies are tagged back to the campaign ID that triggered them, calculating response rates and customer acquisition cost.
- **Exportable Logs:** Download delivery reports in CSV/Excel with error codes and instance attribution.

---

## 🤖 2. Automation & Chatbot Studio (`/business/automation`)

The visual automation engine enables businesses to build 24/7 conversational funnels without code:

### Core Trigger Types:
- **Keyword Trigger:** Exact match or regex detection (e.g. `PRICING`, `DEMO`, `OFFER`).
- **First Message:** Fires when an unknown contact messages for the first time.
- **Campaign Reply:** Triggers when a contact replies to a specific broadcast.
- **Any Message / Fallback:** Default catch-all when no other rules match.

### Flow Logic Nodes:
- **Interactive Question / Input Capture:** Prompts the user (e.g. "What is your company name?") and saves response into a contact attribute or CRM lead deal.
- **Conditional Branching (If/Else):** Evaluates user replies or customer attributes (`leadScore > 50` or `city == 'Mumbai'`).
- **Business Hours Gate:** Checks current time against operational hours (routes to live agent if open, or auto-reply if closed).
- **External Webhook Dispatch:** Posts data to external CRMs (HubSpot, Zoho, Zapier, Webhook.site) via HTTP POST.

---

## 🧠 3. AI Auto-Responders & LLM Integration

Zolo Suit incorporates generative AI for conversational customer support:

- **Knowledge Base Retrieval (RAG):** Businesses upload FAQs, company policies, and price lists. The AI answers customer inquiries based strictly on ground truth.
- **Human Handoff Trigger:** If the customer expresses frustration, asks for a human, or requests a commercial quote, the bot transitions session status to `handoff`, pauses AI replies, and notifies the human team.
- **Safety Rails & Spend Control:** Token budget caps prevent unexpected API credit depletion.
