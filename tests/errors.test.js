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
  stop = await startDb("mm_errors");
  await ensureAdmin();
  app = createApp({ rateLimit: { login: 1000, global: 100000 } });
  admin = await loginAs(app);
});
test.after(async () => { await stop(); });

test("شكل موحّد للأخطاء + requestId + header", async () => {
  let r = await request(app).get("/nope"); // مسار مش تحت /api
  assert.equal(r.status, 404);
  assert.equal((await request(app).get("/api/nope")).status, 401); // تحت /api من غير دخول
  r = await admin.get("/api/nope");
  assert.equal(r.status, 404);
  assert.equal(r.body.status, "fail");
  assert.equal(r.body.code, "ROUTE_NOT_FOUND");
  assert.equal(r.body.requestId, r.headers["x-request-id"]);
});

test("JSON مكسور → 400، وطلب كبير → 413", async () => {
  let r = await request(app).post("/api/auth/login").set("content-type", "application/json").send("{bad json");
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "BAD_JSON");
  r = await request(app).post("/api/auth/login").send({ username: "admin", password: "x".repeat(200 * 1024) });
  assert.equal(r.status, 413);
});

test("مفاتيح مونجو ($ و .) مرفوضة في body و query", async () => {
  let r = await admin.post("/api/products", { n: "x", cat: "Grocery", q: 1, c: 1, p: 2, $where: "1" });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "INVALID_KEYS");
  r = await admin.get("/api/products?cat[$ne]=x");
  assert.equal(r.status, 400);
  r = await admin.post("/api/products", { "a.b": 1 });
  assert.equal(r.status, 400);
});

test("CORS: مصدر غير مسموح → 403، والمسموح بيتعامل بالكوكيز", async () => {
  let r = await request(app).get("/api/health").set("Origin", "http://evil.example");
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "CORS_BLOCKED");
  r = await request(app).get("/api/health").set("Origin", "http://localhost:5173");
  assert.equal(r.status, 200);
  assert.equal(r.headers["access-control-allow-credentials"], "true");
});

test("هيدرز الأمان (helmet) وإخفاء x-powered-by", async () => {
  const r = await request(app).get("/api/health");
  assert.equal(r.headers["x-powered-by"], undefined);
  assert.equal(r.headers["x-content-type-options"], "nosniff");
});

test("توكن متلاعب فيه أو منتهي → 401", async () => {
  const r = await request(app).get("/api/auth/me").set("Cookie", "mm_token=abc.def.ghi");
  assert.equal(r.status, 401);
  assert.equal(r.body.code, "SESSION_EXPIRED");
});
