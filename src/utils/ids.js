export const isId = (v) => typeof v === "string" && /^[a-f\d]{24}$/i.test(v);
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// الفلوس في الحركات بتتخزن بالقروش (أرقام صحيحة) عشان الجمع يبقى دقيق
export const toCents = (n) => Math.round(n * 100);
export const fromCents = (c) => c / 100;
