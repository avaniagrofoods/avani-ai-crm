const GEMINI_API_KEY = (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '').trim();

export const CANONICAL_LOAN_PRODUCTS = [
  'Personal Loan',
  'Business Loan',
  'Doctor Loan',
  'CA Professional Loan',
  'Home Loan',
  'Mortgage Loan / LAP',
  'Education Loan — India',
  'Education Loan — Global Studies',
  'School Funding',
  'College Funding'
] as const;

export const ADVISORY_DISCLAIMER = 
  "AVANI LOAN SERVICES is an authorized loan advisory and consultancy firm and does NOT act as a direct lender or bank. Loan sanction, interest rates, and disbursal are at the sole discretion of partner banks and NBFCs based on eligibility, documentation, and credit verification.";

export const ADVISOR_CONTACT = {
  name: 'Sachin Shinde',
  role: 'Founder & Chief Loan Advisor',
  phone: '+91 72491 08474',
  website: 'https://www.avanifinserv.com/'
};

export class AgentEngine {
  
  static async processMessage(conversation: any, text: string) {
    // 1. Extract entities and detect intent/language
    const extraction = await this.extractEntities(conversation, text);
    
    let nextState = conversation.currentState;
    
    // Update language if detected confidently
    if (extraction.language && ['en', 'mr', 'hi'].includes(extraction.language)) {
      conversation.language = extraction.language;
    }
    
    if (extraction.intent === 'DECLINE') {
      conversation.currentState = 'CUSTOMER_DECLINED';
      const msg = await this.translateText("No problem at all. Please feel free to reach out to AVANI LOAN SERVICES whenever you need loan advisory assistance.", conversation.language);
      return { nextQuestion: msg, updatedState: 'CUSTOMER_DECLINED' };
    }
    
    if (extraction.intent === 'HUMAN_HANDOFF') {
      conversation.currentState = 'HUMAN_HANDOFF';
      const msg = await this.translateText(
        `I am handing your request over to our Founder & Chief Loan Advisor, Sachin Shinde (+91 72491 08474). He will connect with you shortly for personalized consultation. You can also visit www.avanifinserv.com.`,
        conversation.language
      );
      return { nextQuestion: msg, updatedState: 'HUMAN_HANDOFF' };
    }

    // Safety check for guarantee questions
    const lowerText = text.toLowerCase();
    if (lowerText.includes('guarantee') || lowerText.includes('100%') || lowerText.includes('नक्की मिळेल का') || lowerText.includes('पक्का मिलेगा')) {
      const disclaimerMsg = await this.translateText(
        `At AVANI LOAN SERVICES, we provide honest and transparent consultancy across 40+ banks & NBFCs to secure you the best terms. Final approval and interest rates depend on partner bank underwriting, credit profile, and documentation. No agency can ethically promise guaranteed approval.`,
        conversation.language
      );
      return { nextQuestion: disclaimerMsg, updatedState: conversation.currentState };
    }
    
    // Update context with extracted valid data
    if (extraction.extractedData) {
      if (!conversation.context) conversation.context = {};
      const d = extraction.extractedData;
      if (d.fullName) conversation.context.fullName = d.fullName;
      if (d.mobile) conversation.context.mobile = d.mobile;
      if (d.email) conversation.context.email = d.email;
      if (d.city) conversation.context.city = d.city;
      if (d.employmentType) conversation.context.employmentType = d.employmentType;
      if (d.profession) conversation.context.profession = d.profession;
      if (d.monthlyIncome) conversation.context.monthlyIncome = d.monthlyIncome;
      if (d.loanProduct) conversation.context.loanProduct = d.loanProduct;
      if (d.loanAmount) conversation.context.loanAmount = d.loanAmount;
    }
    
    // 2. Determine Next State sequentially
    nextState = this.determineNextState(conversation.context, conversation.currentState);
    conversation.currentState = nextState;
    
    // 3. Generate Next Question or Document Checklist
    let nextQuestion = "";
    if (nextState === 'DOCUMENT_GUIDANCE') {
      const docList = this.getDocumentsForProfile(
        conversation.context.employmentType, 
        conversation.context.profession, 
        conversation.context.loanProduct
      );
      conversation.context.documentsRequired = docList;
      conversation.currentState = 'DOCUMENTS_PENDING';
      
      const docListString = docList.map((d: string) => "- " + d).join('\n');
      nextQuestion = await this.translateText(
        `Thank you! Based on your profile for ${conversation.context.loanProduct || 'a loan'}, here is the standard document checklist:\n\n${docListString}\n\n${ADVISORY_DISCLAIMER}\n\nPlease share these documents here, or reply "ADVISOR" to connect directly with Sachin Shinde (+91 72491 08474).`, 
        conversation.language
      );
    } else if (nextState === 'DOCUMENTS_PENDING') {
      nextQuestion = await this.translateText("Please upload the requested documents, or reply 'ADVISOR' if you need help from Sachin Shinde.", conversation.language);
    } else {
      nextQuestion = await this.generateQuestionForState(nextState, conversation.language);
    }
    
    return { nextQuestion, updatedState: conversation.currentState };
  }
  
