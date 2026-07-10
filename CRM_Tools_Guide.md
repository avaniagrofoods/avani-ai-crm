# Avani Loan Services CRM - Tool Guide

Welcome to the Avani Loan Services CRM overview! This guide explains how to use each of the 16 tools in your sidebar, specifically designed to help your team automate loan processing, WhatsApp communication, and customer follow-ups.

---

### Understanding the CSV "Sent vs Failed" Feature
> [!NOTE]
> **How Bulk Messaging Analytics Work:**
> When you upload a CSV and click "Send Bulk Message", the backend routes your messages through the Meta WhatsApp API. 
> 
> Because Meta processes messages asynchronously, your CRM uses **Webhook Events** (see below) to track delivery. You will soon see a "Campaigns" dashboard where you can see exactly:
> - **Total Sent:** The number of messages successfully accepted by WhatsApp.
> - **Delivered:** The number of messages that reached the customer's phone.
> - **Read:** The number of customers who opened the message.
> - **Failed:** The number of invalid numbers or blocked users.

---

### Core Communication Tools

#### 1. WhatsApp Templates
Meta requires all outbound business-initiated messages (like Loan Approvals or Follow-ups) to be pre-approved "Templates". Use this tool to draft templates (e.g., "Hello {{1}}, your Personal Loan is approved!"), submit them to Meta, and track their approval status.

#### 2. WhatsApp Forms
Instead of asking customers 10 questions one by one, use WhatsApp Forms to send an interactive in-chat form. Customers can fill out their Income, Profession, and Loan Amount right inside WhatsApp without clicking an external link. The data automatically syncs back to your Contacts list.

#### 3. Opts Management
To comply with WhatsApp policies, use this tool to manage which customers have "Opted-In" to receive promotional messages and which have typed "STOP" to unsubscribe.

#### 4. Webhook Events
This is the "brain" of your delivery tracking. Every time a customer receives a message, reads a message, or replies, Meta sends a "Webhook Event". This tool lets you view the raw feed of these events to debug delivery failures or missing replies.

---

### Organization & Data Tools

#### 5. Tags
Create color-coded tags like `High Priority`, `Doctor Loan`, or `Missing Documents`. You can apply these to contacts to easily filter them when sending bulk messages.

#### 6. Custom Columns
Your CRM comes with default fields (Name, Phone, Income). Use Custom Columns if you need to track highly specific data, such as `CIBIL Score`, `Co-Applicant Name`, or `Property Registration Date`.

#### 7. Media Gallery
When customers send you their Aadhar Card, PAN Card, or IT Returns over WhatsApp, the files are securely downloaded and stored in this Media Gallery. You can easily view, download, or attach them to loan profiles.

#### 8. Projects
Group multiple contacts or tasks into a larger "Project". For example, if you are handling a massive "School Funding" project, you can track all the associated leads and applications in one place.

#### 9. Tasks
A built-in to-do list for your team. Create tasks like "Call Rajesh regarding missing PAN card" and set due dates.

---

### Automation & AI

#### 10. FAQ Bot
Don't waste time answering "What are your interest rates?" a hundred times a day. Define your Frequently Asked Questions here, and the CRM will automatically reply to customers matching those keywords.

#### 11. WhatsApp Flows
Build interactive, multi-step menus. For example:
*Customer sends "Hi"*
*Bot replies:* "Welcome to Avani Loans! Press 1 for Personal Loans, Press 2 for Home Loans."
Flows handle complex data collection before a human agent even needs to look at the chat.

#### 12. AI Assistant
Configure the underlying AI personality. You can upload your company's interest rates and policies here, and the AI will act as a 24/7 autonomous sales agent, chatting naturally with customers and qualifying leads.

---

### System Tools

#### 13. Workspace Settings
Configure your business name, operating hours (to trigger "Away" messages), and team member roles (Manager, Agent, Admin).

#### 14. Knowledge Base
Upload PDFs or write text articles about your internal company policies. The AI Assistant will automatically read these documents to learn how to answer customer questions accurately.

#### 15. Developers & APIs
For advanced users. View your API keys, Meta App ID, and integrate your CRM with external software like Zapier, Make.com, or your own custom website forms.
