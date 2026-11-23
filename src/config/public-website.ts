/**
 * AVANI LOAN SERVICES — AUTHORITATIVE PUBLIC BUSINESS PROFILE, SERVICES, BLOGS & JSON-LD
 *
 * Single source of truth for the public website (https://www.avanifinserv.com/).
 * Strictly reflects owner-supplied verified details only.
 * Zero invented interest rates, approval promises, timelines, ratings, awards, or lender logos.
 */

export const OFFICIAL_BUSINESS = {
  name: 'AVANI LOAN SERVICES',
  ownerFounder: 'Sachin Shinde',
  industry: 'Financial Services | Loan Consultancy | Loan Advisory',
  websiteUrl: 'https://www.avanifinserv.com',
  websiteDisplay: 'https://www.avanifinserv.com/',
  email: 'enquiry@avanifinserv.com',
  mailtoHref: 'mailto:enquiry@avanifinserv.com',
  whatsappDisplay: '+91 91756 35165',
  whatsappDigits: '919175635165',
  whatsappBaseUrl: 'https://wa.me/919175635165',
  defaultWhatsappMessage:
    'Hello AVANI LOAN SERVICES, I would like to enquire about your loan consultancy services.',
  officeAddressFull:
    'OLD BARSHI ROAD, 5NO CHAUK, KULSWAMINI NAGAR, NEXT TO SAI SCHOOL, LATUR – 413512, MAHARASHTRA, INDIA',
  addressStructured: {
    streetAddress: 'OLD BARSHI ROAD, 5NO CHAUK, KULSWAMINI NAGAR, NEXT TO SAI SCHOOL',
    addressLocality: 'LATUR',
    addressRegion: 'MAHARASHTRA',
    postalCode: '413512',
    addressCountry: 'IN'
  },
  locationShort: 'Latur, Maharashtra, India',
  homepageHeadline: 'Loan Guidance and Financial Solutions for Your Next Step',
  homepageIntro:
    'AVANI LOAN SERVICES is a loan consultancy and advisory service based in Latur, Maharashtra. Founded by Sachin Shinde, we assist salaried professionals, business owners, doctors, students, parents, property buyers and educational institutions with loan enquiries, application assistance and coordination with relevant lending institutions.'
} as const;

export function buildOfficialWhatsAppUrl(customMessage?: string): string {
  const text = (customMessage || OFFICIAL_BUSINESS.defaultWhatsappMessage).trim();
  return `${OFFICIAL_BUSINESS.whatsappBaseUrl}?text=${encodeURIComponent(text)}`;
}

export const TARGET_AUDIENCES = [
  'Salaried Professionals',
  'Business Owners',
  'Doctors',
  'Chartered Accountants',
  'Architects',
  'Engineers',
  'Working Professionals',
  'Self-Employed Individuals',
  'Students Seeking Higher Education',
  'Parents Seeking Education Funding',
  'Property Buyers',
  'MSMEs and SMEs'
] as const;

export interface PublicLoanService {
  slug: string;
  name: string;
  shortName: string;
  coreOfficial: boolean;
  enquiryCategory: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  shortSummary: string;
  intro: string;
  suitableFor: string[];
  commonUseCases: string[];
  eligibilityConsiderations: string[];
  generalDocuments: string[];
  processSteps: string[];
  faqs: Array<{ question: string; answer: string }>;
  relatedSlugs: string[];
  whatsappMessage: string;
}

const STANDARD_ASSISTANCE_STEPS = [
  'Share your basic loan requirement, city and contact details through the minimal enquiry form or official WhatsApp desk.',
  'Receive structured consultancy guidance on suitable loan categories and lender-requested general document checklists.',
  'Organise your application information and supporting paperwork offline directly as required by the prospective lender.',
  'AVANI LOAN SERVICES coordinates application queries and general progress follow-up with relevant lending institutions, while final underwriting and sanction remain solely with the lender.'
];

