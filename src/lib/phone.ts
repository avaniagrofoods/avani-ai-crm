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

export function parseIndianPhone(input: string): { formatted: string; raw10: string } | null {
  if (!input) return null;
  const digits = String(input).replace(/[^0-9]/g, '');
  const raw10 = digits.length > 10 ? digits.slice(-10) : digits;
  if (raw10.length !== 10 || !/^[6-9]/.test(raw10)) return null;
  return {
    formatted: `+91${raw10}`,
    raw10
  };
}
