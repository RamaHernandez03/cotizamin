// lib/validators.ts
export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// RUC simple: solo dígitos y largo fijo (default 11)
export function isValidRucSimple(ruc: string, length = 11) {
  return new RegExp(`^\\d{${length}}$`).test(ruc);
}

// Opcional: CUIT/CUIL (Argentina) con dígito verificador
export function isValidCuit(cuit: string) {
  const clean = cuit.replace(/\D/g, "");
  if (!/^\d{11}$/.test(clean)) return false;
  const nums = clean.split("").map(Number);
  const weights = [5,4,3,2,7,6,5,4,3,2];
  const sum = weights.reduce((acc, w, i) => acc + w * nums[i], 0);
  const mod = 11 - (sum % 11);
  const dv = mod === 11 ? 0 : (mod === 10 ? 9 : mod);
  return dv === nums[10];
}
