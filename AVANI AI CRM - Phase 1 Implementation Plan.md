# AVANI AI CRM - Phase 1 Implementation Plan

This plan covers Phase 1: Project Setup & Database Architecture. We will initialize the frontend, backend, and establish the core database schema.

## Goal Description

Establish the foundational architecture for AVANI AI CRM. This includes a Next.js frontend with ShadCN UI for the dashboard, a NestJS backend for API handling, and a PostgreSQL database mapped via Prisma ORM to handle multi-tenancy, contacts, messages, and chatbot flows.

> [!IMPORTANT]
> Please review the database schema below. Ensure that it captures the essential data you need for your loan contacts (e.g., loan amount, property value).

## Open Questions

> [!WARNING]
> Do you have PostgreSQL installed on your machine locally, or would you like me to set it up using Docker? (Docker is recommended for an isolated and clean database environment).

## Proposed Architecture & Setup

We will create two main directories within your workspace:
- `frontend/` - Next.js application
- `backend/` - NestJS application

### Frontend Setup (Next.js)

1. Initialize Next.js using `npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
2. Install ShadCN UI and initialize the design system (`npx shadcn-ui@latest init`).
3. Set up a basic layout with a sidebar for navigation (Dashboard, Inbox, CRM, Campaigns, Settings).
4. Configure dark/light mode functionality.

### Backend Setup (NestJS & Prisma)

1. Initialize NestJS using `npx @nestjs/cli new backend --package-manager npm`.
2. Install Prisma ORM (`npm i prisma @prisma/client`) and initialize it (`npx prisma init`).
3. Configure the PostgreSQL connection string.

### Database Schema (Prisma)

Here is the proposed initial database schema for the CRM. We will use Prisma ORM to manage these tables in PostgreSQL.

```prisma
// backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Workspace {
  id        String   @id @default(uuid())
  name      String   // e.g., "Avani Loan Services"
  createdAt DateTime @default(now())
  users     User[]
  contacts  Contact[]
  campaigns Campaign[]
}

model User {
  id          String    @id @default(uuid())
  email       String    @unique
  name        String
  role        Role      @default(AGENT) // ADMIN, MANAGER, AGENT
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
}

enum Role {
  ADMIN
  MANAGER
  AGENT
}

model Contact {
  id            String    @id @default(uuid())
  phone         String    @unique // WhatsApp Number
  name          String?
  city          String?
  income        Float?
  profession    String?
  loanType      String?
  loanAmount    Float?
  propertyValue Float?
  status        LeadStatus @default(NEW_LEAD)
  workspaceId   String
  workspace     Workspace  @relation(fields: [workspaceId], references: [id])
  messages      Message[]
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
}

enum LeadStatus {
  NEW_LEAD
  INTERESTED
  DOCS_PENDING
  BANK_PROCESSING
  SANCTIONED
  DISBURSED
  CLOSED
}

model Message {
  id          String   @id @default(uuid())
  contactId   String
  contact     Contact  @relation(fields: [contactId], references: [id])
  direction   Direction // INBOUND (from customer), OUTBOUND (from bot/agent)
  type        MsgType   // TEXT, IMAGE, TEMPLATE
  content     String
  status      MsgStatus @default(SENT) // SENT, DELIVERED, READ, FAILED
  timestamp   DateTime  @default(now())
}

enum Direction {
  INBOUND
  OUTBOUND
}

enum MsgType {
  TEXT
  IMAGE
  TEMPLATE
  INTERACTIVE
}

enum MsgStatus {
  SENT
  DELIVERED
  READ
  FAILED
}

model Campaign {
  id          String   @id @default(uuid())
  name        String
  templateId  String
  status      CampStatus @default(DRAFT)
  scheduledAt DateTime?
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  createdAt   DateTime  @default(now())
}

enum CampStatus {
  DRAFT
  SCHEDULED
  RUNNING
  COMPLETED
  PAUSED
}
```

## Verification Plan

1. **Frontend:** Run `npm run dev` in the `frontend` folder to verify the Next.js app starts successfully and the dark mode layout renders.
2. **Backend:** Run `npm run start:dev` in the `backend` folder to verify the NestJS app starts.
3. **Database:** Run `npx prisma db push` (or generate migrations) and open Prisma Studio to visually verify the tables are created in PostgreSQL.
