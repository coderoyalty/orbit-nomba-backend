# 🌌 Orbit — Managed Recurring Billing Engine (Stripe Billing for Africa)

Orbit is a developer-first subscription management and recurring billing engine built on top of the **Nomba Checkout & Card Tokenization APIs**. It acts as a self-hosted billing engine (akin to Stripe Billing) tailored for African merchants, allowing them to define custom pricing tiers, automate card tokenization, run scheduled renewals, implement dunning retries, verify webhooks, and launch self-service billing portals.

---

## 🚀 System Architecture

Orbit is built as a highly scaleable, decoupled monorepo composed of two main backend services and a shared utility library layer:

```
                          ┌────────────────────────┐
                          │     Orbit Dashboard    │ (Vite / React SPA)
                          └───────────┬────────────┘
                                      │ (HTTP Requests)
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│ NestJS Monorepo (Backend)                                              │
│                                                                        │
│   ┌───────────────────────┐             ┌──────────────────────────┐   │
│   │     core-api          │             │       core-worker        │   │
│   │  (REST API Server)    │             │ (Queue Consumer / Cron)  │   │
│   └───────────┬───────────┘             └────────────┬─────────────┘   │
│               │                                      │                 │
│               └───────────────┬──────────────────────┘                 │
│                               │ (DB Queries & Jobs)                    │
│                               ▼                                        │
│                 ┌─────────────┴─────────────┐                          │
│                 │   Shared Library Layer    │                          │
│                 │   • @app/database         │                          │
│                 │   • @queue/queue          │                          │
│                 │   • @orbit/nomba          │                          │
│                 └─────────────┬─────────────┘                          │
└───────────────────────────────┼────────────────────────────────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 │       Infrastructure        │
                 │   • Postgres (Database)     │
                 │   • Redis (BullMQ Broker)   │
                 └─────────────────────────────┘
```

- **`core-api` (REST API Server):** Handles merchant authentication, dashboard configuration changes, portal sessions, and public developer endpoints (e.g. subscription initialization).
- **`core-worker` (Queue Consumer):** Runs background jobs using **BullMQ** (powered by Redis) to execute automated subscription renewals, payment retry rules (dunning), and dispatch secure webhook events.
- **Shared Libraries:**
  - **`@app/database`:** Houses the Prisma schema, client connection mappings, and data access models.
  - **`@queue/queue`:** Standardizes asynchronous job dispatching definitions.
  - **`@orbit/nomba`:** Wraps the Nomba API endpoints for payments, card tokenizations, and debit verification logic.

---

## 💎 Core Features mapped to the Backend

### 1. Multi-Tenant Project Workspaces

- **Concept:** Merchants can partition their customers, plans, and subscription states between different workspaces (e.g. Test vs. Live modes).
- **Backend Map:** Modeled in the database schema where `Project` holds multiple `ProjectApiKey` elements. Every HTTP request checks authorization tokens via `ApiKeyGuard` or cookies via `DashboardAuthGuard`, scoping access to the project context.

### 2. Flexible Plans & Tiered Pricing

- **Concept:** Define subscription products with multiple pricing models, billing intervals (Daily, Weekly, Monthly, Yearly), and custom trials.
- **Backend Map:** Managed via the `Plan` and `Price` models in `@app/database`. Employs plan grandfathering: updating a plan's price deactivates the old pricing tier for future sign-ups while maintaining existing subscribers at their registered rate.

### 3. Automated Renewals & Lifecycle Manager

- **Concept:** Subscriptions transition seamlessly through lifecycle states (`incomplete` ➔ `trialing` ➔ `active` ➔ `past_due` ➔ `canceled`).
- **Backend Map:** `core-worker` executes cron schedules via `RenewalsScheduler`. On renewal milestones, it creates a pending invoice and charges the tokenized card using the Nomba API.

### 4. Smart Dunning & Payment Retries

- **Concept:** Gracefully handle failed payments by retrying card transactions with customizable interval schedules instead of canceling access immediately.
- **Backend Map:** If a charge fails, `RenewalsService` flags the subscription as `past_due`, increments the attempt counter, and schedules dunning retries up to 3 times before setting the status to `canceled`.

### 5. JWT-Authorized Customer Self-Service Portal

- **Concept:** Customers can manage their own billing accounts, download invoices, update payment methods, or upgrade/downgrade plans.
- **Backend Map:** Uses stateless NestJS `@nestjs/jwt` signatures containing customer metadata (respecting the "no session DB state" constraint).
  - **Immediate Upgrades with Proration:** Calculates the unused value of the current billing cycle, charges the difference immediately via Nomba, and keeps cycle dates aligned.
  - **Grandfathered Downgrades:** Modifies pricing definitions immediately for the next cycle, letting customers enjoy prepaid premium tiers until renewal.

### 6. Secure Webhooks with HMAC-SHA256 Signatures

- **Concept:** Broadcast lifecycle updates (e.g., `subscription.canceled`, `subscription.active`) to merchant endpoints with verification keys.
- **Backend Map:** `WebhookProcessor` creates HMAC hashes using the project's custom signing secret and the stringified request payload, transmitting the signature via the `x-orbit-signature` header.

---

## 🛠️ Tech Stack

- **Backend Monorepo:** NestJS, TypeScript, Prisma ORM, PostgreSQL, Redis, BullMQ
- **Frontend Dashboard:** React, Vite, TypeScript, TanStack Router, TanStack Query, TailwindCSS
- **Deployment:** Docker, Docker Compose

---

## ⚙️ Local Development Setup

### Prerequisites

- Node.js v20+
- Docker & Docker Compose
- PNPM package manager (`npm install -g pnpm`)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/deyonavoseh/orbit-nomba.git
cd orbit-nomba
pnpm install
```

### 2. Environment Variables Configuration

Copy `.env.example` to `.env` in the root of `subscription-engine` and populate your secrets:

```bash
cp .env.example .env
```

### 3. Start Database & Cache Services

Spin up Redis and PostgreSQL containers via Docker:

```bash
docker compose up -d
```

### 4. Run Database Migrations & Generate Clients

```bash
npx prisma db push
npx prisma generate
```

### 5. Start Backend Services

Start the REST API and background worker in watch mode:

```bash
# Terminal 1: REST API
pnpm run start:dev:api

# Terminal 2: Queue Worker
pnpm run start:dev:worker
```

### 6. Start Frontend Dashboard

Navigate to the frontend workspace and launch the Vite dev server:

```bash
pnpm install
pnpm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🐳 Running Completely via Docker Compose

To build and spin up the entire production-grade stack (Postgres, Redis, REST API Server, and Queue Worker) with a single command:

```bash
docker compose up --build -d
```

- **REST API Endpoint:** [http://localhost:3000](http://localhost:3000)
- **API Documentation (Swagger):** [http://localhost:3000/docs/dashboard](http://localhost:3000/docs/dashboard)
