/**
 * AVANI LOAN SERVICES — CP-25 Canonical Multi-Branch Document Checklist Engine
 *
 * Implements exact section-by-section document checklists and multi-branch composition
 * for all applicant categories and loan categories per CP-25 Sections 5–12.
 */

export type ApplicantCategory =
  | 'Salaried'
  | 'Self Employed'
  | 'Business Owner'
  | 'Professional'
  | 'Doctor'
  | 'Chartered Accountant'
  | 'Student'
  | 'Farmer'
  | 'Pensioner'
  | 'Other Professional';

export type CanonicalLoanCategory =
  | 'Personal Loan'
  | 'Business Loan'
  | 'Doctor Loan'
  | 'Chartered Accountant Loan'
  | 'CA Professional Loan'
  | 'Home Loan'
  | 'Mortgage Loan / Loan Against Property'
  | 'Mortgage Loan / LAP'
  | 'Education Loan — India'
  | 'Education Loan — Abroad'
  | 'Education Loan — Global Studies'
  | 'School Funding'
  | 'College Funding'
  | 'Other / Not Sure';

export interface ChecklistSection {
  title: string;
  items: string[];
  note?: string;
}

export interface ComposedChecklistResult {
  applicantBranch: string;
  loanCategory: string;
  professionalType?: 'doctor' | 'chartered_accountant' | 'other';
  educationDestination?: 'India' | 'Abroad';
  coApplicantType?: 'Salaried' | 'Self-Employed' | 'Farmer' | 'Pension' | 'Rental';
  sections: ChecklistSection[];
  flattenedDocuments: string[];
  advisoryMessage: string;
  disclaimer: string;
}

export const NON_LENDER_ADVISORY_DISCLAIMER =
  'AVANI LOAN SERVICES is a loan advisory and consultancy service, not automatically the lending institution. Final eligibility, interest rates, terms, and approval depend on the partner bank or NBFC assessment and document verification.';

export const SALARIED_PERSONAL_LOAN_SECTIONS: ChecklistSection[] = [
  {
    title: 'Identity Proof',
    items: ['Aadhaar Card', 'PAN Card', 'Passport', 'Voter ID']
  },
  {
    title: 'Address Proof',
    items: ['Aadhaar Card', 'Utility Bill — last 3 months', 'Driving Licence']
  },
  {
    title: 'Income Documents',
    items: [
      "Last 3 months' salary slips",
      "Last 6 months' bank statements",
      'Form 16 — last 2 years, where applicable'
    ]
  },
  {
    title: 'Employment Proof',
    items: [
      'Employee ID Card',
      'Appointment Letter',
      'Offer Letter — for new joinees, where applicable'
    ]
  }
];

export const BUSINESS_SELF_EMPLOYED_SECTIONS: ChecklistSection[] = [
  {
    title: 'Identity and Address Proof',
    items: [
      'Individual PAN Card',
      'Business PAN, where applicable',
      'Aadhaar Card',
      'GST Registration Certificate, where applicable'
    ]
  },
  {
    title: 'Business Documents',
    items: [
      'Business Registration Certificate',
      'Udyam Registration Certificate, where applicable',
      'Shop and Establishment Certificate, where applicable',
      'Partnership Deed, if applicable',
      'MOA / AOA, if applicable'
    ]
  },
  {
    title: 'Financial Documents',
    items: [
      "Last 2 years' ITR",
      "Last 12 months' bank statements",
      "Last 2 years' audited balance sheets, where applicable"
    ]
  }
];

export const DOCTOR_CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    title: 'Professional Documents',
    items: [
      'Medical Degree Certificate',
      'Medical Registration Certificate',
      'Previous registration certificate, where applicable',
      'Clinic / Hospital Registration, where applicable'
    ]
  },
  {
    title: 'Identity and Address Proof',
    items: ['PAN Card', 'Aadhaar Card', 'Passport-size photograph']
  },
  {
    title: 'Financial Documents',
    items: [
      "Last 2 years' ITR",
      "Last 6–12 months' bank statements",
      'Current and savings account statements, where applicable',
      'Existing loan details, if any'
    ]
  }
];

export const CA_CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    title: 'Professional Documents',
    items: [
      'Certificate of Practice (COP), where applicable',
      'ICAI Membership Certificate'
    ]
  },
  {
    title: 'Identity and Address Proof',
    items: ['PAN Card', 'Aadhaar Card', 'Passport-size photograph']
  },
  {
    title: 'Financial Documents',
    items: [
      "Last 2 years' ITR",
      "Last 6–12 months' bank statements",
      'Existing loan details, if any'
    ]
  }
];

