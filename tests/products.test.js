import "./helpers/env.js";
import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { ensureAdmin } from "../src/bootstrap.js";
import { startDb } from "./helpers/db.js";
import { loginAs } from "./helpers/client.js";

let stop, app, admin;
test.before(async () => {
  stop = await startDb("mm_products");
  await ensureAdmin();
  app = createApp({ rateLimit: { login: 1000, global: 100000 } });
  admin = await loginAs(app);
});
test.after(async () => { await stop(); });

const milk = { n: "لبن 1 لتر", cat: "Dairy & Eggs", q: 10, c: 37, p: 42 };

test("فاليديشن إنشاء الصنف بكل الحقول", async () => {
  const r = await admin.post("/api/products", { n: "", cat: "x", q: -1, c: "abc", p: 0 });
  assert.equal(r.status, 422);
  assert.deepEqual(Object.keys(r.body.errors).sort(), ["c", "cat", "n", "p", "q"]);
  assert.equal(r.body.errors.n, "Enter the item name");
  assert.equal(r.body.errors.p, "Selling price must be greater than zero");
  const weird = await admin.post("/api/products", { ...milk, q: [5], n: { a: 1 } });
  assert.equal(weird.status, 422);
});

test("إنشاء صنف ومنع التكرار (case-insensitive)", async () => {
  const r = await admin.post("/api/products", milk);
  assert.equal(r.status, 201);
  assert.match(r.body.id, /^[a-f\d]{24}$/);
  assert.deepEqual({ ...r.body, id: 0 }, { id: 0, ...milk, s: 0 });
  let d = await admin.post("/api/products", milk);
  assert.equal(d.status, 422);
  assert.equal(d.body.errors.n, "This name already exists");
  await admin.post("/api/products", { n: "Milk", cat: "Dairy & Eggs", q: 1, c: 1, p: 2 });
  d = await admin.post("/api/products", { n: "MILK", cat: "Dairy & Eggs", q: 1, c: 1, p: 2 });
  assert.equal(d.body.errors.n, "This name already exists");
});

test("القائمة والبحث والفلتر", async () => {
  await admin.post("/api/products", { n: "شيبسي", cat: "Snacks", q: 5, c: 3.75, p: 5 });
  assert.equal((await admin.get("/api/products")).body.length, 3);
  assert.equal((await admin.get("/api/products?q=شيب")).body.length, 1);
  assert.equal((await admin.get("/api/products?cat=Snacks")).body.length, 1);
  assert.equal((await admin.get("/api/products?q=.*")).body.length, 0); // الـ regex اتهرّب
});

test("id غلط أو Not found → 404", async () => {
  assert.equal((await admin.get("/api/products/123")).status, 404);
  assert.equal((await admin.get("/api/products/aaaaaaaaaaaaaaaaaaaaaaaa")).status, 404);
});

test("التوريد: فاليديشن وزيادة الكمية وحركة داخل", async () => {
  const id = (await admin.get("/api/products?q=لبن")).body[0].id;
  let r = await admin.post(`/api/products/${id}/stock`, { q: 0 });
  assert.equal(r.status, 422);
  assert.equal(r.body.errors.q, "Quantity must be a whole number, one or more");
  r = await admin.post(`/api/products/${id}/stock`, { q: 5 });
  assert.equal(r.status, 200);
  assert.equal(r.body.product.q, 15);
  assert.equal(r.body.movement.type, "in");
  assert.equal((await admin.post("/api/products/aaaaaaaaaaaaaaaaaaaaaaaa/stock", { q: 1 })).status, 404);
});

test("التعديل (مع منع التكرار) والمسح", async () => {
  const [a, b] = (await admin.get("/api/products")).body;
  let r = await admin.put(`/api/products/${b.id}`, { ...b, n: a.n });
  assert.equal(r.status, 422);
  r = await admin.put(`/api/products/${b.id}`, { n: "اسم جديد", cat: "Grocery", q: 3, c: 2, p: 4 });
  assert.equal(r.status, 200);
  assert.equal(r.body.n, "اسم جديد");
  r = await admin.put(`/api/products/${b.id}`, { n: "اسم جديد", cat: "Grocery", q: 3, c: 2, p: 4 }); // نفس الاسم لنفس الصنف مسموح
  assert.equal(r.status, 200);
  assert.equal((await admin.del(`/api/products/${b.id}`)).status, 204);
  assert.equal((await admin.get(`/api/products/${b.id}`)).status, 404);
});

test("الصلاحيات: الكاشير يشوف المنتجات من غير سعر الشراء وميقدرش يعدّل", async () => {
  let r = await admin.post("/api/users", { username: "cashier1", password: "cash1234" });
  assert.equal(r.status, 201);
  assert.equal(r.body.role, "cashier");
  r = await admin.post("/api/users", { username: "cashier1", password: "cash1234" });
  assert.equal(r.body.errors.username, "Username already exists");
  assert.equal((await admin.post("/api/users", { username: "a b", password: "1" })).status, 422);

  const cash = await loginAs(app, "cashier1", "cash1234");
  const list = (await cash.get("/api/products")).body;
  assert.ok(list.length > 0 && list.every((p) => !("c" in p)));
  assert.equal((await cash.post("/api/products", milk)).status, 403);
  assert.equal((await cash.get("/api/users")).status, 403);
  assert.equal((await cash.get("/api/analytics")).status, 403);
  assert.equal((await cash.get("/api/movements")).status, 403);
  assert.equal((await request(app).get("/api/products")).status, 401);
});
