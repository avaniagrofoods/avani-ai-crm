/**
 * Resolves the tenure bracket based on the requested loan amount threshold rules.
 * Baseline Fallbacks:
 * - Default: 5 Years
 * - Amount > ₹25 Lakhs (2,500,000): Automatically scales up to 10 Years
 * - Amount > ₹50 Lakhs (5,000,000): Automatically scales up to 15 Years
 */
export function resolveTenureAndThresholds(
  requestedAmount: number,
  userPreferredYears: number | null | undefined
): { resolvedYears: number; ruleApplied: string; isFallback: boolean } {
  
  // Constants for thresholds in Lakhs
  const TWENTY_FIVE_LAKHS = 2500000;
  const FIFTY_LAKHS = 5000000;

  // Rule 1: High Ticket Volume Check (Overrides empty or shorter profiles)
  if (requestedAmount >= FIFTY_LAKHS) {
    return {
      resolvedYears: 15,
      ruleApplied: "Greater_Than_50_Lakhs_Rule",
      isFallback: false
    };
  }

  if (requestedAmount >= TWENTY_FIVE_LAKHS) {
    return {
      resolvedYears: 10,
      ruleApplied: "Greater_Than_25_Lakhs_Rule",
      isFallback: false
    };
  }

  // Rule 2: If no strict monetary threshold is crossed, inspect profile input
  if (userPreferredYears && [3, 5, 10, 15].includes(userPreferredYears)) {
    return {
      resolvedYears: userPreferredYears,
      ruleApplied: "User_Profile_Selection",
      isFallback: false
    };
  }

  // Rule 3: Missing or non-standard selection falls back to the 5-Year index standard
  return {
    resolvedYears: 5,
    ruleApplied: "Default_5_Year_Fallback_Rule",
    isFallback: true
  };
}
