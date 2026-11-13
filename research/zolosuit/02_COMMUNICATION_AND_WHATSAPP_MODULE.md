# 02. Communication & WhatsApp Messaging Module

## 💬 1. Unified Real-time Inbox (`/business/inbox`)

The Inbox is the operational centerpiece of Zolo Suit. Rather than treating WhatsApp simply as a broadcast blasting engine, it positions WhatsApp as a customer relationship messaging channel:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  Breadcrumb: Dashboard > Inbox                     [Wallet: ₹65.06] [Search] [Profile] │
├───────────────────────────────┬────────────────────────────────────────────────────────┤
│ [Search or start new chat] ➕ │ Select Contact / Active Conversation Header            │
│ [ All ] [ Active ] [ Inactive ]│                                                        │
├───────────────────────────────┤                                                        │
│ 🟢 (KA) Kam Kaura      9:54am │                     Welcome to Inbox!                  │
│    📷 image               [1] │                                                        │
│                               │  Select a contact from the list to start a             │
│ 🟢 (PA) Param Veer     2 days │  conversation. Your messages will appear here.         │
│    Hloo                   [4] │                                                        │
│                               │      [ 💬 Real-time Chat ]                             │
│ 🟢 (91) 919434233224  Nov 5   │      [ 📋 Templates       ]                            │
│    You: 🔥 ₹10,000 ki...      │      [ 🔗 Media Sharing   ]                            │
│                               │                                                        │
└───────────────────────────────┴────────────────────────────────────────────────────────┘
```

### Core UI/UX Mechanics:

1. **Top Filter Segment Control:**
   - **`All`**: Displays the master contact thread history.
   - **`Active`**: Filters contacts with unread messages, recent replies within 72 hours, or active conversation windows.
   - **`Inactive`**: Archives resolved, cold, or dormant contact threads.

2. **Contact Card Presentation:**
   - **Avatar Initials:** Clean circular badge with two-letter uppercase abbreviations (e.g., `KA`, `PA`, `91`), styled with brand blue (`#0c57e4`) or emerald green.
   - **Presence Dot:** Persistent green badge indicating active WhatsApp session connection.
   - **Snippet Previews:** Contextual icons for non-text messages (e.g., `📷 image`, `📄 document`, `🎤 audio`, `🔥 offer tag`).
   - **Unread Counter Pill:** High-contrast pill badge displaying unread inbound messages (`1`, `4`).

3. **Empty State Experience:**
   - Features 3 soft-blue squircle icon cards:
     - **Real-time Chat:** Instant bidirectional messaging.
     - **Templates:** Pre-approved WhatsApp message templates with dynamic merge tags (`{{name}}`, `{{company}}`).
     - **Media Sharing:** Document and image attachment handling.

---

## 📱 2. WhatsApp Accounts Management (`/business/whatsapp-accounts`)

Manages the lifecycle of connected WhatsApp phone numbers:

- **Connection Modes:** Multi-device WhatsApp Web QR code pairing and Phone Pairing Code (`OTP`).
- **Session Health Telemetry:**
  - Real-time status: `CONNECTED`, `CONNECTING`, `DISCONNECTED`, `PAIRING`.
  - Phone metadata: Phone number, WhatsApp Display Name, Profile picture, Battery percentage, Wi-Fi / Cellular state.
- **Warmup & Pacing:** Instance tagging indicating warmup stage (New number, Warmed up, High throughput).

---

## 📁 3. Media Library (`/business/media-library`)

Centralized digital asset management (DAM) for broadcast and reply collateral:

- **Supported Formats:** JPEG, PNG, MP4, WebM, PDF, MP3/OGG voice notes.
- **Cloud Delivery:** Assets uploaded directly to S3 object storage; campaigns reference immutable CDN URLs, avoiding server bandwidth saturation.
- **Folders & Tagging:** Organization by festive campaigns, product lines, and legal/onboarding documents.

---

## 🛑 4. Opt Management (`/business/opt-management`)

Automated compliance and anti-ban safeguards:

- **Automatic Opt-Out Keywords:** Detection of `STOP`, `UNSUBSCRIBE`, `REMOVE`, `CANCEL`, `DON'T MSG`.
- **Immediate Blacklist Placement:** Contacts texting opt-out triggers are immediately quarantined from all future campaigns.
- **Opt-in Re-activation:** Mechanism for users who previously opted out to re-subscribe via keyword `START` or `UNSTOP`.

---

## ⚡ 5. Quick Replies (`/business/quick-replies`)

Productivity accelerator for support and sales representatives:

- **Shortcut Triggers:** Triggered by typing slash commands in the chat bar (e.g., `/pricing`, `/address`, `/bank`, `/demo`).
- **Rich Content:** Quick replies support pre-attached catalog PDFs and image brochures alongside formatted text.
- **Categorization:** Organized by department (Sales, Technical Support, Onboarding, Billing).