export const HOME_LOAN_PROPERTY_SECTION: ChecklistSection = {
  title: 'Property Documents',
  items: [
    'Sale Agreement / Allotment Letter',
    'Property Title Deed',
    'NOC from Builder / Society, where applicable',
    'Approved Building Plan',
    'Property Tax Receipts',
    'Original Title Deed, where applicable',
    'Encumbrance Certificate, where applicable',
    'NOC from Co-Owners, if applicable',
    'Valuation Report, where applicable'
  ],
  note: 'Final documents depend on property type, title status, lender and legal verification.'
};

export function getEducationLoanSections(options?: {
  destination?: 'India' | 'Abroad';
  coApplicantType?: 'Salaried' | 'Self-Employed' | 'Farmer';
  additionalIncome?: 'Pension' | 'Rental';
  includeWorkExperience?: boolean;
  includeCollateralAndFamily?: boolean;
  includeConsentedReferences?: boolean;
}): ChecklistSection[] {
  const dest = options?.destination || 'India';
  const studentItems: string[] = [
    'Admission Letter',
    ...(dest === 'Abroad'
      ? [
          'Passport — relevant pages',
          'Entrance / Language Test Scorecards, where applicable (GRE / TOEFL / Duolingo English Test / PTE / IELTS)'
        ]
      : ['Passport — relevant pages, where applicable']),
    'Academic Certificates: 10th / SSC Marksheet, 12th / Intermediate / Diploma Marksheets, Degree-wise Marksheets, B.Tech Transcripts (where applicable), CMM, PC',
    ...(options?.includeWorkExperience !== false
      ? ['Work Experience Documents, where applicable (Experience Letter, Offer Letter, Relieving Letter, Resume)']
      : []),
    'Aadhaar Card, where applicable',
    'PAN Card, where applicable',
    'Email ID',
    'Mobile Number'
  ];

  const sections: ChecklistSection[] = [
    {
      title: `A. Student Documents (${dest})`,
      items: studentItems,
      note: 'Not every examination or certificate is mandatory for every student; share only applicable documents.'
    },
    {
      title: 'B. Co-Applicant Details (Father / Mother / Sibling / Eligible Blood Relative)',
      items: [
        'Co-applicant full name',
        'Relationship with student',
        'Mobile number',
        'Email',
        'City'
      ]
    }
  ];

  const coApp = options?.coApplicantType || 'Salaried';
  if (coApp === 'Salaried') {
    sections.push({
      title: 'C. Co-Applicant — Salaried',
      items: [
        'Aadhaar Card',
        'PAN Card',
        "Latest 3 months' salary slips",
        "Latest 6 months' bank statements",
        "Latest 2 years' Form 16, where applicable",
        'Email ID',
        'Mobile Number'
      ]
    });
  } else if (coApp === 'Self-Employed') {
    sections.push({
      title: 'D. Co-Applicant — Self-Employed',
      items: [
        'Aadhaar Card',
        'PAN Card',
        "Latest 2 years' ITR",
        'Balance Sheet',
        'Profit and Loss Statement',
        'Business proof',
        'GST Registration, where applicable',
        'Applicable labour / business licences',
        "Latest 6 months' bank statements",
        'Email ID',
        'Mobile Number'
      ]
    });
  } else if (coApp === 'Farmer') {
    sections.push({
      title: 'E. Co-Applicant — Farmer',
      items: [
        'Aadhaar Card',
        'PAN Card',
        'Patta Passbook / applicable land ownership record',
        'Agriculture Income Certificate, where applicable',
        "Latest 6 months' bank statements",
        'Email ID',
        'Mobile Number'
      ]
    });
  }

  if (options?.additionalIncome === 'Pension') {
    sections.push({
      title: 'F. Additional Income — Pension Income',
      items: [
        'Aadhaar Card',
        'PAN Card',
        'Pension receipts / pension statement',
        "Latest 6 months' bank statements",
        'Email ID',
        'Mobile Number'
      ]
    });
  } else if (options?.additionalIncome === 'Rental') {
    sections.push({
      title: 'F. Additional Income — Rental Income',
      items: [
        'Aadhaar Card',
        'PAN Card',
        'Rental Agreements',
        "Latest 6 months' bank statements",
        'Email ID',
        'Mobile Number'
      ]
    });
  }

  if (options?.includeCollateralAndFamily) {
    const familyItems = [
      "Mother's Aadhaar and PAN, where required by lender",
      'Email ID and mobile number',
      'Own-house proof, if applicable',
      'Property Tax Receipt',
      'Latest Electricity Bill'
    ];
    if (options?.includeConsentedReferences) {
      familyItems.push(
        'Two references, if required by lender policy (Reference Name, Reference Number, Reference Email, Full Address — only collected after explaining purpose and obtaining appropriate consent)'
      );
    }
    sections.push({
      title: 'G. Additional Family / Property Details',
      items: familyItems
    });
  }

  sections.push({
    title: 'H. Education Loan Financial Documents',
    items: [
      'Co-applicant KYC',
      'Co-applicant income proof',
      'ITR — 2 years, where applicable',
      'Bank statements — lender-required period',
      'Property documents, only if collateral is required'
    ]
  });

  return sections;
}

