import "./helpers/env.js";
import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Movement } from "../src/models/Movement.js";
import { ensureAdmin } from "../src/bootstrap.js";
import { startDb } from "./helpers/db.js";
import { loginAs } from "./helpers/client.js";

let stop, app, admin;
test.before(async () => {
  stop = await startDb("mm_reports");
  await ensureAdmin();
  app = createApp({ rateLimit: { login: 1000, global: 100000 } });
  admin = await loginAs(app);
  const p = (await admin.post("/api/products", { n: "لبن", cat: "Dairy & Eggs", q: 20, c: 37, p: 42 })).body;
  await admin.post("/api/sales", { lines: [{ id: p.id, q: 3 }] });
  await Movement.create({ name: "لبن", type: "out", qty: 2, amount: 8400, profit: 1000, at: Date.now() - 2 * 864e5 }); // من يومين
});
test.after(async () => { await stop(); });

test("التحليلات: اليوم والإجمالي والفترة والشارت", async () => {
  const r = await admin.get("/api/analytics");
  assert.equal(r.status, 200);
  assert.equal(r.body.today.sales, 126);
  assert.equal(r.body.today.profit, 15);
  assert.equal(r.body.today.sold, 3);
  assert.equal(r.body.today.received, 20);
  assert.equal(r.body.total.sales, 210);
  assert.equal(r.body.total.sold, 5);
  assert.equal(r.body.total.stockValue, 17 * 37);
  assert.equal(r.body.period.days.length, 7);
  assert.equal(r.body.period.days.at(-1).s, 126);
  assert.equal(r.body.period.days.at(-3).s, 84);
  assert.deepEqual(r.body.period.top[0], { n: "لبن", q: 5 });
});

test("التحليلات: فترة مخصصة وأخطاء التواريخ", async () => {
  const day = new Date(Date.now() - 2 * 864e5);
  const k = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  const r = await admin.get(`/api/analytics?from=${k}&to=${k}`);
  assert.equal(r.body.period.sales, 84);
  assert.equal(r.body.period.days.length, 1);
  let e = await admin.get("/api/analytics?from=2020-01-01&to=2020-03-01");
  assert.equal(e.status, 422);
  assert.equal(e.body.errors.to, "Period is longer than 31 days");
  e = await admin.get("/api/analytics?from=2026-05-02&to=2026-05-01");
  assert.equal(e.body.errors.from, "Start is after the end date");
  e = await admin.get("/api/analytics?from=bad");
  assert.equal(e.body.errors.from, "Start date is invalid");
});

test("اسم المحل العام لصفحة الدخول (من غير تسجيل دخول) وبيتحدث", async () => {
  const pub = () => request(app).get("/api/public/shop");
  let r = await pub();
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { name: "Mini Market" }); // الاسم بس
  assert.equal(r.headers["cache-control"], "no-store");
  await admin.put("/api/settings", { name: "ماركت النور", low: 5 });
  assert.deepEqual((await pub()).body, { name: "ماركت النور" });
  await admin.put("/api/settings", { name: "Mini Market", low: 5 });
});

test("الإعدادات", async () => {
  assert.deepEqual((await admin.get("/api/settings")).body, { name: "Mini Market", low: 5 });
  let r = await admin.put("/api/settings", { name: "", low: -2 });
  assert.equal(r.status, 422);
  assert.deepEqual(Object.keys(r.body.errors).sort(), ["low", "name"]);
  r = await admin.put("/api/settings", { name: "ماركت الأمل", low: 8 });
  assert.deepEqual(r.body, { name: "ماركت الأمل", low: 8 });
  assert.deepEqual((await admin.get("/api/settings")).body, { name: "ماركت الأمل", low: 8 });
});