export const PUBLIC_LOAN_SERVICES: PublicLoanService[] = [
  {
    slug: 'personal-loan',
    name: 'Personal Loan',
    shortName: 'Personal Loan',
    coreOfficial: true,
    enquiryCategory: 'Personal Loan',
    metaTitle: 'Personal Loan Consultancy & Advisory | AVANI LOAN SERVICES',
    metaDescription:
      'Independent Personal Loan consultancy in Latur, Maharashtra by AVANI LOAN SERVICES. Guidance on enquiries, general documentation checklists, and lender coordination.',
    h1: 'Personal Loan Consultancy & Application Assistance',
    shortSummary:
      'Structured consultancy for salaried and working professionals exploring personal financing options for planned or urgent financial needs.',
    intro:
      'AVANI LOAN SERVICES assists salaried professionals, working professionals and eligible self-employed individuals in understanding Personal Loan options, preparing basic enquiry details, and coordinating with relevant lending institutions. Final eligibility, interest rates, loan amounts and approval remain subject to the respective lender’s assessment and terms.',
    suitableFor: [
      'Salaried Professionals with verifiable regular income',
      'Working Professionals planning structured personal expenses',
      'Self-Employed Individuals meeting lender income criteria'
    ],
    commonUseCases: [
      'Planned family milestones, medical expenses or personal commitments',
      'Home renovation or household upgrade requirements',
      'Consolidating scattered personal obligations under a single repayment structure (subject to lender approval)'
    ],
    eligibilityConsiderations: [
      'Age, employment continuity and monthly net income norms set by the prospective lender',
      'Existing repayment obligations and overall repayment capacity (FOIR) evaluated by the lender',
      'Credit history and repayment track record assessed independently by lending institutions'
    ],
    generalDocuments: [
      'Identity and address verification records commonly requested by lenders',
      'Recent salary slips or income verification records as applicable',
      'Recent bank account statements requested directly during formal lender submission'
    ],
    processSteps: STANDARD_ASSISTANCE_STEPS,
    faqs: [
      {
        question: 'Does AVANI LOAN SERVICES directly lend money for Personal Loans?',
        answer:
          'No. AVANI LOAN SERVICES is an independent loan consultancy and advisory service. We assist with enquiries, general guidance and lender coordination; lending decisions are made solely by banks or NBFCs.'
      },
      {
        question: 'Should I upload my Aadhaar, PAN or salary slips on this website?',
        answer:
          'No. Please do not upload or submit Aadhaar, PAN, bank statements, salary slips or credit reports through unsecured public website forms. Only basic contact and requirement details are needed to start an enquiry.'
      }
    ],
    relatedSlugs: ['home-loan', 'professional-loan', 'business-loan'],
    whatsappMessage:
      'Hello AVANI LOAN SERVICES, I would like to enquire about Personal Loan consultancy and guidance.'
  },
  {
    slug: 'business-loan',
    name: 'Business Loan',
    shortName: 'Business Loan',
    coreOfficial: true,
    enquiryCategory: 'Business Loan',
    metaTitle: 'Business Loan Consultancy & Advisory | AVANI LOAN SERVICES',
    metaDescription:
      'Business Loan advisory and application assistance for business owners, MSMEs and SMEs in Latur and Maharashtra by AVANI LOAN SERVICES.',
    h1: 'Business Loan Consultancy for Owners, MSMEs & SMEs',
    shortSummary:
      'Consultancy and lender coordination for business owners, MSMEs and SMEs seeking capital for expansion, inventory or operational stability.',
    intro:
      'Running or expanding an enterprise often requires timely, well-structured credit planning. AVANI LOAN SERVICES provides independent Business Loan consultancy to business owners, self-employed entrepreneurs, MSMEs and SMEs, helping clarify requirement sizing, general lender documentation expectations and application coordination.',
    suitableFor: [
      'Business Owners across trading, manufacturing and services',
      'MSMEs and SMEs planning expansion or equipment purchases',
      'Self-Employed Individuals operating established commercial enterprises'
    ],
    commonUseCases: [
      'Business expansion, new branch setup or capacity enhancement',
      'Inventory procurement, seasonal cash-flow management and working capital support',
      'Machinery, tools or commercial technology upgrades'
    ],
    eligibilityConsiderations: [
      'Business vintage, turnover profile and financial statements evaluated by lenders',
      'GST registration, business continuity and banking transaction history where applicable',
      'Promoter credit profile and existing business liabilities assessed by the lender'
    ],
    generalDocuments: [
      'Business registration and constitutional records requested by lending institutions',
      'Income Tax Returns (ITR), financial statements and GST filings where applicable',
      'Business banking statements and promoter KYC shared directly through formal lender channels'
    ],
    processSteps: STANDARD_ASSISTANCE_STEPS,
    faqs: [
      {
        question: 'Can AVANI LOAN SERVICES assist both MSMEs and growing SMEs?',
        answer:
          'Yes. We assist proprietorships, partnerships, MSMEs and SMEs in understanding suitable business and working capital loan categories and coordinating enquiries with relevant lenders.'
      },
      {
        question: 'Are interest rates or sanction timelines guaranteed?',
        answer:
          'No. Interest rates, fees, sanctioned limits and processing timelines depend entirely on the lender’s underwriting policies and verification of applicant documents.'
      }
    ],
    relatedSlugs: ['msme-working-capital-loan', 'mortgage-loan', 'professional-loan'],
    whatsappMessage:
      'Hello AVANI LOAN SERVICES, I would like to enquire about Business Loan consultancy services.'
  },
  {
    slug: 'doctor-loan',
    name: 'Doctor Loan',
    shortName: 'Doctor Loan',
    coreOfficial: true,
    enquiryCategory: 'Doctor Loan',
    metaTitle: 'Doctor Loan Consultancy for Medical Professionals | AVANI LOAN SERVICES',
    metaDescription:
      'Dedicated Doctor Loan advisory and application guidance for doctors and medical practitioners by AVANI LOAN SERVICES, Latur, Maharashtra.',
    h1: 'Doctor Loan Advisory & Application Assistance',
    shortSummary:
      'Focused loan consultancy for doctors and medical professionals planning clinic setup, diagnostic equipment or practice expansion.',
    intro:
      'Medical professionals have distinct financial requirements when establishing a clinic, upgrading diagnostic facilities or expanding a hospital practice. AVANI LOAN SERVICES assists doctors and medical practitioners with structured Doctor Loan enquiry guidance, documentation preparation awareness and lender coordination.',
    suitableFor: [
      'Doctors holding recognised medical qualifications (e.g., MBBS, MD, MS, BDS, MDS and eligible specialists, subject to lender criteria)',
      'Independent clinical practitioners and nursing home / polyclinic owners',
      'Salaried and visiting medical consultants planning practice or personal milestones'
    ],
    commonUseCases: [
      'Clinic or consultation centre establishment and interior fit-out',
      'Medical, surgical or diagnostic equipment procurement',
      'Practice working capital or hospital facility expansion'
    ],
    eligibilityConsiderations: [
      'Medical degree, council registration and post-qualification practice tenure per lender policy',
      'Practice income profile, clinic banking history and existing financial obligations',
      'Credit history and collateral requirements (if any) as evaluated by the lender'
    ],
    generalDocuments: [
      'Medical qualification certificate and professional registration proof requested by lenders',
      'Practice continuity proof, ITRs and financial statements as applicable',
      'Banking and KYC documentation shared strictly through secure lender-approved channels'
    ],
    processSteps: STANDARD_ASSISTANCE_STEPS,
    faqs: [
      {
        question: 'Can newly established clinics enquire about Doctor Loan options?',
        answer:
          'Yes, you can submit an enquiry to discuss general lender criteria. Eligibility for new or established practices depends on each lender’s qualification and vintage norms.'
      },
      {
        question: 'Do you charge hidden fees or promise assured approval?',
        answer:
          'AVANI LOAN SERVICES does not guarantee loan approval, fixed rates or assured disbursal timelines. All lending terms are communicated directly by the lending institution.'
      }
    ],
    relatedSlugs: ['professional-loan', 'business-loan', 'mortgage-loan'],
    whatsappMessage:
      'Hello AVANI LOAN SERVICES, I am a medical professional looking for Doctor Loan consultancy.'
  },
  {
    slug: 'home-loan',
    name: 'Home Loan',
    shortName: 'Home Loan',
    coreOfficial: true,
    enquiryCategory: 'Home Loan',
    metaTitle: 'Home Loan Consultancy & Property Finance Guidance | AVANI LOAN SERVICES',
    metaDescription:
      'Home Loan enquiry assistance and lender coordination for property buyers, salaried and self-employed applicants by AVANI LOAN SERVICES in Latur, Maharashtra.',
    h1: 'Home Loan Consultancy & Property Finance Assistance',
    shortSummary:
      'End-to-end enquiry guidance and lender coordination for property buyers purchasing, constructing or renovating residential homes.',
    intro:
      'Purchasing or building a home involves careful coordination between property documentation, applicant income assessment and lender verification. AVANI LOAN SERVICES helps property buyers, salaried professionals, business owners and self-employed individuals understand Home Loan categories and coordinate their application journey.',
    suitableFor: [
      'Property Buyers purchasing ready-to-move or under-construction residential properties',
      'Salaried Professionals and Working Professionals planning home ownership',
      'Business Owners, Doctors, CAs, Architects, Engineers and Self-Employed Individuals'
    ],
    commonUseCases: [
      'Purchase of a flat, independent house or residential bungalow',
      'Home construction on an owned residential plot',
      'Home extension, renovation or existing home loan balance transfer evaluation'
    ],
    eligibilityConsiderations: [
      'Applicant and co-applicant income stability, age and repayment capacity',
      'Property legal title verification, technical valuation and approved building plans',
      'Loan-to-value (LTV) limits and credit profile criteria applied by lending institutions'
    ],
    generalDocuments: [
      'Applicant identity, residence and income verification documents as required by the lender',
      'Property agreement, title chain and sanction plan copies requested during lender legal/technical check',
      'Existing loan track record in case of home loan transfer evaluation'
    ],
    processSteps: STANDARD_ASSISTANCE_STEPS,
    faqs: [
      {
        question: 'Can I enquire before finalising my residential property?',
        answer:
          'Yes. Speaking with a loan advisor early helps you understand general documentation and eligibility considerations before signing property commitments.'
      },
      {
        question: 'Who performs legal and technical verification of the property?',
        answer:
          'Legal title scrutiny and technical property valuation are carried out independently by the lending institution and its empanelled evaluators.'
      }
    ],
    relatedSlugs: ['mortgage-loan', 'personal-loan', 'business-loan'],
    whatsappMessage:
      'Hello AVANI LOAN SERVICES, I would like to enquire about Home Loan consultancy and guidance.'
  },
  {
    slug: 'mortgage-loan',
    name: 'Mortgage Loan (Loan Against Property)',
    shortName: 'Mortgage Loan / LAP',
    coreOfficial: true,
    enquiryCategory: 'Mortgage Loan / LAP',
    metaTitle: 'Mortgage Loan & Loan Against Property Advisory | AVANI LOAN SERVICES',
    metaDescription:
      'Mortgage Loan and Loan Against Property (LAP) consultancy for property owners and business enterprises by AVANI LOAN SERVICES, Latur, Maharashtra.',
    h1: 'Mortgage Loan & Loan Against Property (LAP) Consultancy',
    shortSummary:
      'Advisory assistance for residential or commercial property owners seeking secured funding for business growth or major financial needs.',
    intro:
      'A Mortgage Loan or Loan Against Property (LAP) enables property owners to explore secured financing backed by residential or commercial real estate. AVANI LOAN SERVICES guides property buyers, business owners, self-employed professionals and institutions on general eligibility considerations, documentation readiness and lender coordination.',
    suitableFor: [
      'Property Owners holding residential or commercial real estate with clear title',
      'Business Owners, MSMEs and SMEs requiring larger secured business capital',
      'Salaried and Self-Employed Professionals addressing major long-term funding needs'
    ],
    commonUseCases: [
      'Business expansion, commercial facility upgrade or working capital consolidation',
      'Higher education funding or major family capital commitments',
      'Refinancing existing high-cost obligations through secured lending (subject to lender approval)'
    ],
    eligibilityConsiderations: [
      'Market value, clear legal title and acceptable collateral status of the mortgaged property',
      'Demonstrated repayment capacity through salary, business cash flows or professional income',
      'Lender-specific LTV norms, tenure limits and credit profile evaluation'
    ],
    generalDocuments: [
      'Property ownership title deeds, tax receipts and approved layout records requested by the lender',
      'Income documents (ITRs, financial statements or salary proofs) and bank statements',
      'Applicant and co-applicant KYC submitted directly to the lender during formal processing'
    ],
    processSteps: STANDARD_ASSISTANCE_STEPS,
    faqs: [
      {
        question: 'Is Mortgage Loan the same as Loan Against Property (LAP)?',
        answer:
          'In everyday Indian financial consultancy, Loan Against Property (LAP) is a common form of Mortgage Loan where an owned residential or commercial property is offered as security, subject to lender valuation and title approval.'
      },
      {
        question: 'Should I email or upload property deeds through the website form?',
        answer:
          'No. Never upload property documents, Aadhaar, PAN or financial statements on public website forms. Start with basic contact details first.'
      }
    ],
    relatedSlugs: ['home-loan', 'business-loan', 'school-and-college-funding'],
    whatsappMessage:
      'Hello AVANI LOAN SERVICES, I would like to enquire about Mortgage Loan / Loan Against Property guidance.'
  },
  {
    slug: 'education-loan-india',
    name: 'Education Loan — India',
    shortName: 'Education Loan — India',
    coreOfficial: true,
    enquiryCategory: 'Education Loan — India',
    metaTitle: 'Education Loan — India Consultancy | AVANI LOAN SERVICES',
    metaDescription:
      'Education Loan consultancy for students and parents pursuing higher education in India. Guidance and lender coordination by AVANI LOAN SERVICES.',
    h1: 'Education Loan Consultancy — Study in India',
    shortSummary:
      'Structured guidance for students and parents planning undergraduate, postgraduate and professional courses at Indian institutions.',
    intro:
      'Financing higher education requires clarity on admission timelines, fee structures, co-applicant requirements and lender procedures. AVANI LOAN SERVICES assists students seeking higher education and parents seeking education funding with Education Loan enquiries for recognised colleges and universities in India.',
    suitableFor: [
      'Students Seeking Higher Education in engineering, medicine, management, law or allied disciplines in India',
      'Parents Seeking Education Funding as co-applicants for recognised Indian courses',
      'Working Professionals pursuing full-time or approved postgraduate programmes in India'
    ],
    commonUseCases: [
      'University or college tuition fees and examination charges',
      'Hostel accommodation, academic books and study equipment as permitted by lender policy',
      'Multi-year higher education funding plans coordinated with admission schedules'
    ],
    eligibilityConsiderations: [
      'Admission confirmation or offer from a recognised Indian educational institution',
      'Academic record and course recognition criteria defined by the prospective lender',
      'Co-applicant income stability and collateral norms (where applicable per lender policy)'
    ],
    generalDocuments: [
      'Admission letter, fee schedule and academic mark sheets requested by lenders',
      'Student and co-applicant KYC and relationship proof via formal lender process',
      'Co-applicant income proof and collateral documents where applicable'
    ],
    processSteps: STANDARD_ASSISTANCE_STEPS,
    faqs: [
      {
        question: 'When should students and parents start an Education Loan enquiry?',
        answer:
          'Starting early—as soon as admission applications or fee schedules are clear—helps families understand lender requirements and avoid last-minute documentation pressure.'
      },
      {
        question: 'Does AVANI LOAN SERVICES guarantee education loan sanction?',
        answer:
          'No. Loan approval, margin money, moratorium terms and interest rates are determined strictly by the lending institution.'
      }
    ],
    relatedSlugs: ['education-loan-global', 'school-and-college-funding', 'personal-loan'],
    whatsappMessage:
      'Hello AVANI LOAN SERVICES, I would like to enquire about Education Loan — India guidance.'
  },
  {
    slug: 'education-loan-global',
    name: 'Education Loan — Global Studies',
    shortName: 'Education Loan — Global Studies',
    coreOfficial: true,
    enquiryCategory: 'Education Loan — Global Studies',
    metaTitle: 'Education Loan — Global Studies (Abroad) Consultancy | AVANI LOAN SERVICES',
    metaDescription:
      'Education Loan advisory for Indian students and parents planning overseas higher studies. Application guidance and lender coordination by AVANI LOAN SERVICES.',
    h1: 'Education Loan Consultancy — Global Studies (Abroad)',
    shortSummary:
      'Dedicated advisory support for students and parents navigating overseas education funding requirements, fee timelines and lender documentation.',
    intro:
      'Studying overseas involves tuition fees, living expenses and strict university intake deadlines. AVANI LOAN SERVICES assists students seeking higher education abroad and parents seeking education funding in understanding secured and unsecured global education loan categories, general documentation readiness and lender coordination.',
    suitableFor: [
      'Students Seeking Higher Education at recognised overseas universities',
      'Parents Seeking Education Funding and co-applicant planning for international degrees',
      'Graduates and Working Professionals planning MS, MBA, MBBS or specialised global programmes'
    ],
    commonUseCases: [
      'Overseas university tuition fees and institutional charges',
      'Living expenses, travel and academic supplies as covered under lender policy',
      'Planning sanction letters required for university fee confirmation and visa preparation'
    ],
    eligibilityConsiderations: [
      'Offer of admission from an eligible international university and course recognition',
      'Student academic profile, entrance scores (where applicable) and co-applicant financial standing',
      'Secured vs. unsecured loan structure and collateral norms determined by the lender'
    ],
    generalDocuments: [
      'University admission offer, fee estimate and student academic transcripts',
      'Standardised test scores and passport/KYC records shared directly with lenders',
      'Co-applicant income verification and property/collateral documents if applying for a secured option'
    ],
    processSteps: STANDARD_ASSISTANCE_STEPS,
    faqs: [
      {
        question: 'Can parents enquire before the final overseas university offer arrives?',
        answer:
          'Yes. Early consultancy helps students and parents understand general eligibility factors and prepare documentation checklists ahead of university deadlines.'
      },
      {
        question: 'Does AVANI LOAN SERVICES issue visa financial certificates directly?',
        answer:
          'No. Formal loan sanction letters and disbursement confirmations are issued solely by the approving bank or NBFC.'
      }
    ],
    relatedSlugs: ['education-loan-india', 'mortgage-loan', 'school-and-college-funding'],
    whatsappMessage:
      'Hello AVANI LOAN SERVICES, I would like to enquire about Education Loan — Global Studies guidance.'
  },
  {
    slug: 'school-and-college-funding',
    name: 'School and College Funding',
    shortName: 'School & College Funding',
    coreOfficial: true,
    enquiryCategory: 'School Funding',
    metaTitle: 'School and College Funding Consultancy | AVANI LOAN SERVICES',
    metaDescription:
      'Loan consultancy for schools, colleges, educational trusts and societies seeking institutional infrastructure and expansion funding — AVANI LOAN SERVICES, Latur.',
    h1: 'School and College Funding Consultancy',
    shortSummary:
      'Specialised funding guidance for educational trusts, societies, school promoters and college managements planning campus infrastructure or expansion.',
    intro:
      'Educational institutions require structured capital planning for classrooms, laboratories, hostels, transport fleets and campus development. AVANI LOAN SERVICES provides consultancy and lender coordination for schools, colleges, educational trusts and societies exploring institutional financing options.',
    suitableFor: [
      'School Owners, Educational Trusts and Registered Societies',
      'College Managements and Higher Education Institutions',
      'Institutional Promoters planning campus construction, modernisation or equipment upgrades'
    ],
    commonUseCases: [
      'Construction of new academic blocks, classrooms, laboratories or library infrastructure',
      'Hostel, campus utilities, smart-classroom or institutional facility upgrades',
      'Institutional transport procurement or refinancing existing institutional facilities (subject to lender policy)'
    ],
    eligibilityConsiderations: [
      'Trust, society or institutional entity registration, operational track record and student enrolment profile',
      'Audited institutional financial statements, fee surplus trends and debt-servicing capacity',
      'Collateral property legality, statutory approvals and lender institutional-credit policy'
    ],
    generalDocuments: [
      'Trust deed / society registration, affiliation records and trustee KYC as requested by lenders',
      'Audited financial statements, income-expenditure accounts and institutional bank statements',
      'Land title, building sanction plans and project cost estimates submitted directly to the lender'
    ],
    processSteps: STANDARD_ASSISTANCE_STEPS,
    faqs: [
      {
        question: 'Does AVANI LOAN SERVICES work with both schools and colleges?',
        answer:
          'Yes. We assist school managements, colleges, registered educational trusts and societies with enquiry preparation and lender coordination.'
      },
      {
        question: 'Are institutional loan terms standardised across all lenders?',
        answer:
          'No. Institutional underwriting varies considerably across banks and NBFCs depending on entity vintage, financials, affiliation and collateral.'
      }
    ],
    relatedSlugs: ['mortgage-loan', 'business-loan', 'education-loan-india'],
    whatsappMessage:
      'Hello AVANI LOAN SERVICES, I would like to enquire about School and College Funding consultancy.'
  },
  {
    slug: 'msme-working-capital-loan',
    name: 'MSME & Working Capital Loans',
    shortName: 'MSME & Working Capital',
    coreOfficial: false,
    enquiryCategory: 'Business Loan',
    metaTitle: 'MSME & Working Capital Loan Consultancy | AVANI LOAN SERVICES',
    metaDescription:
      'MSME and Working Capital loan advisory for small and medium enterprises, traders and manufacturers by AVANI LOAN SERVICES, Latur, Maharashtra.',
    h1: 'MSME & Working Capital Loan Consultancy',
    shortSummary:
      'Guidance for MSMEs and SMEs seeking structured working capital, cash-credit or term funding options.',
    intro:
      'Healthy working capital supports smooth operations across inventory cycles, receivables and supplier commitments. AVANI LOAN SERVICES helps MSMEs, SMEs and business owners evaluate working capital and term loan enquiries and coordinate documentation awareness with relevant lenders.',
    suitableFor: [
      'MSMEs and SMEs across manufacturing, trading and service sectors',
      'Business Owners managing seasonal inventory or debtor cycles',
      'Established Self-Employed commercial enterprises'
    ],
    commonUseCases: [
      'Raw material procurement, stock replenishment and trade payables',
      'Bridging receivables cycles and managing operational overheads',
      'Structured business term financing alongside working capital facilities'
    ],
    eligibilityConsiderations: [
      'Enterprise vintage, Udyam / business registration and annual turnover',
      'GST returns, banking conduct and audited/provisional financial ratios',
      'Collateral availability where required under lender working-capital policy'
    ],
    generalDocuments: [
      'Business registration, Udyam certificate (if applicable) and GST filing summaries',
      'Financial statements, ITRs and primary business bank statements',
      'KYC and security documentation shared only through formal lender processes'
    ],
    processSteps: STANDARD_ASSISTANCE_STEPS,
    faqs: [
      {
        question: 'How is a working capital facility different from a term business loan?',
        answer:
          'Term loans generally fund fixed medium-term needs with scheduled EMIs, whereas working capital facilities help manage recurring operational cycles. Suitability depends on your cash-flow profile and lender offerings.'
      }
    ],
    relatedSlugs: ['business-loan', 'mortgage-loan', 'professional-loan'],
    whatsappMessage:
      'Hello AVANI LOAN SERVICES, I would like to enquire about MSME & Working Capital Loan consultancy.'
  },
  {
    slug: 'professional-loan',
    name: 'Professional Loans (CA, Architects & Engineers)',
    shortName: 'Professional Loans',
    coreOfficial: false,
    enquiryCategory: 'CA Professional Loan',
    metaTitle: 'Professional Loan Consultancy for CAs, Architects & Engineers | AVANI LOAN SERVICES',
    metaDescription:
      'Loan consultancy for Chartered Accountants, Architects, Engineers and self-employed professionals by AVANI LOAN SERVICES, Latur, Maharashtra.',
    h1: 'Professional Loans for CAs, Architects & Engineers',
    shortSummary:
      'Dedicated loan enquiry guidance for Chartered Accountants, Architects, Engineers and independent qualified professionals.',
    intro:
      'Qualified independent professionals such as Chartered Accountants, Architects and Engineers often need capital for office setup, specialised software, team expansion or personal milestones. AVANI LOAN SERVICES provides tailored consultancy and lender coordination for professional loan enquiries.',
    suitableFor: [
      'Chartered Accountants (CAs) in independent practice or firms',
      'Architects and qualified design/planning practitioners',
      'Engineers and technical consultants operating practices or working professionally'
    ],
    commonUseCases: [
      'Professional office setup, interiors and workstation upgrades',
      'Technical software licences, survey/design hardware or consulting expansion',
      'Working capital management for growing advisory or engineering practices'
    ],
    eligibilityConsiderations: [
      'Recognised professional degree, practice registration/membership and practice vintage',
      'Annual gross receipts, net income profile and banking track record',
      'Credit history and existing obligations as evaluated by lending institutions'
    ],
    generalDocuments: [
      'Professional degree and practice/membership certificate requested by lenders',
      'Income Tax Returns, computation of income and practice bank statements',
      'Standard applicant KYC submitted directly to the lender during application'
    ],
    processSteps: STANDARD_ASSISTANCE_STEPS,
    faqs: [
      {
        question: 'Can Doctors also enquire under Professional Loans?',
        answer:
          'Yes — Doctors can explore our dedicated Doctor Loan consultancy page or reach out directly for medical-practice financing guidance.'
      }
    ],
    relatedSlugs: ['doctor-loan', 'business-loan', 'personal-loan'],
    whatsappMessage:
      'Hello AVANI LOAN SERVICES, I would like to enquire about Professional Loan consultancy for CAs/Architects/Engineers.'
  }
];

