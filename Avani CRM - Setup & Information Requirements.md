# Avani CRM - Setup & Information Requirements

This document explains the most important tools in your CRM, how they connect, and the exact credentials/information needed from you to make them fully operational.

---

## 1️⃣ The Most Important Tools (Core Pillars)

Out of the 16 tools, these **4 Core Pillars** are the most critical for your business:

1. **Contacts & CSV Bulk Upload (organization/Marketing):**
   * *Why it is important:* This is your database. It allows you to segment leads by loan products (e.g., `Personal`, `Home`, `Business`) and trigger bulk follow-up broadcasts.
2. **WhatsApp Templates (Meta Compliance):**
   * *Why it is important:* Meta restricts cold outreach. You cannot send WhatsApp messages to leads unless you use an approved Template. Once approved, these templates are selected in the CRM to execute broadcasts.
3. **AI Assistant & Chatbot Inbox (Automation):**
   * *Why it is important:* Powers the 24/7 automatic reply system using Google Gemini. The AI reads customer messages, answers loan queries naturally, qualifies their income/needs, and assigns them to human agents.
4. **Webhook Events & Webhook API (Analytics):**
   * *Why it is important:* It tracks delivery status. When a broadcast is sent, webhooks tell the CRM if a message was **Delivered**, **Read**, or **Failed** (e.g., invalid number).

---

## 2️⃣ What Information is Required from You (Action Checklist)

To complete the setup, please provide or enter the following **3 items** in your [Settings](file:///C:/Users/ALPHA-1/Desktop/AVANI%20AI%20CRM/frontend/src/app/settings/page.tsx) page:

### 🟩 Item 1: Meta WhatsApp Phone Number ID
* *Where to find it:* Meta App Developer Portal > WhatsApp > API Setup.
* *Current Status:* Placeholder (`YOUR_PHONE_NUMBER_ID`) is currently active.
* *Value needed:* The 15-digit ID associated with your WhatsApp business number (e.g., `105634582910482`).

### 🟩 Item 2: Google Gemini API Key
* *Where to find it:* [Google AI Studio](https://aistudio.google.com/).
* *Current Status:* Missing.
* *Value needed:* An API key starting with `AIzaSy...` to enable the AI Auto-pilot to chat with your leads.

### 🟩 Item 3: Meta Webhook URL Registration
* *What is needed:* Configure the webhook URL in Meta App settings.
* *Callback URL:* `https://workplace-kay-exchanges-psi.trycloudflare.com/whatsapp/webhook`
* *Verify Token:* `avani_secure_webhook_token_2026`

---

## 3️⃣ How We Will Set It Up

Once you provide the Phone Number ID and Gemini API Key, I will automatically:
1. Update your `backend/.env` file with the keys.
2. Link the WhatsApp Service to route outgoing messages through your actual number.
3. Activate the Gemini AI engine to respond to incoming webhook messages.
