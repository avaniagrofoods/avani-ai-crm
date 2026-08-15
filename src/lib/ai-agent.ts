const GEMINI_API_KEY = (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '').trim();

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
      const msg = await this.translateText("No problem. Please let us know if you change your mind.", conversation.language);
      return { nextQuestion: msg, updatedState: 'CUSTOMER_DECLINED' };
    }
    
    if (extraction.intent === 'HUMAN_HANDOFF') {
      conversation.currentState = 'HUMAN_HANDOFF';
      const msg = await this.translateText("I will arrange for one of our loan advisors to call you shortly.", conversation.language);
      return { nextQuestion: msg, updatedState: 'HUMAN_HANDOFF' };
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
      
      const docListString = docList.map((d:string) => "- " + d).join('\n');
      nextQuestion = await this.translateText(
        `Great! Based on your profile, here are the documents required for your loan processing:\n\n${docListString}\n\nPlease share these documents here, or type "advisor" to speak to a human.`, 
        conversation.language
      );
    } else if (nextState === 'DOCUMENTS_PENDING') {
      nextQuestion = await this.translateText("Please upload the requested documents, or type 'advisor' if you need help.", conversation.language);
    } else {
      nextQuestion = await this.generateQuestionForState(nextState, conversation.language);
    }
    
    return { nextQuestion, updatedState: conversation.currentState };
  }
  
  static determineNextState(context: any, currentState: string) {
    if (!context) return 'COLLECT_FULL_NAME';
    
    if (!context.fullName) return 'COLLECT_FULL_NAME';
    // Often mobile is provided via WhatsApp number, but we collect it if not
    if (!context.mobile) return 'COLLECT_MOBILE';
    if (!context.email) return 'COLLECT_EMAIL';
    if (!context.city) return 'COLLECT_CITY';
    if (!context.employmentType) return 'COLLECT_EMPLOYMENT';
    // Income
    if (!context.monthlyIncome) return 'COLLECT_MONTHLY_INCOME';
    // Loan details
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
The user sent a message. You must analyze the message and extract the following in strict JSON format.

Current Conversation State: ${conversation.currentState}
Language History: ${conversation.language}

Rules:
1. language: detect language ('en' for English, 'mr' for Marathi, 'hi' for Hindi).
2. intent: 'ANSWER' (answering a question), 'DECLINE' (rejecting, not interested), 'HUMAN_HANDOFF' (wants to speak to an agent/advisor).
3. extractedData: only include fields if they are explicitly or implicitly answered in the text.
    - fullName: string
    - email: string
    - city: string
    - employmentType: one of ["Salaried", "Self Employed", "Business Owner", "Doctor / Medical Professional", "Chartered Accountant", "Other Professional", "Farmer", "Pensioner", "Rental Income"]
    - profession: if Professional or Doctor or CA, one of ["Doctor", "Chartered Accountant", "Other Professional"]
    - monthlyIncome: map to one of ["₹25K–₹50K", "₹50K–₹1L", "₹1L–₹2L", "Above ₹2L"]
    - loanProduct: one of ["Personal Loan", "Business Loan", "Doctor / Professional Loan", "Home Loan", "Mortgage / LAP", "Education Loan"]
    - loanAmount: numeric string (e.g. "3000000" for 30 Lakhs)

If the user answers ambiguously, do not guess the product. (e.g. "I want a loan" -> do not set loanProduct).
If the user says "CA", map profession to "Chartered Accountant".

User Message: "${text}"

Respond with ONLY raw JSON, no markdown blocks.
Example:
{
  "language": "mr",
  "intent": "ANSWER",
  "extractedData": {
    "loanProduct": "Doctor Loan",
    "profession": "Doctor"
  }
}
`;
    if (process.env.PROVIDER_MODE === 'mock' || !GEMINI_API_KEY.length) {
      console.log(`[MOCK GEMINI] Extracting entities for: "${text}"`);
      if (text.includes("डॉक्टर लोन") || text.toLowerCase().includes("doctor loan")) {
        return { language: 'mr', intent: 'ANSWER', extractedData: { loanProduct: "Doctor Loan" } };
      }
      if (text.includes("1 लाख")) {
        return { language: 'mr', intent: 'ANSWER', extractedData: { monthlyIncome: "₹50K–₹1L" } };
      }
      if (text.includes("30 लाख")) {
        return { language: 'mr', intent: 'ANSWER', extractedData: { loanAmount: "3000000" } };
      }
      if (text.toLowerCase().includes("doctor") || text.includes("डॉक्टर")) {
        return { language: 'mr', intent: 'ANSWER', extractedData: { profession: "Doctor" } };
      }
      return { language: 'en', intent: 'ANSWER', extractedData: {} };
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
       if (text.includes("What is your full name?")) return "तुमचे पूर्ण नाव काय आहे?";
       if (text.includes("monthly income range")) return "तुमचे मासिक उत्पन्न किती आहे?";
       if (text.includes("loan amount do you require")) return "तुम्हाला किती कर्जाची आवश्यकता आहे?";
       if (text.includes("documents required")) return "तुमच्या प्रोफाईलनुसार, कृपया खालील कागदपत्रे शेअर करा:\n\n- PAN Card\n- Aadhaar Card";
       return text;
    }

    const prompt = `Translate the following text to ${language === 'mr' ? 'Marathi' : 'Hindi'} maintaining a professional and polite tone for a loan advisor:\n\n"${text}"\n\nProvide ONLY the translated text, nothing else.`;
    
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
      case 'COLLECT_MOBILE': q = "What is your mobile number?"; break;
      case 'COLLECT_EMAIL': q = "What is your email address?"; break;
      case 'COLLECT_CITY': q = "Which city do you live in?"; break;
      case 'COLLECT_EMPLOYMENT': q = "What is your employment type? (Salaried, Self Employed, Business Owner, Professional, Farmer, Pensioner, Rental Income)"; break;
      case 'COLLECT_MONTHLY_INCOME': q = "What is your monthly income range? (₹25K–₹50K, ₹50K–₹1L, ₹1L–₹2L, Above ₹2L)"; break;
      case 'COLLECT_LOAN_PRODUCT': q = "Which type of loan are you looking for? (Personal, Business, Doctor, Home, Mortgage, Education)"; break;
      case 'COLLECT_LOAN_AMOUNT': q = "How much loan amount do you require?"; break;
      default: q = "How can I help you today?";
    }
    
    return await this.translateText(q, language);
  }
  
  static getDocumentsForProfile(employmentType: string, profession: string, loanProduct: string) {
    // Implement rigid deterministic document routing
    if (loanProduct === 'Doctor / Professional Loan' || loanProduct === 'Doctor Loan' || profession === 'Doctor' || employmentType === 'Doctor / Medical Professional') {
      return [
        'Degree Certificate',
        'Registration Certificates',
        'Clinic/Hospital Registration',
        'PAN Card',
        'Aadhaar Card',
        'Passport-size photo',
        'Last 2 years ITR',
        'Last 6–12 months bank statements',
        'Existing loan details'
      ];
    }
    
    if (loanProduct === 'Education Loan') {
      let docs = [
        'Admission Letter',
        'Passport',
        'Score Card (GRE/TOEFL/Duolingo/PTE/IELTS where applicable)',
        'Academic certificates',
        'Work experience documents',
        'Aadhaar Card',
        'PAN Card',
        'Email/mobile'
      ];
      if (employmentType === 'Salaried') {
         docs.push('Co-applicant: Latest 3 months payslips', 'Co-applicant: Latest 6 months bank statements', 'Co-applicant: Last 2 years Form 16');
      } else if (employmentType === 'Farmer') {
         docs.push('Co-applicant: Patta/passbook', 'Co-applicant: Agriculture income certificate', 'Co-applicant: Latest 6 months bank statements');
      } else if (employmentType === 'Pensioner') {
         docs.push('Co-applicant: Pension receipts', 'Co-applicant: Latest 6 months bank statements');
      } else {
         docs.push('Co-applicant: Last 2 years ITR', 'Co-applicant: Balance sheet / P&L', 'Co-applicant: Latest 6 months bank statements');
      }
      return docs;
    }
    
    if (loanProduct === 'Home Loan' || loanProduct === 'Mortgage / LAP') {
       let docs = [
        'Sale agreement / allotment letter',
        'Property title deed',
        'Builder/society NOC',
        'Approved building plan',
        'Property tax receipts',
        'Original title deed',
        'Encumbrance certificate',
        'Co-owner NOC where applicable',
        'Valuation report'
       ];
       if (employmentType === 'Salaried') {
           docs.push('Last 3 months salary slips', 'Last 6 months bank statements', 'Last 2 years Form 16', 'Aadhaar & PAN');
       } else {
           docs.push('Last 2 years ITR', 'Last 12 months bank statements', 'Aadhaar & PAN', 'Business Registration');
       }
       return docs;
    }
    
    if (profession === 'Chartered Accountant' || employmentType === 'Chartered Accountant') {
      return [
        'Certificate of Practice',
        'ICAI Membership',
        'PAN Card',
        'Aadhaar Card',
        'Passport-size photo',
        'Last 2 years ITR',
        'Last 6–12 months bank statements',
        'Existing loan details'
      ];
    }
    
    if (employmentType === 'Salaried' || loanProduct === 'Personal Loan') {
      return [
        'Identity: Aadhaar, PAN, Passport, Voter ID',
        'Address: Aadhaar, Utility Bill, Driving Licence',
        'Income: Last 3 months salary slips, Last 6 months bank statements, Form 16',
        'Employment: Employee ID, Appointment Letter, Offer Letter where applicable'
      ];
    }
    
    if (employmentType === 'Business Owner' || employmentType === 'Self Employed' || loanProduct === 'Business Loan') {
      return [
        'Identity/address: PAN, Aadhaar, GST certificate',
        'Business: Udyam/business registration, Shop & Establishment, Partnership deed/MOA where applicable',
        'Financial: Last 2 years ITR, Last 12 months bank statements, Last 2 years audited balance sheet'
      ];
    }
    
    // Default fallback
    return [
      'Aadhaar Card',
      'PAN Card',
      'Last 6 months bank statements'
    ];
  }
}