export const CORE_OFFICIAL_SERVICES = PUBLIC_LOAN_SERVICES.filter((s) => s.coreOfficial);

export function getPublicLoanServiceBySlug(slug: string): PublicLoanService | undefined {
  return PUBLIC_LOAN_SERVICES.find((s) => s.slug === slug);
}

export interface PublicBlogArticle {
  slug: string;
  title: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  category: string;
  author: string;
  publishedDate: string;
  updatedDate: string;
  readingTime: string;
  intro: string;
  sections: Array<{
    heading: string;
    paragraphs: string[];
    bullets?: string[];
  }>;
  relatedServiceSlugs: string[];
  ctaServiceSlug: string;
  imagePath: string;
  imageAlt: string;
}

export const PUBLIC_BLOG_ARTICLES: PublicBlogArticle[] = [
  {
    slug: 'how-loan-consultancy-helps-home-and-business-applicants',
    title: 'How Loan Consultancy Helps Home Buyers and Business Owners Prepare Stronger Applications',
    h1: 'How Loan Consultancy Helps Home Buyers and Business Owners Prepare Stronger Applications',
    metaTitle: 'How Loan Consultancy Helps Home & Business Loan Applicants | AVANI LOAN SERVICES',
    metaDescription:
      'Learn how structured loan consultancy assists property buyers, salaried professionals and business owners with category selection, checklists and lender coordination.',
    category: 'Loan Advisory Guide',
    author: 'Sachin Shinde — AVANI LOAN SERVICES',
    publishedDate: '2026-11-21',
    updatedDate: '2026-11-21',
    readingTime: '4 min read',
    intro:
      'Applying for a Home Loan, Business Loan or Personal Loan involves comparing product structures, aligning income documents with lender norms and avoiding preventable paperwork gaps. An independent loan consultancy helps applicants organise their enquiry cleanly before formal submission.',
    sections: [
      {
        heading: 'Clarifying the Right Loan Category Before Applying',
        paragraphs: [
          'Different financial goals align with different credit products. For example, a property buyer purchasing a house follows a different underwriting path than a property owner seeking a Mortgage Loan (Loan Against Property) for business expansion.',
          'Reviewing the purpose of funds, repayment comfort and available supporting records up front helps salaried professionals, business owners and self-employed applicants avoid submitting mismatched enquiries.'
        ]
      },
      {
        heading: 'Preparing General Documentation Responsibly',
        paragraphs: [
          'Lenders independently verify identity, income continuity, banking conduct and—for secured loans—property legal and technical details. Preparing a clean checklist ahead of time reduces avoidable back-and-forth during lender evaluation.'
        ],
        bullets: [
          'Keep recent bank statements and income filings organised before formal lender submission.',
          'Review existing EMI obligations so your requested amount remains realistic for your household or business cash flow.',
          'Never share Aadhaar, PAN, salary slips or bank statements through unsecured public website forms—submit sensitive records only through official lender channels.'
        ]
      },
      {
        heading: 'Understanding Advisory Support vs. Lender Decisions',
        paragraphs: [
          'A loan consultancy such as AVANI LOAN SERVICES assists with enquiries, general product awareness and coordination with relevant lending institutions. Final credit underwriting, interest rates, fees, sanctioned amounts and processing timelines are determined exclusively by the lending bank or NBFC.'
        ]
      }
    ],
    relatedServiceSlugs: ['home-loan', 'business-loan', 'personal-loan'],
    ctaServiceSlug: 'home-loan',
    imagePath: '/images/hero-advisory-illustration.svg',
    imageAlt: 'AVANI LOAN SERVICES structured loan consultancy process overview'
  },
  {
    slug: 'education-loan-planning-india-and-global-studies',
    title: 'Education Loan Planning for India and Global Studies: A Practical Guide for Students and Parents',
    h1: 'Education Loan Planning for India and Global Studies: A Practical Guide for Students and Parents',
    metaTitle: 'Education Loan Planning (India & Global Studies) | AVANI LOAN SERVICES',
    metaDescription:
      'A practical guide for students and parents planning higher education loans in India or abroad, covering timelines, co-applicant preparation and general checklists.',
    category: 'Education Funding',
    author: 'Sachin Shinde — AVANI LOAN SERVICES',
    publishedDate: '2026-11-21',
    updatedDate: '2026-11-21',
    readingTime: '4 min read',
    intro:
      'Higher education in India or at overseas universities is one of the most significant financial milestones for students and parents. Starting loan planning early makes it easier to align university admission deadlines with lender documentation requirements.',
    sections: [
      {
        heading: 'Key Differences Between Domestic and Global Education Enquiries',
        paragraphs: [
          'Education Loans for India focus on recognised domestic institutions and semester fee schedules, while Education Loans for Global Studies must additionally account for overseas tuition estimates, living expenses, currency considerations and visa-timeline documentation.',
          'In both cases, lenders evaluate course recognition, admission confirmation and co-applicant repayment capacity according to their individual credit policies.'
        ]
      },
      {
        heading: 'Checklist Topics for Students and Parents',
        paragraphs: [
          'Before formally applying with a bank or NBFC, students and parents generally benefit from preparing the following information offline:'
        ],
        bullets: [
          'Estimated total course cost including tuition, examination and permitted academic expenses.',
          'Co-applicant financial details (salaried, business or professional income records).',
          'Clarity on whether collateral property documentation may be required for higher funding amounts, depending on lender norms.'
        ]
      },
      {
        heading: 'How AVANI LOAN SERVICES Assists Families',
        paragraphs: [
          'Based in Latur, Maharashtra, AVANI LOAN SERVICES guides students and parents through initial enquiry evaluation and lender coordination for both Education Loan — India and Education Loan — Global Studies enquiries.'
        ]
      }
    ],
    relatedServiceSlugs: ['education-loan-india', 'education-loan-global', 'mortgage-loan'],
    ctaServiceSlug: 'education-loan-india',
    imagePath: '/images/hero-advisory-illustration.svg',
    imageAlt: 'Education loan guidance for students and parents by AVANI LOAN SERVICES'
  },
  {
    slug: 'preparing-for-business-msme-and-doctor-loans',
    title: 'Preparing Financial Records for Business, MSME, Doctor and Professional Loan Enquiries',
    h1: 'Preparing Financial Records for Business, MSME, Doctor and Professional Loan Enquiries',
    metaTitle: 'Preparing for Business, MSME & Doctor Loan Enquiries | AVANI LOAN SERVICES',
    metaDescription:
      'Practical guidance for business owners, MSMEs, doctors, CAs, architects and engineers preparing for commercial or professional loan enquiries.',
    category: 'Business & Professional Finance',
    author: 'Sachin Shinde — AVANI LOAN SERVICES',
    publishedDate: '2026-11-21',
    updatedDate: '2026-11-21',
    readingTime: '4 min read',
    intro:
      'Business owners, MSMEs, SMEs, doctors, Chartered Accountants, architects and engineers often rely on structured credit to expand clinics, offices, inventory or capacity. Understanding what lenders typically review helps make every enquiry clearer and more productive.',
    sections: [
      {
        heading: 'Core Factors Lenders Commonly Review',
        paragraphs: [
          'While every bank and NBFC follows its own underwriting criteria, commercial and professional loan assessments commonly examine operational continuity, verified financial statements, banking discipline and existing obligations.'
        ],
        bullets: [
          'Consistent business or practice banking transactions reflecting revenue flow.',
          'Timely tax filings and clear separation of enterprise vs. personal accounts where feasible.',
          'Relevant professional registration certificates for Doctors, CAs, Architects and Engineers.'
        ]
      },
      {
        heading: 'Matching Credit Structure to Business Purpose',
        paragraphs: [
          'Short-term operational needs such as stock and receivables cycles often align better with working capital structures, whereas clinic fit-outs, equipment or premises purchases may fit term loans or secured mortgage options. Discussing the objective clearly during your initial consultancy call helps identify suitable categories.'
        ]
      }
    ],
    relatedServiceSlugs: ['business-loan', 'doctor-loan', 'msme-working-capital-loan', 'professional-loan'],
    ctaServiceSlug: 'business-loan',
    imagePath: '/images/hero-advisory-illustration.svg',
    imageAlt: 'Business, MSME, Doctor and Professional loan preparation guide'
  },
  {
    slug: 'understanding-mortgage-loans-and-school-college-funding',
    title: 'Understanding Mortgage Loans, Loan Against Property, and School & College Institutional Funding',
    h1: 'Understanding Mortgage Loans, Loan Against Property, and School & College Institutional Funding',
    metaTitle: 'Mortgage Loans & School/College Funding Guide | AVANI LOAN SERVICES',
    metaDescription:
      'Overview of Mortgage Loans (LAP) and School & College institutional funding considerations for property owners, educational trusts and societies.',
    category: 'Secured & Institutional Finance',
    author: 'Sachin Shinde — AVANI LOAN SERVICES',
    publishedDate: '2026-11-21',
    updatedDate: '2026-11-21',
    readingTime: '4 min read',
    intro:
      'Secured property financing and institutional funding for schools and colleges require closer attention to legal title clarity, project planning and long-term repayment visibility. Here is an overview of key considerations before initiating a formal enquiry.',
    sections: [
      {
        heading: 'Mortgage Loans and Loan Against Property (LAP)',
        paragraphs: [
          'Property owners considering a Mortgage Loan or Loan Against Property generally undergo two parallel reviews by the lender: financial repayment assessment and independent legal/technical scrutiny of the property.',
          'Ensuring property ownership chains, tax receipts and sanctioned plans are up to date helps lenders evaluate applications smoothly.'
        ]
      },
      {
        heading: 'School and College Funding Considerations',
        paragraphs: [
          'Educational trusts, societies, school promoters and college managements seeking funding for classrooms, laboratories, hostels or campus infrastructure typically prepare institutional governance records, audited accounts and clear project cost outlines.',
          'AVANI LOAN SERVICES assists institutional promoters in structuring initial enquiries and coordinating with relevant lending institutions, with all final terms remaining strictly subject to lender evaluation.'
        ]
      }
    ],
    relatedServiceSlugs: ['mortgage-loan', 'school-and-college-funding', 'home-loan'],
    ctaServiceSlug: 'school-and-college-funding',
    imagePath: '/images/hero-advisory-illustration.svg',
    imageAlt: 'Mortgage loan and school/college institutional funding advisory guide'
  }
];