export const SCHOOL_FUNDING_SECTIONS: ChecklistSection[] = [
  {
    title: 'Institutional & Trust Registration Documents',
    items: [
      'Trust / Society / Section 8 Registration Certificate & Deed',
      'School Affiliation & Recognition Certificate (CBSE / ICSE / State Board)',
      '12A & 80G Registration Certificates, where applicable'
    ]
  },
  {
    title: 'Financial & Property Documents',
    items: [
      "Last 3 years' Audited Financials & Balance Sheet",
      "Last 12 months' Bank Statements of Institutional Accounts",
      'Student Enrollment & Fee Structure Summary',
      'School Campus Land / Building Title Deeds & Approved Plans, where collateral applies'
    ]
  }
];

export const COLLEGE_FUNDING_SECTIONS: ChecklistSection[] = [
  {
    title: 'Institutional & Regulatory Approvals',
    items: [
      'Trust / Society / Educational Entity Registration Certificate & Bylaws',
      'University / AICTE / UGC / NMC Affiliation & Approval Letters'
    ]
  },
  {
    title: 'Financial & Infrastructure Documents',
    items: [
      "Last 3 years' Audited Balance Sheets & Income/Expenditure Statements",
      "Last 12 months' Institutional Bank Statements",
      'Course-wise Student Strength & Fee Collection Ledger',
      'Campus Land & Building Title Deeds with Sanctioned Plans, where collateral applies'
    ]
  }
];

/**
 * Deduplicates items within each section and across combined property/income sections.
 */
function deduplicateSectionItems(section: ChecklistSection): ChecklistSection {
  const seen = new Set<string>();
  const uniqueItems: string[] = [];
  for (const item of section.items) {
    const key = item.trim();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueItems.push(key);
    }
  }
  return { ...section, items: uniqueItems };
}

/**
 * Composes multi-section checklists based on BOTH Applicant Category / Profession AND Loan Category.
 */
