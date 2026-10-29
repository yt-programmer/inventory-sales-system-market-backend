import { fromCents } from "./ids.js";

// أشكال الرد مطابقة للواجهة: المنتج { id, n, cat, q, c, p, s } والحركة { id, t, n, type, q, amt, pr }
export const productDto = (p, role = "admin") => {
  const o = { id: String(p._id), n: p.name, cat: p.category, q: p.qty, p: p.price, s: p.sold ?? 0 };
  if (role === "admin") o.c = p.cost; // الكاشير ميشوفش سعر الشراء
  return o;
};
export const movementDto = (m) => ({ id: String(m._id), t: m.at, n: m.name, type: m.type, q: m.qty, amt: fromCents(m.amount), pr: fromCents(m.profit) });
export const userDto = (u) => ({ id: String(u._id), username: u.username, role: u.role, active: u.active });