export function getPublicBlogArticleBySlug(slug: string): PublicBlogArticle | undefined {
  return PUBLIC_BLOG_ARTICLES.find((a) => a.slug === slug);
}

export const HOMEPAGE_FAQS = [
  {
    question: 'What services does AVANI LOAN SERVICES provide?',
    answer:
      'AVANI LOAN SERVICES provides independent loan consultancy, enquiry assistance, general documentation awareness and lender coordination across Personal Loans, Business Loans, Doctor Loans, Home Loans, Mortgage Loans, Education Loans (India and Global Studies), and School & College Funding.'
  },
  {
    question: 'Is AVANI LOAN SERVICES a bank or NBFC?',
    answer:
      'No. AVANI LOAN SERVICES is an independent financial-services loan consultancy and advisory practice founded by Sachin Shinde in Latur, Maharashtra. Final credit approval, interest rates, fees and disbursement terms are decided solely by the relevant lending institution.'
  },
  {
    question: 'Who can enquire with AVANI LOAN SERVICES?',
    answer:
      'We assist Salaried Professionals, Business Owners, Doctors, Chartered Accountants, Architects, Engineers, Working Professionals, Self-Employed Individuals, Students Seeking Higher Education, Parents Seeking Education Funding, Property Buyers, MSMEs and SMEs, as well as educational institutions.'
  },
  {
    question: 'Should I submit Aadhaar, PAN, salary slips or bank statements through the website form?',
    answer:
      'No. Under our data-minimisation policy, please never share Aadhaar, PAN, bank account numbers, salary slips, credit reports or property documents through unsecured website forms. Only minimal contact and loan-category details are needed to initiate your enquiry.'
  },
  {
    question: 'How can I contact AVANI LOAN SERVICES directly?',
    answer:
      'You can reach us by email at enquiry@avanifinserv.com, on our official WhatsApp Business desk at +91 91756 35165, or visit our office at OLD BARSHI ROAD, 5NO CHAUK, KULSWAMINI NAGAR, NEXT TO SAI SCHOOL, LATUR – 413512, MAHARASHTRA, INDIA.'
  }
] as const;

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FinancialService',
    name: OFFICIAL_BUSINESS.name,
    url: OFFICIAL_BUSINESS.websiteUrl,
    logo: `${OFFICIAL_BUSINESS.websiteUrl}/images/avani-brand-mark.svg`,
    image: `${OFFICIAL_BUSINESS.websiteUrl}/images/og-avani-loan-services.svg`,
    description: OFFICIAL_BUSINESS.homepageIntro,
    founder: {
      '@type': 'Person',
      name: OFFICIAL_BUSINESS.ownerFounder
    },
    email: OFFICIAL_BUSINESS.email,
    telephone: '+91-91756-35165',
    address: {
      '@type': 'PostalAddress',
      streetAddress: OFFICIAL_BUSINESS.addressStructured.streetAddress,
      addressLocality: OFFICIAL_BUSINESS.addressStructured.addressLocality,
      addressRegion: OFFICIAL_BUSINESS.addressStructured.addressRegion,
      postalCode: OFFICIAL_BUSINESS.addressStructured.postalCode,
      addressCountry: OFFICIAL_BUSINESS.addressStructured.addressCountry
    },
    areaServed: ['Latur', 'Maharashtra', 'India'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: OFFICIAL_BUSINESS.email,
      telephone: '+91-91756-35165',
      availableLanguage: ['English', 'Hindi', 'Marathi']
    }
  };
}

