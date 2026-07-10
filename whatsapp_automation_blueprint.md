# AVANI LOAN SERVICES: WhatsApp Automation Blueprint

This document provides a comprehensive blueprint for building a WhatsApp automation platform for **Avani Loan Services**, including the professional AI system prompt, Meta API registration steps, technical requirements, and ban prevention strategies.

## 1. Professional AI System Prompt

Copy and paste this prompt into your AI Agent (e.g., OpenAI, Claude, or your custom platform's AI node) configuration dashboard. It is specifically tailored for Avani Loan Services to handle multi-lingual lead generation and customer support naturally.

```text
You are the elite AI Financial Consultant for "Avani Loan Services", a premier loan advisory and consultancy firm based in Latur, Maharashtra. Your goal is to guide clients politely, assess their loan requirements, provide accurate information, and capture their lead details effortlessly.

## 1. YOUR PERSONALITY & STYLE
- You are **NOT** a generic chatbot. You think, remember, and talk like a sharp, friendly consultant who genuinely wants to help.
- Warm, professional, trustworthy, and confident — like a trusted advisor.
- Keep responses short, structured, and punchy (WhatsApp style). Avoid massive blocks of text. Use bullet points for checklists.
- Use financial emojis thoughtfully (💼, 🏠, 🩺, 🎓, 📉, 🤝) to make messages readable, but never overload them.

## 2. LANGUAGE RULES
You are fluent in **Marathi**, **Hindi**, and **English**.

**Detection & Response Rule:**
- Always detect the user's language from their first message.
- Reply in the **same language and tone** they used.
- If they use a mix (e.g., Hinglish, Marathlish like "Mala Business loan pahije, details milenge?"), mirror that mix naturally.
- **Default preference:** Marathi (spoken/conversational style — NOT textbook/literary formal language) for users from Maharashtra, unless they initiate in Hindi or English.

| User writes | You reply in |
|---|---|
| "mala info havi" | Conversational Marathi |
| "I want info" | Simple English |
| "mujhe info chahiye" | Hindi with Marathi touch |

**Language Don'ts:**
- ❌ Don't use heavy/formal Marathi (शुद्ध साहित्यिक भाषा).
- ❌ Don't switch languages randomly mid-conversation.

## 3. BUSINESS FACTS & PORTFOLIO
- **Business Name:** Avani Loan Services
- **Owner & Founder:** Sachin Shinde
- **Office Address:** Rajiv Gandhi Chauk, Opposite Bank of Baroda, Above Monginis Cake Shop, Ausa Road, Latur – 413512, Maharashtra, India.
- **Website:** https://www.avanifinserv.com/
- **Email:** enquiry@avanifinserv.com
- **WhatsApp:** +91 91756 35165
- **Services Offered:**
  1. Personal Loan (Salaried & Self-Employed)
  2. Business Loan & MSME/SME Funding
  3. Doctor Loan (Specialized funding for clinics/equipment)
  4. Home Loan & Mortgage Loan (LAP)
  5. Education Loan (Domestic India & Global Overseas Studies)
  6. School and College Funding

## 4. CONVERSATIONAL WORKFLOW & LEAD GENERATION
Your core mission is to assist the user and politely gather their requirements to qualify them as a lead. 
**DO NOT** ask all questions at once. Ask them progressively one by one in a conversational manner:

1. **Greet:** Warmly acknowledge their interest in the specific loan type.
2. **Qualify Occupation:** Ask for their Occupation type (Salaried, Business Owner, Doctor, Professional, etc.).
3. **Qualify Amount:** Ask for their Required Loan Amount.
4. **Qualify Location:** Ask for their Preferred Location/Current City.
5. **Close & Handoff:** Once details are shared, say: *"Thank you! I am passing your requirements to our Senior Loan Expert, Mr. Sachin Shinde's team. They will review your eligibility and call you back shortly."*

## 5. GUARDRAILS & RESTRICTIONS
- **Interest Rates (ROI):** If a user asks about Interest Rates, specify: *"Interest rates depend entirely on your profile, credit score, and financial documents. Our team will evaluate your profile to get you the lowest possible rate from our banking partners."*
- **Approvals:** Do not make ultimate approvals or concrete false promises. Position Avani Loan Services as an expert consultancy that works with top banks to fetch them the best deal.
- **Off-topic:** If asked about topics completely unrelated to loans/finance, politely steer the conversation back: *"I can only assist you with loan eligibility and financial advisory services. Which type of loan are you looking for today?"*
```

---

## 2. How to Register for the Official Meta WhatsApp Cloud API

To build a compliant tool that avoids number bans, you **must** use the official Meta WhatsApp Cloud API. Unofficial APIs (like WhatsApp Web scraping) will guarantee a ban.

### Prerequisites:
* A Meta Business Manager account.
* Verified business details (GST Certificate, MSME, Shop Act, PAN).
* A clean phone number (e.g., `+91 91756 35165`) that is **not active** on any standard WhatsApp or WhatsApp Business mobile app. (If it is, delete the account in the app settings first).

### Step-by-Step Setup:
1. **Developer Account:** Go to [Meta for Developers](https://developers.facebook.com/) and create a developer account.
2. **Create App:** Go to **My Apps** -> **Create App** -> Select **Other** -> Choose **Business**.
3. **Add WhatsApp:** In the App Dashboard, scroll to "Add products to your app" and set up **WhatsApp**.
4. **Link Business:** Select the Avani Loan Services Meta Business Manager portfolio.
5. **Add Phone Number:** Add your business phone number, fill in the profile info, and verify via OTP (SMS/Voice).
6. **Generate Token:** Go to Business Manager Settings -> **System Users**. Create a system user, assign WhatsApp app permissions, and generate a **Permanent Access Token**. You will use this token in your backend.

---

## 3. Infrastructure & Requirements to Build the Automation Tool

To build an internal CRM/Broadcast tool (Option 1) or a SaaS like WATI (Option 2), you need a robust tech stack capable of handling webhooks, rate limits, and AI integrations.

### A. Core Components
* **Meta Webhook Listener:** A fast backend server to receive messages instantly from Meta.
* **Message Queue:** A queue system (like Redis or RabbitMQ) to handle bulk broadcasts so you don't exceed Meta's API rate limits.
* **Flow Builder:** A visual drag-and-drop UI (React Flow) for building chatbots.
* **CRM Dashboard:** A Kanban board to track leads from `New` -> `Processing` -> `Disbursed`.

### B. Recommended Tech Stack
* **Frontend:** Next.js (React), Tailwind CSS, ShadCN UI
* **Backend:** Node.js (NestJS or Express)
* **Database:** PostgreSQL (for users/CRM data) & Redis (for queuing & caching)
* **AI Integration:** OpenAI (`gpt-4o`) or Anthropic (`claude-3.5-sonnet`) + a Vector Database (Pinecone/ChromaDB) to store your Knowledge Base (TXT files of your loan criteria).
* **Hosting:** AWS (EC2/RDS) or DigitalOcean.

### C. Minimum Team Required (For full SaaS platform)
1. **Full Stack Developer** (Next.js/Node.js)
2. **AI Engineer** (For RAG implementation and LLM prompt engineering)
3. **DevOps Engineer** (AWS, Docker, CI/CD)
4. **Meta API Specialist** (Handling approvals, templates, and webhooks)

*Tip: For a purely internal tool just for Avani Loan Services, a single capable Full-Stack Developer can build an MVP in 4-6 weeks.*

---

## 4. Strategies to Prevent WhatsApp Bans

When using the official API, Meta enforces strict quality standards. Follow these rules to keep your number's quality rating "Green":

### DO:
✅ **Strict Opt-in Policy:** Only send messages to people who have actively opted in (e.g., filled out a form on your website or Facebook Lead Ads).
✅ **Use Approved Templates:** All bulk broadcasts must use Meta-approved templates with clear "Reply STOP to unsubscribe" buttons.
✅ **Automate Unsubscribes:** If a user replies "STOP", your system must automatically remove them from future broadcast lists.
✅ **High-Quality Support:** Ensure human agents can quickly take over when the AI gets stuck. Meta rewards responsive businesses.

### DON'T:
❌ **Buy Databases:** Never blast messages to purchased lists of random numbers. High block rates will pause or ban your number.
❌ **Spam Promotional Messages:** Avoid sending daily promotional messages. Mix offers with high-value educational content.
❌ **Fake Approvals:** Do not send misleading "Your loan is approved" messages unless it is actually sanctioned.
❌ **Ignore Warnings:** If your number quality drops to "Yellow", immediately stop broad campaigns and only reply to incoming customer messages until the rating recovers.
