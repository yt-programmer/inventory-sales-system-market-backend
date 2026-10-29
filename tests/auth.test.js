import "./helpers/env.js";
import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import request from "supertest";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { ensureAdmin } from "../src/bootstrap.js";
import { startDb } from "./helpers/db.js";
import { loginAs } from "./helpers/client.js";

let stop, app;
test.before(async () => {
  stop = await startDb("mm_auth");
  await ensureAdmin();
  app = createApp({ rateLimit: { login: 1000, global: 100000 } });
});
test.after(async () => { await stop(); });

test("مسار محمي من غير كوكي → 401", async () => {
  const r = await request(app).get("/api/products");
  assert.equal(r.status, 401);
  assert.equal(r.body.code, "UNAUTHORIZED");
  assert.ok(r.body.requestId);
});

test("دخول بكلمة سر غلط وفاضية", async () => {
  let r = await request(app).post("/api/auth/login").send({ username: "admin", password: "nope" });
  assert.equal(r.status, 401);
  assert.equal(r.body.errors.password, "Wrong password, try again.");
  r = await request(app).post("/api/auth/login").send({ username: "admin", password: "" });
  assert.equal(r.status, 422);
  assert.equal(r.body.errors.password, "Enter your password");
});

test("اسم المستخدم مطلوب (مفيش افتراضي)", async () => {
  let r = await request(app).post("/api/auth/login").send({ password: "1234" });
  assert.equal(r.status, 422);
  assert.equal(r.body.errors.username, "Enter the username");
  r = await request(app).post("/api/auth/login").send({ username: "  ", password: "1234" });
  assert.equal(r.status, 422);
  r = await request(app).post("/api/auth/login").send({ username: "ghost", password: "1234" });
  assert.equal(r.status, 401); // مستخدم مش موجود: نفس رسالة كلمة السر الغلط
  assert.equal(r.body.errors.password, "Wrong password, try again.");
});

test("الدخول بيحط التوكن في كوكي httpOnly + SameSite", async () => {
  const r = await request(app).post("/api/auth/login").send({ username: "admin", password: "1234" });
  assert.equal(r.status, 200);
  const ck = r.headers["set-cookie"];
  const tok = ck.find((c) => c.startsWith("mm_token="));
  assert.match(tok, /HttpOnly/i);
  assert.match(tok, /SameSite=Lax/i);
  assert.ok(!ck.some((c) => c.startsWith("mm_csrf=")));
  assert.equal(r.body.user.role, "admin");
  assert.ok(!("passwordHash" in r.body.user));
});

test("الحماية من الطلبات الغريبة بـ CORS: origin غريب بكوكي سليم → 403 ومفيش تنفيذ", async () => {
  const c = await loginAs(app);
  assert.equal((await c.get("/api/auth/me")).body.user.username, "admin");
  // طلب مغيّر للبيانات جاي من موقع غريب (الكوكي صح) بيتصدّ قبل أي معالجة
  let r = await c.agent.post("/api/users").set("Origin", "http://evil.example").send({ username: "hacker", password: "hack1234" });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "CORS_BLOCKED");
  assert.equal((await c.get("/api/users")).body.some((u) => u.username === "hacker"), false);
  // نفس الطلب من الواجهة المسموحة بيعدّي
  r = await c.agent.post("/api/sales").set("Origin", "http://localhost:5173").send({ lines: [] });
  assert.equal(r.status, 422);
  // وطلب من غير Origin (أداة/سيرفر) بيعدّي بالكوكي
  assert.equal((await c.post("/api/sales", { lines: [] })).status, 422);
});

test("الخروج بيمسح الكوكي وبيبطّل التوكن القديم", async () => {
  const c = await loginAs(app);
  const r = await c.post("/api/auth/logout");
  assert.equal(r.status, 200);
  assert.match(r.headers["set-cookie"].join(";"), /mm_token=;/);
  const old = await request(app).get("/api/auth/me").set("Cookie", c.cookies);
  assert.equal(old.status, 401);
  assert.equal(old.body.code, "SESSION_EXPIRED");
});

test("تغيير كلمة السر: فاليديشن + يبطّل الجلسات القديمة", async () => {
  const c = await loginAs(app);
  let r = await c.post("/api/auth/change-password", { current: "x", password: "ab", confirm: "z" });
  assert.equal(r.status, 422);
  assert.equal(r.body.errors.password, "New password must be at least 4 characters");
  assert.equal(r.body.errors.confirm, "Confirmation doesn't match the new password");
  r = await c.post("/api/auth/change-password", { current: "x", password: "abcd", confirm: "abcd" });
  assert.equal(r.body.errors.current, "Current password is wrong");
  r = await c.post("/api/auth/change-password", { current: "1234", password: "5678", confirm: "5678" });
  assert.equal(r.status, 200);
  assert.equal((await request(app).get("/api/auth/me").set("Cookie", c.cookies)).status, 401); // القديمة اتبطلت
  assert.equal((await c.get("/api/auth/me")).status, 200); // الحالية اتجددت
  assert.equal((await request(app).post("/api/auth/login").send({ username: "admin", password: "1234" })).status, 401);
  await loginAs(app, "admin", "5678");
});

test("قفل الحساب بعد محاولات فاشلة", async () => {
  await User.create({ username: "lock1", passwordHash: await bcrypt.hash("secret1", 4), role: "cashier" });
  for (let i = 0; i < 3; i++) {
    const r = await request(app).post("/api/auth/login").send({ username: "lock1", password: "bad" });
    assert.equal(r.status, 401);
  }
  const r = await request(app).post("/api/auth/login").send({ username: "lock1", password: "secret1" });
  assert.equal(r.status, 429);
  assert.equal(r.body.code, "ACCOUNT_LOCKED");
});

test("NoSQL injection في الدخول بيتصدّ", async () => {
  let r = await request(app).post("/api/auth/login").send({ username: "admin", password: { $ne: null } });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "INVALID_KEYS");
  r = await request(app).post("/api/auth/login").send({ username: { $gt: "" }, password: "x" });
  assert.equal(r.status, 400);
  r = await request(app).post("/api/auth/login").send({ username: "admin", password: ["1234"] });
  assert.equal(r.status, 422); // مصفوفة مش نص
});

test("محدّد محاولات الدخول (rate limit) → 429", async () => {
  const limited = createApp({ rateLimit: { login: 2, global: 1000 } });
  await request(limited).post("/api/auth/login").send({ username: "admin", password: "a" });
  await request(limited).post("/api/auth/login").send({ username: "admin", password: "a" });
  const r = await request(limited).post("/api/auth/login").send({ username: "admin", password: "a" });
  assert.equal(r.status, 429);
  assert.equal(r.body.code, "TOO_MANY_REQUESTS");
});
