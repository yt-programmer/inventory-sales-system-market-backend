import "./helpers/env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { buildForecast } from "../src/utils/forecast.js";
import { parseForecast } from "../src/validation/analytics.validation.js";

const DAY = 864e5;
const now = Date.UTC(2026, 0, 31);
const prod = (id, name, qty, cost, ageDays) => ({ _id: id, name, category: "Grocery", qty, cost, createdAt: new Date(now - ageDays * DAY) });

test("الحساب: معدل يومي × مدة × مخزون أمان − المخزون", () => {
  const products = [prod("a", "لبن", 10, 37, 60), prod("b", "شيبسي", 100, 3.75, 60), prod("c", "بيض", 5, 122, 60), prod("d", "جديد", 0, 10, 5)];
  const sold = new Map([["a", 60], ["b", 30], ["d", 10]]);
  const r = buildForecast({ products, sold, now, days: 30, horizon: 30, buffer: 20 });

  assert.deepEqual(r.items.map((i) => i.n), ["لبن", "شيبسي", "جديد"]); // بالأكتر مبيعاً، والبيض (مبيعش) مش موجود
  const [milk, chips, fresh] = r.items;

  assert.equal(milk.rate, 2);
  assert.equal(milk.target, 72);
  assert.equal(milk.suggest, 62);
  assert.equal(milk.daysLeft, 5);
  assert.equal(milk.priority, "urgent");
  assert.equal(milk.cost, 62 * 37);

  assert.equal(chips.suggest, 0); // المخزون كفاية
  assert.equal(chips.priority, "ok");
  assert.equal(chips.daysLeft, 100);

  assert.equal(fresh.basisDays, 5); // صنف جديد: الحساب على أيام وجوده
  assert.equal(fresh.rate, 2);
  assert.equal(fresh.confidence, "low");
  assert.equal(fresh.suggest, 72);

  assert.deepEqual(r.totals, { items: 2, units: 134, cost: 62 * 37 + 72 * 10 });
});

test("المدة ومخزون الأمان بيغيّروا الكمية", () => {
  const products = [prod("a", "لبن", 10, 37, 60)];
  const sold = new Map([["a", 60]]);
  assert.equal(buildForecast({ products, sold, now, buffer: 0 }).items[0].suggest, 50);
  assert.equal(buildForecast({ products, sold, now, buffer: 50 }).items[0].suggest, 80);
  assert.equal(buildForecast({ products, sold, now, horizon: 14, buffer: 0 }).items[0].suggest, 18);
});

test("الأولويات", () => {
  const sold = new Map([["a", 30], ["b", 30], ["c", 30]]); // معدل 1 في اليوم
  const products = [prod("a", "أ", 3, 1, 90), prod("b", "ب", 10, 1, 90), prod("c", "ج", 20, 1, 90)];
  const p = Object.fromEntries(buildForecast({ products, sold, now, buffer: 0 }).items.map((i) => [i.n, i.priority]));
  assert.deepEqual(p, { أ: "urgent", ب: "soon", ج: "later" });
});

test("تحليل الباراميترز", () => {
  assert.deepEqual(parseForecast({}), { days: 30, horizon: 30, buffer: 20 });
  assert.deepEqual(parseForecast({ days: "14", horizon: "45", buffer: "0" }), { days: 14, horizon: 45, buffer: 0 });
  for (const bad of [{ days: "3" }, { days: "abc" }, { horizon: "99" }, { buffer: "-1" }, { buffer: "101" }]) {
    assert.throws(() => parseForecast(bad), /The data contains errors/, JSON.stringify(bad));
  }
});
