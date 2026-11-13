# 05. Evaluation Matrix & Implementation Plan for BulkFlow

## 📊 1. Comprehensive Feature Evaluation Matrix

| Capability / Module | Zolo Suit (Benchmark) | BulkFlow (Current State) | Evaluation & Action Plan |
|---|---|---|---|
| **Multi-instance Warmup & Rotation** | Basic instance selector | Advanced Circuit Breaker, auto-failover, Spintax variation, adaptive rate-limiting | **BulkFlow Leads** (Keep & reinforce existing engine) |
| **Unified Live Inbox** | Dual-pane, filter tabs (`All`, `Active`, `Inactive`), avatar initials, presence dots, unread counters | Implemented dual-pane live sync, day-mode WhatsApp bubbles, status pills | **Parity Achieved** (Align with Zolo Suit's sub-navigation hierarchy) |
| **Sales CRM Pipeline** | 5-stage Kanban board with ₹ aggregation, deal priority, direct WhatsApp trigger | Implemented `LeadDeal` model, 5-stage Kanban, live value sum, instant chat launch | **Parity Achieved** (Ready for contact linking) |
| **Media Library DAM** | S3 object storage upload, asset reuse | File attachment from local disk / single upload | **Phase 1 Implementation Target** |
| **Opt & Compliance Management** | Inbound STOP / UNSUBSCRIBE keyword suppression | Implemented blacklist table, auto-optout keywords | **Parity Achieved** |
| **Task Management** | Due dates, team assignment, follow-up alerts | Not yet present | **Phase 2 Implementation Target** |
| **Visual Chatbot Flow Builder** | Node-based drag and drop builder | React Flow builder with 14 node types, simulator, Day/Night canvas support | **Parity Achieved** (Chatbot Studio is fully functional) |
| **Security & SSRF Hardening** | Unknown (Closed source cloud) | Enterprise SSRF protection, strict RBAC, CSV formula neutralization, audit logs | **BulkFlow Leads** (Hardened in previous turn) |

---

## 🚀 2. Phased Implementation Roadmap for BulkFlow

### Phase 1: Navigation Hierarchy & Sub-Menu Restructuring (Quick Wins)
- **Objective:** Group BulkFlow's expanding features into clean logical parent categories like Zolo Suit to reduce sidebar clutter:
  - **Dashboard:** Overview metrics, active campaigns, quick start wizard.
  - **Communication:** Group `Replies Inbox`, `WhatsApp Instances`, `Quick Replies`, and `Media Library` under one accordion.
  - **Campaigns:** Broadcast wizard, scheduled queue, delivery reports.
  - **CRM & Leads:** Group `Lead Pipeline (Kanban)`, `Contacts`, `Lists`, and `Tags`.
  - **Automation:** Chatbot Studio, AI Advisor, Inbound rules.
  - **Settings & System:** System logs, API Keys, Evolution config, Guardrails.

### Phase 2: Centralized Media Library Asset DAM
- **Objective:** Build `/api/media/library` and frontend gallery:
  - Users can upload images, videos, and brochures once and tag them (e.g. "Festive Offer Banner", "Product Catalog PDF").
  - Campaign wizard and chat replies can pick assets directly from the gallery with 1-click instead of re-uploading from local computer.

### Phase 3: Task Management & Follow-up Scheduling
- **Objective:** Build lightweight follow-up task tracking:
  - Add `Task` model in `prisma/schema.prisma` with `dealId`, `contactPhone`, `dueDate`, `title`, `isCompleted`.
  - Display "+ Follow-up Reminder" on Kanban deal cards and Inbox contact details.

### Phase 4: S3 / Cloud Object Storage Adapter (Optional)
- **Objective:** Allow operators to plug in AWS S3, Cloudflare R2, or Hetzner Object Storage credentials in Settings so media files are served through global CDNs.

