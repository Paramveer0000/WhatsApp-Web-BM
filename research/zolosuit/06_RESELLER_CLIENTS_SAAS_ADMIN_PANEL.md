# 🏢 Zolo Suit Reseller Clients SaaS Admin Panel — Reverse Engineering (REA) Report

**Target Route:** `https://zolosuit.com/reseller/clients`  
**Core Framework:** `simplefloww` Enterprise White-Label Engine  
**Analysis Method:** REA Codebase & Turbopack Chunks Decompilation (`0bijz_-5dhf8z.js`, `05y22fc4fc837.js`, `0-336q_c2xt-2.js`)  
**Scope:** SaaS Reseller Portal, Client Lifecycle Management, Multi-Tenancy, Impersonation & Billing  

---

## 🏗️ 1. Three-Tier Architectural Hierarchy

The decompiled client auth module in `0bijz_-5dhf8z.js` reveals an enterprise **3-tier hierarchical actor model**:

```
                       ┌─────────────────────────────────────┐
                       │       TIER 1: PLATFORM ADMIN        │
                       │   USER_TYPE: "PlatformUser"         │
                       │   Path: /sadmin/dashboard           │
                       │   Role: Infrastructure & Host Node  │
                       └──────────────────┬──────────────────┘
                                          │
                                          ▼
                       ┌─────────────────────────────────────┐
                       │       TIER 2: SAAS RESELLER         │  ◄── [TARGET UNDER REA]
                       │   USER_TYPE: "CompanyUser"          │      https://zolosuit.com/reseller/clients
                       │   Path: /reseller/clients           │
                       │   Role: White-label SaaS Operator   │
                       └──────────────────┬──────────────────┘
                                          │
                                          ▼
                       ┌─────────────────────────────────────┐
                       │     TIER 3: END BUSINESS CLIENT     │
                       │   USER_TYPE: "BusinessUser"         │
                       │   Path: /business/dashboard         │
                       │   Role: WhatsApp Operations & CRM   │
                       └─────────────────────────────────────┘
```

```javascript
// Decompiled from 0bijz_-5dhf8z.js
let USER_TYPES = {
  BUSINESS: "BusinessUser",    // End client (/business/dashboard)
  RESELLER: "CompanyUser",     // SaaS Reseller Admin (/reseller/clients)
  ADMIN: "PlatformUser"        // Master Infrastructure Owner (/sadmin/dashboard)
};

function getDashboardPath(userType) {
  return userType === USER_TYPES.RESELLER
    ? "/reseller/dashboard"
    : userType === USER_TYPES.ADMIN
    ? "/sadmin/dashboard"
    : "/business/dashboard";
}
```

---

## 📊 2. Decompiled Feature Blueprint of `/reseller/clients`

The Reseller Clients module functions as the **mission control center** where an agency/reseller provisions, monitors, bills, and supports their downstream business clients.

### 2.1. Client Directory Table
| Column / Field | Data Type | Function & Interaction |
|---|---|---|
| **Client / Company** | String + Logo | Company Name, Client ID (`companyId`), and branding avatar. |
| **Owner / Contact** | Object | Admin user name, registered email address (`email`), and phone number (`contactNo`). |
| **Subscription Plan** | Badge | Active tier badge (e.g. *Starter*, *Professional*, *Enterprise*, *Custom VIP*). |
| **Instance Quota** | Metric Badge | Active vs. Max WhatsApp Accounts allocated (e.g., `2 / 5 connected`). |
| **Credits / Wallet** | Numeric (₹ / Units) | Prepaid message balance or monthly broadcast volume allowance. |
| **Status** | Status Pill | `ACTIVE` (Green), `SUSPENDED` (Red), `TRIAL` (Amber), `EXPIRED` (Slate). |
| **Created / Renewal** | Date | Onboarding date and next renewal deadline with countdown warning. |
| **Actions** | Action Menu | **1-Click "Login as Client" (Impersonate)**, Edit Limits, Top-up Credits, Reset Password, Suspend/Delete. |

---

### 2.2. Critical Feature Modules

#### 🔑 A. 1-Click "Login as Client" (Impersonation Session)
- **Functionality:** Allows the reseller admin to log directly into any downstream client’s `/business/dashboard` without requiring the client's password.
- **Implementation Mechanism:** Generates a short-lived scoped JWT impersonation token (`impersonatedCompanyId`, `impersonatedUserId`, `role: 'ADMIN_ON_BEHALF'`) stored in a dedicated header or cookie, with a floating top-bar:  
  `"Viewing as [Client Company Name] — [Exit Impersonation]"`.

