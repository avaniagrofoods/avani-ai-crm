/**
 * AVANI LOAN SERVICES — Centralized Business Configuration
 * 
 * Defines official business identity, contact channels, WABA registration details,
 * and isolated authorized test recipients per CP-25.3.1 requirements.
 */

export interface BusinessConfig {
  name: string;
  legalEntity: string;
  tagline: string;
  website: string;
  email: string;
  founder: {
    name: string;
    role: string;
  };
  whatsapp: {
    officialWabaNumber: string; // Official WhatsApp Business / WABA (+91 72491 08474)
    officialWabaFormatted: string;
    wabaId: string;
    authorizedTestRecipient: string; // Authorized Test Recipient (+91 91756 35165)
    authorizedTestRecipientFormatted: string;
  };
  office: {
    city: string;
    state: string;
    country: string;
  };
}

export const AVANI_BUSINESS_CONFIG: BusinessConfig = {
  name: "AVANI LOAN SERVICES",
  legalEntity: "AVANI LOAN SERVICES",
  tagline: "Your Trusted Loan Advisory Partner",
  website: "https://www.avanifinserv.com",
  email: "enquiry@avanifinserv.com",
  founder: {
    name: "Sachin Shinde",
    role: "Founder & Chief Loan Advisor"
  },
  whatsapp: {
    // Official WhatsApp Business API (WABA) number registered on Meta / ChatMitra
    officialWabaNumber: process.env.OFFICIAL_WABA_NUMBER || "+917249108474",
    officialWabaFormatted: "+91 72491 08474",
    wabaId: process.env.CHATMITRA_WABA_ID || "1062614709598311",
    
    // Strict Testing Recipient (Authorized sandbox & staging verification ONLY)
    authorizedTestRecipient: "919175635165",
    authorizedTestRecipientFormatted: "+91 91756 35165"
  },
  office: {
    city: "Latur",
    state: "Maharashtra",
    country: "India"
  }
};

/**
 * Standard Product Details Message for AVANI LOAN SERVICES
 * Formatted with official business identity and official WhatsApp WABA number.
 * NEVER displays the test recipient number in public-facing copy.
 */
export const AVANI_OFFICIAL_PRODUCT_SUITE = `═══════════════════════════════════════
🏦 *AVANI LOAN SERVICES — COMPLETE PRODUCT SUITE*
═══════════════════════════════════════
Empowering your financial requirements across 40+ partner banks & NBFCs:

1. 🩺 *Doctor Professional Loan* — Clinic setup, medical equipment & expansion funding up to ₹50 Lakhs (No collateral options).
2. 💼 *Personal Loan* — Instant personal loans for salaried & self-employed individuals up to ₹50 Lakhs.
3. 🏢 *Business Loan & MSME Working Capital* — Secured & unsecured business expansion, machinery & trade funding.
4. 📊 *CA Professional Loan* — Specialized funding for Chartered Accountants, COP holders & audit firms.
5. 🏠 *Home Loan & Construction Funding* — New flats, row houses, plot purchase & balance transfer with top-up.
6. 🏬 *Mortgage Loan / Loan Against Property (LAP)* — Loans against residential, commercial & industrial property.
7. 🎓 *Education Loan (India & Global Studies)* — Higher education in India or overseas (USA, UK, Canada, Germany, Australia).
8. 🏫 *School & College Institutional Funding* — Trust, society & educational institution campus development & expansion.

📲 *Official WhatsApp Business:* +91 72491 08474
👤 *Chief Loan Advisor:* Sachin Shinde
🌐 *Official Website:* https://www.avanifinserv.com/
═══════════════════════════════════════`;

/**
 * Helper to determine if a given phone number is the authorized test contact.
 */
export function isAuthorizedTestRecipient(phone: string): boolean {
  const digits = (phone || '').replace(/\D/g, '');
  return digits === '919175635165' || digits === '9175635165';
}
