import "./helpers/env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { Movement } from "../src/models/Movement.js";
import { Product } from "../src/models/Product.js";
import { ensureAdmin } from "../src/bootstrap.js";
import { startDb } from "./helpers/db.js";
import { loginAs } from "./helpers/client.js";

const DAY = 864e5;
let stop, app, admin;

test.before(async () => {
  stop = await startDb("mm_forecast");
  await ensureAdmin();
  app = createApp({ rateLimit: { login: 1000, global: 100000 } });
  admin = await loginAs(app);

  // لبن مخزونه 15 باع 60 | شيبسي مخزونه 100 باع 30 | بيض مخزونه 5 باع 15 | جبنة مبيعتش
  const mk = async (n, cat, q, c, p, sold) => {
    const prod = (await admin.post("/api/products", { n, cat, q, c, p })).body;
    // نرجّع تاريخ الإنشاء وحركة التوريد 40 يوم عشان الحساب يبقى على 30 يوم كاملة
    const old = Date.now() - 40 * DAY;
    await Product.collection.updateOne({ _id: (await Product.findOne({ name: n }))._id }, { $set: { createdAt: new Date(old) } });
    await Movement.collection.updateMany({ name: n }, { $set: { at: old } });
    const pid = (await Product.findOne({ name: n }))._id;
    for (let d = 1; sold > 0 && d <= 10; d++) {
      await Movement.create({ product: pid, name: n, type: "out", qty: sold / 10, amount: 100, profit: 10, at: Date.now() - d * DAY });
    }
    return prod;
  };
  await mk("لبن", "Dairy & Eggs", 15, 37, 42, 60);
  await mk("شيبسي", "Snacks", 100, 3.75, 5, 30);
  await mk("بيض", "Dairy & Eggs", 5, 122, 135, 15);
  await mk("جبنة", "Dairy & Eggs", 3, 180, 210, 0);
});
test.after(async () => { await stop(); });

test("توصية الشراء: مرتبة بالأكتر مبيعاً وبالكميات الصح", async () => {
  const r = await admin.get("/api/analytics/forecast");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.params, { days: 30, horizon: 30, buffer: 20 });
  assert.deepEqual(r.body.items.map((i) => i.n), ["لبن", "شيبسي", "بيض"]); // الجبنة مبيعتش فمش موجودة

  const [milk, chips, eggs] = r.body.items;
  assert.equal(milk.sold, 60);
  assert.equal(milk.rate, 2);
  assert.equal(milk.target, 72);
  assert.equal(milk.suggest, 57); // 72 - 15
  assert.equal(milk.priority, "soon"); // يكفي 7 أيام (من 7 لـ 13 = قريباً)
  assert.equal(chips.suggest, 0);
  assert.equal(chips.priority, "ok");
  assert.equal(eggs.rate, 0.5);
  assert.equal(eggs.suggest, 13); // 18 - 5
  assert.equal(eggs.priority, "soon");
  assert.deepEqual(r.body.totals, { items: 2, units: 70, cost: 57 * 37 + 13 * 122 });
});

test("تغيير مخزون الأمان والمدة", async () => {
  let r = await admin.get("/api/analytics/forecast?buffer=0");
  assert.equal(r.body.items[0].suggest, 45); // 60 - 15
  r = await admin.get("/api/analytics/forecast?horizon=14&buffer=0&days=30");
  assert.equal(r.body.items[0].suggest, 13); // 28 - 15
});

test("باراميترز غلط → 422 وصلاحيات الأدمن بس", async () => {
  const bad = await admin.get("/api/analytics/forecast?days=3&buffer=500&horizon=x");
  assert.equal(bad.status, 422);
  assert.deepEqual(Object.keys(bad.body.errors).sort(), ["buffer", "days", "horizon"]);
  assert.equal(bad.body.errors.days, "Calculation days must be 7 to 90");

  await admin.post("/api/users", { username: "kasher2", password: "kash1234" });
  const cash = await loginAs(app, "kasher2", "kash1234");
  assert.equal((await cash.get("/api/analytics/forecast")).status, 403);
});
