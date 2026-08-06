export function normalizeIndianPhone(phoneStr: string | number | undefined | null): string {
  if (!phoneStr) return "";
  let cleaned = String(phoneStr).replace(/\D/g, '');
  
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  
  return cleaned;
}
