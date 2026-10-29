const pad = (n) => String(n).padStart(2, "0");
export const DAY = 864e5;
// يوم محلي بتوقيت السيرفر (TZ) بصيغة YYYY-MM-DD
export const dk = (ms) => { const x = new Date(ms); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
export const dayStart = (k) => new Date(`${k}T00:00:00`).getTime();
export const validDay = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && !Number.isNaN(dayStart(k));
