# AVANI AI CRM - Phase 2 Implementation Plan

This plan outlines the architecture and execution steps for Phase 2: Building the UI and integrating the WhatsApp Cloud API.

## Goal Description

Build a fully functional UI dashboard for the CRM using Next.js and ShadCN, and integrate the Meta WhatsApp Cloud API into the NestJS backend to enable sending and receiving messages.

## Proposed Changes

### 1. UI Construction (Frontend - Next.js)
- **Layout & Navigation:** Create a responsive sidebar and topbar layout for navigating between Dashboard, Inbox, Leads, and Campaigns.
- **Dashboard:** Build an overview page showing metrics (Total Leads, New Messages, Active Campaigns).
- **Inbox Interface:** Create a WhatsApp-style chat interface for communicating with leads in real-time.
- **Leads & Contacts Management:** Implement a data table using ShadCN to list, filter, and manage contacts and lead statuses.
- **Campaign Builder:** Build a form interface for scheduling and managing WhatsApp bulk broadcast campaigns.

### 2. WhatsApp API Integration (Backend - NestJS)
- **Webhook Listener:** Create a `/webhook` endpoint in NestJS to receive real-time incoming messages and status updates from Meta.
- **Message Sending Service:** Implement a service using the Meta Graph API to send text messages and templates out to users.
- **Prisma Database Integration:** Automatically save incoming messages to the `Message` table and link them to the respective `Contact`. Create new contacts if the number is unrecognized.

### 3. API Endpoints (Backend - NestJS)
- **Contacts API:** Create REST endpoints (`GET`, `POST`, `PUT`) for the frontend to manage contacts and update lead statuses.
- **Messages API:** Create endpoints to fetch message history for the inbox UI and to trigger outbound messages.

## Verification Plan

### Automated Tests
- None planned for this phase immediately; focus is on functional MVP delivery.

### Manual Verification
- We will restart both the frontend and backend servers.
- The user will be asked to configure the Meta App Webhook URL (using a new `localtunnel` link).
- We will test sending a message to the test WhatsApp number and verifying it appears in the new CRM Inbox UI.