export function composeMultiBranchChecklist(params: {
  applicantType?: string;
  profession?: string;
  loanCategory: string;
  educationDestination?: 'India' | 'Abroad';
  coApplicantType?: 'Salaried' | 'Self-Employed' | 'Farmer';
  additionalIncome?: 'Pension' | 'Rental';
  includeCollateralAndFamily?: boolean;
  includeConsentedReferences?: boolean;
}): ComposedChecklistResult {
  const rawApplicant = (params.applicantType || '').trim();
  const rawProf = (params.profession || '').trim().toLowerCase();
  const rawLoan = (params.loanCategory || 'Personal Loan').trim();

  const isDoctor =
    rawProf.includes('doctor') ||
    rawApplicant.toLowerCase().includes('doctor') ||
    rawLoan === 'Doctor Loan';

  const isCA =
    rawProf === 'ca' ||
    rawProf.includes('chartered accountant') ||
    rawApplicant.toLowerCase().includes('chartered accountant') ||
    rawLoan === 'Chartered Accountant Loan' ||
    rawLoan === 'CA Professional Loan';

  const isBusinessOrSelfEmployed =
    !isDoctor &&
    !isCA &&
    (rawApplicant === 'Self Employed' ||
      rawApplicant === 'Business Owner' ||
      rawLoan === 'Business Loan');

  let professionalType: 'doctor' | 'chartered_accountant' | 'other' | undefined;
  if (isDoctor) professionalType = 'doctor';
  else if (isCA) professionalType = 'chartered_accountant';
  else if (rawApplicant === 'Professional' || rawApplicant === 'Other Professional') {
    professionalType = 'other';
  }

  // 1. Education Loan Workflow (India or Abroad)
  if (
    rawLoan === 'Education Loan — India' ||
    rawLoan === 'Education Loan — Abroad' ||
    rawLoan === 'Education Loan — Global Studies' ||
    rawLoan === 'Education Loan'
  ) {
    const destination: 'India' | 'Abroad' =
      params.educationDestination ||
      (rawLoan.includes('Abroad') || rawLoan.includes('Global') ? 'Abroad' : 'India');

    const sections = getEducationLoanSections({
      destination,
      coApplicantType: params.coApplicantType || 'Salaried',
      additionalIncome: params.additionalIncome,
      includeCollateralAndFamily: params.includeCollateralAndFamily,
      includeConsentedReferences: params.includeConsentedReferences
    }).map(deduplicateSectionItems);

    return {
      applicantBranch: 'F. Education Loan Applicant',
      loanCategory: destination === 'Abroad' ? 'Education Loan — Abroad' : 'Education Loan — India',
      educationDestination: destination,
      coApplicantType: params.coApplicantType || 'Salaried',
      sections,
      flattenedDocuments: Array.from(new Set(sections.flatMap(s => s.items))),
      advisoryMessage:
        'Please share documents according to the checklist, one section at a time. Our advisor will review the applicable requirements before proceeding.',
      disclaimer: NON_LENDER_ADVISORY_DISCLAIMER
    };
  }

  // 2. Home Loan OR Mortgage Loan / LAP (Multi-Section: Applicant Income Branch + Property Branch)
  if (
    rawLoan === 'Home Loan' ||
    rawLoan === 'Mortgage Loan / Loan Against Property' ||
    rawLoan === 'Mortgage Loan / LAP'
  ) {
    let incomeSections: ChecklistSection[] = [];
    let branchLabel = 'G. Home Loan Applicant (Salaried Income + Property)';

    if (isDoctor) {
      incomeSections = DOCTOR_CHECKLIST_SECTIONS.map(s => ({
        ...s,
        title: `Doctor Applicant — ${s.title}`
      }));
      branchLabel = 'G. Home Loan Applicant (Doctor Income + Property)';
    } else if (isCA) {
      incomeSections = CA_CHECKLIST_SECTIONS.map(s => ({
        ...s,
        title: `Chartered Accountant Applicant — ${s.title}`
      }));
      branchLabel = 'G. Home Loan Applicant (CA Income + Property)';
    } else if (isBusinessOrSelfEmployed) {
      incomeSections = BUSINESS_SELF_EMPLOYED_SECTIONS.map(s => ({
        ...s,
        title: `Business / Self-Employed Applicant — ${s.title}`
      }));
      branchLabel = 'G. Home Loan Applicant (Business / Self-Employed Income + Property)';
    } else {
      incomeSections = SALARIED_PERSONAL_LOAN_SECTIONS.map(s => ({
        ...s,
        title: `Salaried Applicant — ${s.title}`
      }));
    }

    const sections = [...incomeSections, HOME_LOAN_PROPERTY_SECTION].map(deduplicateSectionItems);
    return {
      applicantBranch: branchLabel,
      loanCategory: rawLoan,
      professionalType,
      sections,
      flattenedDocuments: Array.from(new Set(sections.flatMap(s => s.items))),
      advisoryMessage:
        'Final documents depend on property type, title status, lender and legal verification. Our advisor will confirm the applicable documents.',
      disclaimer: NON_LENDER_ADVISORY_DISCLAIMER
    };
  }

  // 3. Doctor Loan (or Doctor seeking Personal/Professional Loan)
  if (isDoctor) {
    const sections = DOCTOR_CHECKLIST_SECTIONS.map(deduplicateSectionItems);
    return {
      applicantBranch: 'D. Doctor',
      loanCategory: rawLoan,
      professionalType: 'doctor',
      sections,
      flattenedDocuments: Array.from(new Set(sections.flatMap(s => s.items))),
      advisoryMessage:
        'Please review this checklist for medical professionals. Final document requirements may vary by lender policy. Our advisor will confirm the applicable documents.',
      disclaimer: NON_LENDER_ADVISORY_DISCLAIMER
    };
  }

  // 4. Chartered Accountant Loan (or CA seeking Personal/Professional Loan)
  if (isCA) {
    const sections = CA_CHECKLIST_SECTIONS.map(deduplicateSectionItems);
    return {
      applicantBranch: 'E. Chartered Accountant',
      loanCategory: rawLoan,
      professionalType: 'chartered_accountant',
      sections,
      flattenedDocuments: Array.from(new Set(sections.flatMap(s => s.items))),
      advisoryMessage:
        'Please review this checklist for Chartered Accountants. Final document requirements may vary by lender policy. Our advisor will confirm the applicable documents.',
      disclaimer: NON_LENDER_ADVISORY_DISCLAIMER
    };
  }

  // 5. School Funding
  if (rawLoan === 'School Funding') {
    const sections = SCHOOL_FUNDING_SECTIONS.map(deduplicateSectionItems);
    return {
      applicantBranch: 'C. Business Owner / Educational Institution',
      loanCategory: 'School Funding',
      sections,
      flattenedDocuments: Array.from(new Set(sections.flatMap(s => s.items))),
      advisoryMessage:
        'Document requirements depend on the institutional constitution and lender policy. Our advisor will confirm the final checklist.',
      disclaimer: NON_LENDER_ADVISORY_DISCLAIMER
    };
  }

  // 6. College Funding
  if (rawLoan === 'College Funding') {
    const sections = COLLEGE_FUNDING_SECTIONS.map(deduplicateSectionItems);
    return {
      applicantBranch: 'C. Business Owner / Educational Institution',
      loanCategory: 'College Funding',
      sections,
      flattenedDocuments: Array.from(new Set(sections.flatMap(s => s.items))),
      advisoryMessage:
        'Document requirements depend on the institutional constitution and lender policy. Our advisor will confirm the final checklist.',
      disclaimer: NON_LENDER_ADVISORY_DISCLAIMER
    };
  }

  // 7. Business Owner / Self-Employed (seeking Business Loan OR Personal Loan)
  if (isBusinessOrSelfEmployed) {
    const sections = BUSINESS_SELF_EMPLOYED_SECTIONS.map(deduplicateSectionItems);
    const branch = rawApplicant === 'Self Employed' ? 'B. Self Employed' : 'C. Business Owner';
    const isPersonalLoanForBiz = rawLoan === 'Personal Loan';
    return {
      applicantBranch: branch,
      loanCategory: rawLoan,
      sections,
      flattenedDocuments: Array.from(new Set(sections.flatMap(s => s.items))),
      advisoryMessage: isPersonalLoanForBiz
        ? 'As a self-employed / business owner applicant seeking a Personal Loan, lenders assess your individual KYC and ITR/banking financial documents rather than assuming a commercial business loan. Our advisor will confirm the final checklist.'
        : 'Document requirements depend on the nature of your business, constitution and lender policy. Our advisor will confirm the final checklist.',
      disclaimer: NON_LENDER_ADVISORY_DISCLAIMER
    };
  }

  // 8. Other / Not Sure or Unverified Category
  if (rawLoan === 'Other / Not Sure') {
    return {
      applicantBranch: rawApplicant === 'Professional' ? 'H. Other Professional' : 'A. Salaried',
      loanCategory: 'Other / Not Sure',
      professionalType,
      sections: [],
      flattenedDocuments: [],
      advisoryMessage:
        'Our advisor will share the relevant document checklist after understanding your requirement.',
      disclaimer: NON_LENDER_ADVISORY_DISCLAIMER
    };
  }

  // 9. Default: Personal Loan for Salaried Applicants
  const sections = SALARIED_PERSONAL_LOAN_SECTIONS.map(deduplicateSectionItems);
  return {
    applicantBranch: rawApplicant === 'Professional' ? 'H. Other Professional' : 'A. Salaried',
    loanCategory: 'Personal Loan',
    professionalType,
    sections,
    flattenedDocuments: Array.from(new Set(sections.flatMap(s => s.items))),
    advisoryMessage:
      'Please review this checklist. The final document requirement may vary depending on the lender and your employment profile. Our advisor will confirm the applicable documents.',
    disclaimer: NON_LENDER_ADVISORY_DISCLAIMER
  };
}

/**
 * Formats a ComposedChecklistResult into a clean WhatsApp-ready message string.
 */
export function formatChecklistForWhatsApp(checklist: ComposedChecklistResult): string {
  if (!checklist.sections.length) {
    return `${checklist.advisoryMessage}\n\n_${checklist.disclaimer}_`;
  }

  const sectionBlocks = checklist.sections.map(sec => {
    const lines = sec.items.map(item => `• ${item}`).join('\n');
    const noteLine = sec.note ? `\n  _(${sec.note})_` : '';
    return `*${sec.title}*\n${lines}${noteLine}`;
  });

  return [
    `*Document Checklist — ${checklist.loanCategory}*`,
    `_(Applicant Profile: ${checklist.applicantBranch})_`,
    '',
    ...sectionBlocks,
    '',
    checklist.advisoryMessage,
    '',
    `_${checklist.disclaimer}_`
  ].join('\n');
}