  static determineNextState(context: any, currentState: string) {
    if (!context) return 'COLLECT_FULL_NAME';
    
    if (!context.fullName) return 'COLLECT_FULL_NAME';
    if (!context.mobile) return 'COLLECT_MOBILE';
    if (!context.email) return 'COLLECT_EMAIL';
    if (!context.city) return 'COLLECT_CITY';
    if (!context.employmentType) return 'COLLECT_EMPLOYMENT';
    if (!context.monthlyIncome) return 'COLLECT_MONTHLY_INCOME';
    if (!context.loanProduct) return 'COLLECT_LOAN_PRODUCT';
    if (!context.loanAmount) return 'COLLECT_LOAN_AMOUNT';
    
    if (currentState === 'DOCUMENT_GUIDANCE' || currentState === 'DOCUMENTS_PENDING') {
      return currentState;
    }
    
    return 'DOCUMENT_GUIDANCE';
  }
  
  static async extractEntities(conversation: any, text: string) {
    const prompt = `
You are an intent and entity extractor for AVANI LOAN SERVICES.
The user sent a message. Analyze the message and extract the following in strict JSON format.

Current Conversation State: ${conversation?.currentState || 'NEW'}
Language History: ${conversation?.language || 'en'}

Rules:
1. language: detect language ('en' for English, 'mr' for Marathi, 'hi' for Hindi).
2. intent: 'ANSWER' (answering a question), 'DECLINE' (rejecting, not interested), 'HUMAN_HANDOFF' (wants to speak to an agent/advisor/Sachin Shinde).
3. extractedData: only include fields if they are explicitly or implicitly answered in the text.
    - fullName: string
    - mobile: 10-digit Indian mobile string
    - email: valid email string
    - city: string
    - employmentType: one of ["Salaried", "Self Employed", "Business Owner", "Doctor / Medical Professional", "Chartered Accountant", "Other Professional", "Farmer", "Pensioner", "Rental Income"]
    - profession: string
    - monthlyIncome: map to one of ["₹25K–₹50K", "₹50K–₹1L", "₹1L–₹2L", "Above ₹2L"]
    - loanProduct: one of ["Personal Loan", "Business Loan", "Home Loan", "Mortgage Loan / Loan Against Property (LAP)", "Education Loan", "Vehicle Loan / Car Loan", "Gold Loan", "Working Capital / MSME Loan"]
    - loanAmount: numeric string (e.g. "3000000" for 30 Lakhs)

If the user answers ambiguously, do not guess the product.
User Message: "${text}"

Respond with ONLY raw JSON, no markdown blocks.
`;

    if (process.env.PROVIDER_MODE === 'mock' || !GEMINI_API_KEY.length) {
      console.log(`[MOCK GEMINI] Extracting entities for: "${text}"`);
      const lower = text.toLowerCase();
      const extracted: any = {};
      let lang = 'en';

      if (/[\u0900-\u097F]/.test(text)) {
        lang = (text.includes("आहे") || text.includes("काय") || text.includes("पाहिजे") || text.includes("मिळेल")) ? 'mr' : 'hi';
      }

      // Check human handoff
      if (lower.includes("advisor") || lower.includes("shinde") || text.includes("सल्लागार") || lower.includes("human") || text.includes("बात करनी") || text.includes("बोलणे")) {
        return { language: lang, intent: 'HUMAN_HANDOFF', extractedData: {} };
      }

      // Check decline
      if (lower.includes("not interested") || lower.includes("decline") || text.includes("नको") || text.includes("नहीं चाहिए")) {
        return { language: lang, intent: 'DECLINE', extractedData: {} };
      }

      // 1. Doctor Loan
      if (lower.includes("doctor") || text.includes("डॉक्टर") || lower.includes("mbbs") || lower.includes("clinic")) {
        extracted.loanProduct = "Doctor Loan";
        extracted.profession = "Doctor";
        extracted.employmentType = "Doctor / Medical Professional";
      }
      // 2. CA Professional Loan
      else if (lower.includes("ca loan") || lower.includes("chartered") || lower.includes("icai") || text.includes("सीए") || text.includes("चार्टर्ड")) {
        extracted.loanProduct = "CA Professional Loan";
        extracted.profession = "Chartered Accountant";
        extracted.employmentType = "Chartered Accountant";
      }
      // 3. School Funding
      else if (lower.includes("school funding") || lower.includes("school loan") || text.includes("शाळा") || text.includes("स्कूल")) {
        extracted.loanProduct = "School Funding";
        extracted.employmentType = "Business Owner";
      }
      // 4. College Funding
      else if (lower.includes("college funding") || lower.includes("college loan") || text.includes("कॉलेज") || text.includes("महाविद्यालय")) {
        extracted.loanProduct = "College Funding";
        extracted.employmentType = "Business Owner";
      }
      // 5. Education Loan — Global Studies
      else if (lower.includes("abroad") || lower.includes("global") || lower.includes("overseas") || lower.includes("usa") || text.includes("परदेश") || text.includes("विदेश")) {
        extracted.loanProduct = "Education Loan — Global Studies";
        extracted.employmentType = "Student";
      }
      // 6. Education Loan — India
      else if (lower.includes("education loan") || lower.includes("tuition") || text.includes("शिक्षण कर्ज") || text.includes("एजुकेशन लोन")) {
        extracted.loanProduct = "Education Loan — India";
        extracted.employmentType = "Student";
      }
      // 7. Mortgage Loan / LAP
      else if (lower.includes("lap") || lower.includes("mortgage") || lower.includes("against property") || text.includes("मॉर्गिज") || text.includes("प्रॉपर्टी")) {
        extracted.loanProduct = "Mortgage Loan / LAP";
      }
      // 8. Home Loan
      else if (lower.includes("home loan") || lower.includes("flat") || lower.includes("house") || text.includes("होम लोन") || text.includes("गृहकर्ज")) {
        extracted.loanProduct = "Home Loan";
      }
      // 9. Business Loan
      else if (lower.includes("business loan") || lower.includes("msme") || lower.includes("working capital") || text.includes("बिझनेस") || text.includes("व्यापार")) {
        extracted.loanProduct = "Business Loan";
        extracted.employmentType = "Business Owner";
      }
      // 10. Personal Loan
      else if (lower.includes("personal loan") || text.includes("पर्सनल लोन") || text.includes("वैयक्तिक")) {
        extracted.loanProduct = "Personal Loan";
        extracted.employmentType = "Salaried";
      }

      // City extraction
      if (lower.includes("pune") || text.includes("पुणे")) extracted.city = "Pune";
      else if (lower.includes("mumbai") || text.includes("मुंबई")) extracted.city = "Mumbai";
      else if (lower.includes("latur") || text.includes("लातूर")) extracted.city = "Latur";
      else if (lower.includes("nagpur") || text.includes("नागपूर")) extracted.city = "Nagpur";

      // Income extraction
      if (text.includes("1 लाख") || lower.includes("1 lakh") || lower.includes("75000") || lower.includes("50k")) {
        extracted.monthlyIncome = "₹50K–₹1L";
      } else if (text.includes("2 लाख") || lower.includes("2 lakh") || lower.includes("1.5 lakh")) {
        extracted.monthlyIncome = "₹1L–₹2L";
      } else if (lower.includes("above 2") || text.includes("2 लाखांपेक्षा जास्त")) {
        extracted.monthlyIncome = "Above ₹2L";
      }

      // Amount extraction
      if (text.includes("30 लाख") || lower.includes("30 lakh") || lower.includes("3000000")) {
        extracted.loanAmount = "3000000";
      } else if (text.includes("50 लाख") || lower.includes("50 lakh") || lower.includes("5000000")) {
        extracted.loanAmount = "5000000";
      } else if (text.includes("1 कोटी") || lower.includes("1 crore") || lower.includes("10000000")) {
        extracted.loanAmount = "10000000";
      }

      // Name extraction
      const nameMatch = text.match(/(?:my name is|i am|नाव|नाम)\s+([A-Za-z\u0900-\u097F]+(?:\s+[A-Za-z\u0900-\u097F]+)?)/i);
      if (nameMatch) {
        extracted.fullName = nameMatch[1].trim();
      }

      return { language: lang, intent: 'ANSWER', extractedData: extracted };
    }

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await res.json();
      if (data.error) {
        console.error("Gemini API Error:", data.error);
        return { language: 'en', intent: 'ANSWER', extractedData: {} };
      }
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      let cleanJson = reply.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("Extraction error", e);
      return { language: 'en', intent: 'ANSWER', extractedData: {} };
    }
  }
  
  static async translateText(text: string, language: string) {
    if (language === 'en') return text;
    if (process.env.PROVIDER_MODE === 'mock' || !GEMINI_API_KEY.length) {
      console.log(`[MOCK GEMINI] Translating to ${language}: "${text}"`);
      if (language === 'mr') {
        if (text.includes("What is your full name?")) return "तुमचे पूर्ण नाव काय आहे?";
        if (text.includes("monthly income range")) return "तुमचे मासिक उत्पन्न किती आहे? (₹25K–₹50K, ₹50K–₹1L, ₹1L–₹2L, ₹2L+)";
        if (text.includes("loan amount do you require")) return "तुम्हाला किती कर्जाची आवश्यकता आहे?";
        if (text.includes("standard document checklist")) return `तुमच्या प्रोफाईलनुसार, कृपया खालील कागदपत्रे शेअर करा:\n\n- पॅन कार्ड\n- आधार कार्ड\n- बँक स्टेटमेंट (६ महिने)\n\n${ADVISORY_DISCLAIMER}\n\nअधिक माहितीसाठी सचिन शिंदे (+91 72491 08474) यांच्याशी संपर्क साधा.`;
        if (text.includes("handing your request over to our Founder")) return `तुमची विनंती आमचे संस्थापक आणि मुख्य कर्ज सल्लागार सचिन शिंदे (+91 72491 08474) यांच्याकडे पाठवली आहे. ते लवकरच तुमच्याशी संपर्क साधतील.`;
      } else if (language === 'hi') {
        if (text.includes("What is your full name?")) return "आपका पूरा नाम क्या है?";
        if (text.includes("monthly income range")) return "आपकी मासिक आय कितनी है? (₹25K–₹50K, ₹50K–₹1L, ₹1L–₹2L, ₹2L+)";
        if (text.includes("loan amount do you require")) return "आपको कितने लोन की आवश्यकता है?";
        if (text.includes("handing your request over to our Founder")) return `आपका अनुरोध हमारे संस्थापक और मुख्य लोन सलाहकार सचिन शिंदे (+91 72491 08474) को भेजा गया है। वे जल्द ही आपसे संपर्क करेंगे।`;
      }
      return text;
    }

    const prompt = `Translate the following text to ${language === 'mr' ? 'Marathi' : 'Hindi'} maintaining a professional, empathetic, and polite tone for AVANI LOAN SERVICES:\n\n"${text}"\n\nProvide ONLY the translated text, nothing else.`;
    
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
    } catch (e) {
      return text;
    }
  }
  
  static async generateQuestionForState(state: string, language: string) {
    let q = "";
    switch(state) {
      case 'COLLECT_FULL_NAME': q = "What is your full name?"; break;
      case 'COLLECT_MOBILE': q = "What is your 10-digit mobile number?"; break;
      case 'COLLECT_EMAIL': q = "What is your email address?"; break;
      case 'COLLECT_CITY': q = "Which city do you currently reside in?"; break;
      case 'COLLECT_EMPLOYMENT': q = "What is your employment type? (Salaried, Self Employed, Business Owner, Professional, Farmer, Pensioner)"; break;
      case 'COLLECT_MONTHLY_INCOME': q = "What is your monthly income range? (₹25K–₹50K, ₹50K–₹1L, ₹1L–₹2L, Above ₹2L)"; break;
      case 'COLLECT_LOAN_PRODUCT': q = "Which loan product are you looking for? (Personal Loan, Business Loan, Home Loan, Mortgage / LAP, Education Loan, Vehicle Loan, Gold Loan, Working Capital / MSME)"; break;
      case 'COLLECT_LOAN_AMOUNT': q = "How much loan amount do you require?"; break;
      default: q = "Welcome to AVANI LOAN SERVICES! How can we assist you with your loan requirements today?";
    }
    
    return await this.translateText(q, language);
  }
  
  static getDocumentsForProfile(employmentType: string, profession: string, loanProduct: string) {
    // 1. Doctor Loan
    if (loanProduct === 'Doctor Loan' || profession === 'Doctor' || employmentType === 'Doctor / Medical Professional') {
      return [
        'Degree Certificate (MBBS / MD / BDS / BAMS)',
        'Medical Council Registration Certificate',
        'Clinic / Hospital Registration Proof',
        'PAN Card & Aadhaar Card',
        'Last 2 years Income Tax Returns (ITR) with Computation',
        'Last 12 months Bank Statements (Current & Savings accounts)',
        'Existing loan repayment track (if any)'
      ];
    }

    // 2. CA Professional Loan
    if (loanProduct === 'CA Professional Loan' || profession === 'Chartered Accountant' || employmentType === 'Chartered Accountant') {
      return [
        'Certificate of Practice (COP)',
        'ICAI Membership Certificate',
        'PAN Card & Aadhaar Card',
        'Last 2 years ITR with Audit Report & Computation',
        'Last 12 months Bank Statements',
        'Office setup / lease agreement'
      ];
    }

    // 3. School Funding
    if (loanProduct === 'School Funding') {
      return [
        'Trust / Society / Section 8 Entity Registration Deed',
        'School Affiliation & Recognition Certificate (CBSE / ICSE / State Board)',
        '12A & 80G Certificates (for charitable trusts)',
        'Last 3 years Audited Balance Sheets & Income/Expenditure Accounts',
        'Student Enrollment Strength & Fee Collection Ledger (last 2 years)',
        'Last 12 months Bank Statements of all Trust accounts',
        'School Campus Land & Building Title / Lease Deeds'
      ];
    }

    // 4. College Funding
    if (loanProduct === 'College Funding') {
      return [
        'Trust / Society / Educational Entity Deed & Bylaws',
        'University / AICTE / UGC / NMC Affiliation & Approval Orders',
        'Last 3 years Audited Financials with Balance Sheet & Audit Report',
        'Student Enrollment Matrix & Annual Fee Collection Records',
        'Last 12 months Bank Statements for all Institutional Accounts',
        'Campus Land & Building Title Deeds with Sanctioned Infrastructure Plans'
      ];
    }

    // 5. Education Loan — Global Studies
    if (loanProduct === 'Education Loan — Global Studies') {
      return [
        'Foreign University Admission Letter / I-20 / CAS with Detailed Fee Breakdown',
        'Valid Passport Copy & Academic Visa Documentation',
        'Academic Marksheets & Degree Certificates (10th, 12th, Graduation)',
        'Standardized Entrance Test Scorecard (IELTS / TOEFL / GRE / GMAT)',
        'Student & Co-applicant PAN Card and Aadhaar Card',
        'Co-applicant Income Proof (Latest 3 months salary slips or 2 years ITR)',
        'Co-applicant Last 6–12 months Bank Statement with Funds Verification'
      ];
    }

    // 6. Education Loan — India
    if (loanProduct === 'Education Loan — India' || loanProduct === 'Education Loan') {
      return [
        'Admission Letter & Fee Schedule from Recognized Indian University / College',
        'Academic Marksheets & Certificates (10th, 12th, Graduation / Entrance Scorecard e.g. NEET/JEE/CAT)',
        'Student & Co-applicant PAN Card and Aadhaar Card',
        'Co-applicant Income Proof (3 months salary slips or 2 years ITR)',
        'Co-applicant Last 6 months Bank Statement'
      ];
    }

    // 7. Mortgage Loan / LAP
    if (loanProduct === 'Mortgage Loan / LAP' || loanProduct === 'Mortgage Loan / Loan Against Property (LAP)' || loanProduct === 'Mortgage / LAP') {
      return [
        'Property Title Deeds & 30-Year Search Report (Residential / Commercial / Industrial)',
        'Approved Building Sanction Map & Completion / Occupancy Certificate',
        'Latest Municipal Property Tax Paid Receipts & Society / Builder NOC',
        'PAN Card & Aadhaar Card of Applicant & All Co-owners',
        employmentType === 'Salaried'
          ? 'Latest 3 months salary slips & 2 years Form 16'
          : 'Last 3 years ITR with Balance Sheet & Profit/Loss statement',
        'Latest 12 months Bank Statements (all active accounts)'
      ];
    }

    // 8. Home Loan
    if (loanProduct === 'Home Loan') {
      return [
        'Registered Agreement to Sale / Allotment Letter / Construction Estimate',
        'Sanctioned Building Plan & Title Chain Documents',
        'Builder / Society NOC, Share Certificate & Municipal Tax Receipt',
        'PAN Card & Aadhaar Card of Applicant & Co-applicant',
        employmentType === 'Salaried' 
          ? 'Latest 3 months salary slips & 2 years Form 16'
          : 'Last 3 years ITR with Balance Sheet & Computation',
        'Latest 6 to 12 months Bank Statements'
      ];
    }

    // 9. Business Loan
    if (loanProduct === 'Business Loan' || loanProduct === 'Working Capital / MSME Loan' || employmentType === 'Business Owner') {
      return [
        'PAN Card of Business Entity & Promoters',
        'Aadhaar Card of Promoters / Partners / Directors',
        'Udyam Registration Certificate & GST Registration Certificate',
        'Last 12 months GST Returns (GSTR-3B / GSTR-1)',
        'Last 2 years Audited Financial Statements (Balance Sheet, P&L, Audit Report)',
        'Last 12 months Primary Bank Statement',
        'Shop Act License / Partnership Deed / MOA & AOA'
      ];
    }

    // 10. Personal Loan
    if (employmentType === 'Salaried' || loanProduct === 'Personal Loan') {
      return [
        'Identity Proof: Aadhaar Card & PAN Card',
        'Current Address Proof (Utility Bill / Rent Agreement if renting)',
        'Latest 3 months Salary Slips with Official Seal',
        'Latest 6 months Salary Account Bank Statement',
        'Company ID Card / Appointment Letter'
      ];
    }

    // Default fallback
    return [
      'Aadhaar Card & PAN Card',
      'Latest 6 months Bank Statement',
      'Income Proof (Salary Slips or ITR)'
    ];
  }
}
