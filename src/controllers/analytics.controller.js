import { Movement } from "../models/Movement.js";
import { Product } from "../models/Product.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { DAY, dayStart, dk } from "../utils/dates.js";
import { fromCents as c } from "../utils/ids.js";
import { toCents } from "../utils/ids.js";
import { buildForecast } from "../utils/forecast.js";
import { parseForecast, parseRange } from "../validation/analytics.validation.js";

// aggregate واحد لكل حقل (أبسط وبيشتغل على أي سيرفر متوافق مع MongoDB)
const FIELDS = { q: "$qty", amt: "$amount", pr: "$profit" };
const sums = async (from, to) => {
  const o = { in: { q: 0, amt: 0, pr: 0 }, out: { q: 0, amt: 0, pr: 0 } };
  await Promise.all(
    Object.entries(FIELDS).map(async ([key, path]) => {
      const rows = await Movement.aggregate([
        { $match: { at: { $gte: from, $lt: to } } },
        { $group: { _id: "$type", v: { $sum: path } } },
      ]);
      for (const r of rows) o[r._id][key] = r.v;
    }),
  );
  return o;
};

export const summary = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const t0 = dayStart(dk(Date.now())), t1 = t0 + DAY;
  const pS = dayStart(from), pE = dayStart(to) + DAY;

  const [td, all, per, outs, top, stock] = await Promise.all([
    sums(t0, t1),
    sums(0, Number.MAX_SAFE_INTEGER),
    sums(pS, pE),
    Movement.find({ type: "out", at: { $gte: pS, $lt: pE } }).select("at qty amount profit").lean(),
    Movement.aggregate([
      { $match: { type: "out", at: { $gte: pS, $lt: pE } } },
      { $group: { _id: "$name", q: { $sum: "$qty" } } },
      { $sort: { q: -1 } }, { $limit: 5 },
    ]),
    Product.find().select("qty cost").lean(),
  ]);

  const days = [];
  for (let t = pS; t < pE; t += DAY) days.push({ k: dk(t + 36e5), s: 0, p: 0, q: 0 });
  const idx = new Map(days.map((d, i) => [d.k, i]));
  for (const m of outs) {
    const d = days[idx.get(dk(m.at))];
    if (d) { d.s += m.amount; d.p += m.profit; d.q += m.qty; }
  }

  res.json({
    today: { sales: c(td.out.amt), profit: c(td.out.pr), sold: td.out.q, received: td.in.q },
    total: { sales: c(all.out.amt), profit: c(all.out.pr), sold: all.out.q, stockValue: c(stock.reduce((s, p) => s + toCents(p.qty * p.cost), 0)) },
    period: {
      from, to, sales: c(per.out.amt), profit: c(per.out.pr), sold: per.out.q,
      days: days.map((d) => ({ k: d.k, s: c(d.s), p: c(d.p), q: d.q })),
      top: top.map((t) => ({ n: t._id, q: t.q })),
    },
  });
});

// تشتري إيه؟ توصية الشراء للشهر الجاي بناءً على الأكتر مبيعاً
export const forecast = asyncHandler(async (req, res) => {
  const { days, horizon, buffer } = parseForecast(req.query);
  const now = Date.now();
  const since = now - days * DAY;
  // aggregate لكل حقل لوحده (أبسط وبيشتغل على أي سيرفر متوافق مع MongoDB)
  const [products, soldRows] = await Promise.all([
    Product.find().lean(),
    Movement.aggregate([
      { $match: { type: "out", product: { $ne: null }, at: { $gte: since } } },
      { $group: { _id: "$product", q: { $sum: "$qty" } } },
    ]),
  ]);
  const sold = new Map(soldRows.map((r) => [String(r._id), r.q]));
  res.json({ params: { days, horizon, buffer }, generatedAt: now, ...buildForecast({ products, sold, now, days, horizon, buffer }) });
});