export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: OFFICIAL_BUSINESS.name,
    url: OFFICIAL_BUSINESS.websiteUrl,
    description: OFFICIAL_BUSINESS.industry,
    publisher: {
      '@type': 'Organization',
      name: OFFICIAL_BUSINESS.name,
      url: OFFICIAL_BUSINESS.websiteUrl
    }
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.path === '/' ? `${OFFICIAL_BUSINESS.websiteUrl}/` : `${OFFICIAL_BUSINESS.websiteUrl}${item.path}`
    }))
  };
}

export function buildServiceJsonLd(service: PublicLoanService) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    serviceType: 'Loan Consultancy and Advisory',
    description: service.metaDescription,
    url: `${OFFICIAL_BUSINESS.websiteUrl}/services/${service.slug}`,
    provider: {
      '@type': 'FinancialService',
      name: OFFICIAL_BUSINESS.name,
      url: OFFICIAL_BUSINESS.websiteUrl,
      email: OFFICIAL_BUSINESS.email,
      telephone: '+91-91756-35165',
      address: {
        '@type': 'PostalAddress',
        streetAddress: OFFICIAL_BUSINESS.addressStructured.streetAddress,
        addressLocality: OFFICIAL_BUSINESS.addressStructured.addressLocality,
        addressRegion: OFFICIAL_BUSINESS.addressStructured.addressRegion,
        postalCode: OFFICIAL_BUSINESS.addressStructured.postalCode,
        addressCountry: OFFICIAL_BUSINESS.addressStructured.addressCountry
      }
    },
    areaServed: ['Latur', 'Maharashtra', 'India']
  };
}

export function buildArticleJsonLd(article: PublicBlogArticle) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription,
    datePublished: article.publishedDate,
    dateModified: article.updatedDate,
    author: {
      '@type': 'Person',
      name: OFFICIAL_BUSINESS.ownerFounder
    },
    publisher: {
      '@type': 'Organization',
      name: OFFICIAL_BUSINESS.name,
      url: OFFICIAL_BUSINESS.websiteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${OFFICIAL_BUSINESS.websiteUrl}/images/avani-brand-mark.svg`
      }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${OFFICIAL_BUSINESS.websiteUrl}/blog/${article.slug}`
    },
    image: `${OFFICIAL_BUSINESS.websiteUrl}${article.imagePath}`
  };
}
