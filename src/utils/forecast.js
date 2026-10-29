import { DAY } from "./dates.js";
import { fromCents, toCents } from "./ids.js";

const round1 = (n) => Math.round(n * 10) / 10;

// بيحسب توصية الشراء للفترة الجاية بناءً على الأكتر مبيعاً:
//   معدل البيع اليومي = المباع ÷ عدد الأيام (أو عدد أيام وجود الصنف لو أقل من فترة الحساب)
//   المطلوب للمدة = المعدل × المدة × (1 + مخزون الأمان%)
//   الكمية المقترحة = المطلوب − المخزون الحالي (لو سالب = 0)
// products: [{ _id, name, category, qty, cost, createdAt }]  ·  sold: Map(productId → المباع في الفترة)
export function buildForecast({ products, sold, now = Date.now(), days = 30, horizon = 30, buffer = 20 }) {
  const items = [];
  for (const p of products) {
    const id = String(p._id);
    const s = sold.get(id) || 0;
    if (s <= 0) continue; // الصنف اللي مبيعش في الفترة مش بنقترح نشتريه

    const basisDays = Math.min(days, Math.max(1, Math.ceil((now - new Date(p.createdAt).getTime()) / DAY)));
    const rate = s / basisDays;
    const target = Math.ceil((rate * horizon * (100 + buffer)) / 100 - 1e-9);
    const suggest = Math.max(0, target - p.qty);
    const daysLeft = Math.floor(p.qty / rate);

    items.push({
      id, n: p.name, cat: p.category,
      sold: s, rate: round1(rate), basisDays, confidence: basisDays < 7 ? "low" : "ok",
      stock: p.qty, daysLeft, target, suggest,
      cost: fromCents(toCents(suggest * p.cost)),
      priority: suggest === 0 ? "ok" : daysLeft < 7 ? "urgent" : daysLeft < 14 ? "soon" : "later",
    });
  }
  items.sort((a, b) => b.sold - a.sold || a.n.localeCompare(b.n, "ar"));
  const buy = items.filter((i) => i.suggest > 0);
  return {
    items,
    totals: {
      items: buy.length,
      units: buy.reduce((s, i) => s + i.suggest, 0),
      cost: fromCents(buy.reduce((s, i) => s + toCents(i.cost), 0)),
    },
  };
}