#### ➕ B. "Create / Onboard New Client" Modal
- **Company Identity:** Business Legal Name, Brand Display Name, Subdomain/Slug.
- **Client Credentials:** Owner Full Name, Admin Email, Initial Password, Phone.
- **Plan & Resource Quota Assignment:**
  - Max Allowed WhatsApp Connected Instances (e.g. 1, 3, 10).
  - Monthly Message Cap (e.g. 10,000 / month, or Unlimited).
  - Feature Access Toggles:
    - [x] CRM Lead Sales Pipeline
    - [x] Chatbot Visual Studio Canvas
    - [x] Multi-Instance Warmup & Rotation Engine
    - [x] Digital Asset Management (Media Library DAM)
    - [x] AI Auto-Responders (OpenAI / Gemini integration)

#### 🎨 C. White-Label Branding Engine (`TenantProvider` / `useTenant`)
Extracted directly from `05y22fc4fc837.js`:
```typescript
interface TenantState {
  companyId: string;
  tenantName: string;
  brandColor: string;               // e.g. "#0c57e4" (Royal Blue)
  logoUrl: string;
  favIcon: string;
  appleTouchIcon: string;
  supportEmail: string;
  supportPhone: string;
  supportAddress: string;
  enableResellerPaymentGateway: boolean;
  enableBusinessPaymentGateway: boolean;
  objectStorageBucketUrl: string;   // CDN / S3 Bucket endpoint
}
```
- **White-Label Capabilities:**
  - Custom branding colors injected into CSS root: `--primary: #0c57e4`.
  - Custom portal domain (CNAME mapping).
  - Dynamic login page background, custom favicon, and custom support contact info.

#### 💳 D. Dual-Tier Payment & Wallet Billing
- **Reseller Gateway:** The reseller connects Razorpay / Stripe to charge their clients for monthly/annual SaaS subscription plans.
- **Client Top-up Gateway:** Downstream clients top up prepaid credits for high-volume messaging or premium add-ons directly through the reseller's gateway.

---

## 🛠️ 3. Proposed Database Schema for BulkFlow

To implement this exact Reseller / SaaS Client Administration system in BulkFlow:

```prisma
// Multi-Tenant Reseller & Client Management Schema
model ResellerClient {
  id              String    @id @default(cuid())
  companyName     String
  slug            String    @unique
  ownerName       String
  ownerEmail      String    @unique
  ownerPhone      String?
  passwordHash    String
  
  // Subscription & Tier
  planName        String    @default("Starter") // "Starter", "Growth", "Enterprise", "Custom"
  status          String    @default("ACTIVE")  // "ACTIVE", "SUSPENDED", "TRIAL", "EXPIRED"
  billingCycle    String    @default("MONTHLY") // "MONTHLY", "ANNUAL", "LIFETIME"
  price           Float     @default(0)
  currency        String    @default("INR")
  renewalDate     DateTime?
  
  // Resource Quotas
  maxInstances    Int       @default(1)
  maxContacts     Int       @default(5000)
  monthlyMsgCap   Int       @default(10000)
  walletBalance   Float     @default(0)
  
  // Feature Access Flags
  hasCrmPipeline  Boolean   @default(true)
  hasChatbot      Boolean   @default(true)
  hasMultiWarmup  Boolean   @default(true)
  hasDamMedia     Boolean   @default(true)
  hasAiResponder  Boolean   @default(false)
  
  // White-Label Customization
  customDomain    String?
  brandColor      String    @default("#0c57e4")
  logoUrl         String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([status])
  @@index([ownerEmail])
}
```

---

## 🚀 4. Proposed Implementation Steps for BulkFlow

1. **Backend Database:** Add `ResellerClient` model with runtime self-healing auto-migration in `src/lib/db.ts`.
2. **API Routes:**
   - `GET /api/reseller/clients` — Paginated list, search, status filter, and aggregate client metrics.
   - `POST /api/reseller/clients` — Provision new client account with assigned quotas.
   - `PUT /api/reseller/clients/[id]` — Edit plan, change quotas, top-up balance, or toggle suspension.
   - `POST /api/reseller/clients/[id]/impersonate` — Generate 1-click token to log in as client.
3. **Frontend UI View (`src/components/reseller/ResellerClientsView.tsx`):**
   - KPI metrics cards: Total Clients, Active Subscriptions, Total Monthly Revenue (₹ MRR), Total Connected Instances.
   - Filter bar: Status pill tabs (All, Active, Trial, Suspended), Search input, "+ Add New Client" button.
   - Interactive client cards / data table with Zolo Suit royal blue styling.
   - "Add Client" & "Impersonate" modal dialogs.
4. **Navigation Integration:** Add dedicated **SaaS Reseller** menu section to sidebar for users with `ADMIN` or `RESELLER` privileges.

