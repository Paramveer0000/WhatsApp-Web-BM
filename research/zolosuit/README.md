# 🔬 Reverse Engineering & Research Report: Zolo Suit (SimpleFloww Engine)

**Target System:** `https://zolosuit.com/business/dashboard`  
**Core Codebase Identity:** `simplefloww` Enterprise Reseller Portal  
**Date of Investigation:** November 13, 2026  
**Auditor:** Antigravity REA Engine & Platform Architecture Team  
**Evaluation Scope:** Reverse engineering client bundles, UI components, multi-tenant state, communication workflows, CRM pipelines, campaign automation, and architectural comparison against BulkFlow.

---

## 📂 Research Document Directory

| Document | Focus Area | Description |
|---|---|---|
| [`01_ARCHITECTURE_AND_TECH_STACK.md`](./01_ARCHITECTURE_AND_TECH_STACK.md) | Technical Architecture | Next.js Turbopack build, runtime tokens, multi-tenancy, object storage, and styling paradigms. |
| [`02_COMMUNICATION_AND_WHATSAPP_MODULE.md`](./02_COMMUNICATION_AND_WHATSAPP_MODULE.md) | Real-time Communication | Unified Inbox (`/inbox`), WhatsApp Accounts, Media Library, Opt Management, and Quick Replies. |
| [`03_CRM_LEADS_AND_TASK_MANAGEMENT.md`](./03_CRM_LEADS_AND_TASK_MANAGEMENT.md) | CRM & Task Engine | 5-stage Kanban Lead Pipeline, dynamic attributes, customer tags, task reminders, and follow-up tracking. |
| [`04_CAMPAIGNS_AND_AUTOMATION_AI.md`](./04_CAMPAIGNS_AND_AUTOMATION_AI.md) | Broadcasts & AI Flows | Broadcast sequences, warmup pacing, chatbot visual studio, OpenRouter/LLM triggers, and webhook integrations. |
| [`05_IMPLEMENTATION_AND_EVALUATION_PLAN.md`](./05_IMPLEMENTATION_AND_EVALUATION_PLAN.md) | Roadmap for BulkFlow | Gap analysis, evaluation metrics, and prioritized implementation plan for BulkFlow. |

---

## 🌟 Executive Summary & Key Discoveries

1. **White-label Multi-tenant Foundation:**
   - Zolo Suit is a white-label reseller tenant running on the **`simplefloww`** core platform engine.
   - Company ID: `6a9bfc802e228bcebe737f41`
   - Tenant branding is injected via server cookies and hydration props: `#0c57e4` (Royal Blue), Inter font, full-width content layout, inset collapsible sidebar.
   - S3-compatible Object Storage bucket: `https://gagan.nbg1.your-objectstorage.com/simplefloww`.

2. **Unified Communication Sub-Suite:**
   - Unlike basic WhatsApp bulk senders, Zolo Suit organizes messaging under a dedicated **Communication** module with 5 core views:
     - **Inbox:** Real-time dual-pane live chat with status tabs (`All`, `Active`, `Inactive`), avatar initials, and unread pill counters.
     - **WhatsApp Accounts:** Instance management supporting multi-session QR scanning and state monitoring.
     - **Media Library:** Centralized repository for broadcast assets (images, documents, videos).
     - **Opt Management:** Compliance engine handling opt-in and STOP/UNSUBSCRIBE keywords.
     - **Quick Replies:** Canned response snippets with keyboard shortcuts.

3. **Integrated Sales CRM & Task Tracking:**
   - CRM is deeply intertwined with WhatsApp: Deals show contact phone numbers, instant chat launch buttons, priority badges, and stage progression.
   - Financial aggregation in ₹ (INR) calculates real-time pipeline values and conversion metrics.
   - Task management provides team assignees, deadlines, and WhatsApp follow-up triggers.

4. **Strategic Alignment with BulkFlow:**
   - BulkFlow already possesses stronger backend guardrails (circuit breakers, anti-ban pacing, Spintax variation, automated webhook recovery).
   - Adopting Zolo Suit's intuitive hierarchy, modular sub-navigation, and cohesive Day Mode UI elevates BulkFlow into an enterprise-ready CRM & WhatsApp marketing powerhouse.

