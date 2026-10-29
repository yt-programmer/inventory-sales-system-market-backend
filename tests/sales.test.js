import "./helpers/env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { ensureAdmin } from "../src/bootstrap.js";
import { startDb } from "./helpers/db.js";
import { loginAs } from "./helpers/client.js";

let stop, app, admin, milk, chips;
const qtyOf = async (id) => (await admin.get(`/api/products/${id}`)).body.q;

test.before(async () => {
  stop = await startDb("mm_sales");
  await ensureAdmin();
  app = createApp({ rateLimit: { login: 1000, global: 100000 } });
  admin = await loginAs(app);
  milk = (await admin.post("/api/products", { n: "لبن", cat: "Dairy & Eggs", q: 15, c: 37, p: 42 })).body;
  chips = (await admin.post("/api/products", { n: "شيبسي", cat: "Snacks", q: 4, c: 3.75, p: 5 })).body;
});
test.after(async () => { await stop(); });

test("فاتورة فاضية أو بكميات غلط → 422", async () => {
  assert.equal((await admin.post("/api/sales", { lines: [] })).status, 422);
  assert.equal((await admin.post("/api/sales", {})).status, 422);
  assert.equal((await admin.post("/api/sales", { lines: [{ id: milk.id, q: 0 }] })).status, 422);
  assert.equal((await admin.post("/api/sales", { lines: [{ id: "bad", q: 1 }] })).status, 422);
});

test("بيع ناجح: يدمج المكرر ويخصم المخزون ويحسب الإجمالي والربح", async () => {
  const r = await admin.post("/api/sales", { lines: [{ id: milk.id, q: 2 }, { id: milk.id, q: 1 }, { id: chips.id, q: 2 }] });
  assert.equal(r.status, 201);
  assert.equal(r.body.total, 3 * 42 + 2 * 5);
  assert.equal(r.body.profit, 3 * 5 + 2 * 1.25);
  assert.equal(r.body.items.length, 2);
  assert.equal(await qtyOf(milk.id), 12);
  assert.equal(await qtyOf(chips.id), 2);
  assert.equal((await admin.get(`/api/products/${milk.id}`)).body.s, 3); // عداد المباع
});

test("كمية غير كافية → 409 ومفيش حاجة بتتخصم (rollback)", async () => {
  const r = await admin.post("/api/sales", { lines: [{ id: milk.id, q: 5 }, { id: chips.id, q: 99 }] });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, "INSUFFICIENT_STOCK");
  assert.match(r.body.errors.lines, /Only 2 of "شيبسي" available/);
  assert.equal(await qtyOf(milk.id), 12); // اللبن اتخصم ورجع
  assert.equal(await qtyOf(chips.id), 2);
  assert.equal((await admin.get(`/api/products/${milk.id}`)).body.s, 3); // والعداد رجع كمان
});

test("صنف Not found → 404 ومفيش خصم", async () => {
  const r = await admin.post("/api/sales", { lines: [{ id: milk.id, q: 1 }, { id: "aaaaaaaaaaaaaaaaaaaaaaaa", q: 1 }] });
  assert.equal(r.status, 404);
  assert.equal(await qtyOf(milk.id), 12);
});

test("بيعتين متزامنتين على آخر كمية: واحدة بس تنجح (مفيش بالسالب)", async () => {
  const [a, b] = await Promise.all([
    admin.post("/api/sales", { lines: [{ id: chips.id, q: 2 }] }),
    admin.post("/api/sales", { lines: [{ id: chips.id, q: 2 }] }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  assert.equal(await qtyOf(chips.id), 0);
});

test("الكاشير يبيع من غير ما يشوف الربح", async () => {
  await admin.post("/api/users", { username: "kasher", password: "kash1234" });
  const cash = await loginAs(app, "kasher", "kash1234");
  const r = await cash.post("/api/sales", { lines: [{ id: milk.id, q: 1 }] });
  assert.equal(r.status, 201);
  assert.equal(r.body.total, 42);
  assert.ok(!("profit" in r.body));
  assert.ok(r.body.items.every((m) => !("pr" in m)));
});

test("سجل الحركات (للأدمن)", async () => {
  const all = (await admin.get("/api/movements")).body;
  assert.ok(all.length >= 5);
  assert.deepEqual(Object.keys(all[0]).sort(), ["amt", "id", "n", "pr", "q", "t", "type"]);
  const outs = (await admin.get("/api/movements?type=out&limit=2")).body;
  assert.equal(outs.length, 2);
  assert.ok(outs.every((m) => m.type === "out"));
});
