/**
 * Automated Verification Validation Rules Engine for Avani Loan Services
 * Tracks and confirms mandatory criteria fields per product track before routing data.
 */

export interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
  errorMessage: string | null;
}

export function validateProductPayload(loanType: string, payload: any): ValidationResult {
  const missingFields: string[] = [];

  // 1. Root Basic Requirements mandatory for every single incoming profile track
  const basicFields = ['fullName', 'mobileNumber', 'city', 'loanAmountRequired'];
  basicFields.forEach(field => {
    if (!payload[field] || String(payload[field]).trim() === '') {
      missingFields.push(`Basic_${field}`);
    }
  });

  // 2. Specialized Conditional Product Verification Switch Matrices
  switch (loanType) {
    case "Personal Loan":
      if (!payload.employmentType) missingFields.push("employmentType (Salaried/Self-Employed)");
      if (!payload.monthlySalaryBracket) missingFields.push("monthlySalaryBracket");
      break;

    case "Business Loan":
      if (!payload.businessName) missingFields.push("businessName");
      if (!payload.ownerName) missingFields.push("ownerName");
      if (!payload.annualTurnover) missingFields.push("annualTurnover");
      break;

    case "Doctor Loan":
      if (!payload.doctorName) missingFields.push("doctorName");
      if (!payload.specialization) missingFields.push("specialization");
      if (!payload.clinicHospitalName) missingFields.push("clinicHospitalName");
      break;

    case "Chartered Accountant (CA) Loan":
      if (!payload.caName) missingFields.push("caName");
      if (!payload.specialization) missingFields.push("specialization");
      if (!payload.firmName) missingFields.push("firmName");
      break;

    case "Education Loan (India)":
      if (!payload.studentName) missingFields.push("studentName");
      if (!payload.course) missingFields.push("course");
      if (!payload.university) missingFields.push("university (Indian Institute Target)");
      if (!payload.coApplicantProfession) missingFields.push("coApplicantProfession");
      break;

    case "Education Loan (Global Studies)":
      if (!payload.studentName) missingFields.push("studentName");
      if (!payload.course) missingFields.push("course");
      if (!payload.country) missingFields.push("country (Destination Global Profile)");
      if (!payload.university) missingFields.push("university (Global University Matrix)");
      if (payload.passportBothSidesAvailable === undefined) missingFields.push("passportStatus");
      break;

    case "Home Loan":
      if (!payload.propertyLocation) missingFields.push("propertyLocation");
      if (!payload.propertyType) missingFields.push("propertyType (Builder Purchase/Construct)");
      if (!payload.propertyValue) missingFields.push("propertyValue");
      break;

    case "Mortgage Loan":
      if (!payload.propertyLocation) missingFields.push("propertyLocation");
      if (!payload.propertyTypeDetails) missingFields.push("propertyTypeDetails (Must specify 7 Bara NA status verification)");
      if (!payload.propertyValue) missingFields.push("propertyValue");
      break;

    case "School And College funding":
      if (!payload.institutionName) missingFields.push("institutionName");
      if (!payload.trusteeOwnerName) missingFields.push("trusteeOwnerName");
      if (!payload.fundingPurpose) missingFields.push("fundingPurpose");
      break;

    default:
      return {
        isValid: false,
        missingFields: ["loanType"],
        errorMessage: `Unknown category track layout context signature matched: '${loanType}'`
      };
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    errorMessage: missingFields.length > 0 
      ? `Validation Failed: Missing required validation properties for [${loanType}]: ${missingFields.join(', ')}`
      : null
  };
}
