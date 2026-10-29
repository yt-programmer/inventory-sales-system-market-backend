import "./helpers/env.js";
import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { ensureAdmin } from "../src/bootstrap.js";
import { startDb } from "./helpers/db.js";
import { loginAs } from "./helpers/client.js";

let stop, app, admin, users;
const find = (name) => users.find((u) => u.username === name);

test.before(async () => {
  stop = await startDb("mm_users");
  await ensureAdmin();
  app = createApp({ rateLimit: { login: 1000, global: 100000 } });
  admin = await loginAs(app);
  await admin.post("/api/users", { username: "kasher1", password: "kash1234" });
  await admin.post("/api/users", { username: "kasher2", password: "kash1234" });
  users = (await admin.get("/api/users")).body;
});
test.after(async () => { await stop(); });

test("تغيير الصلاحية: بيترقّى ويشوف الصفحات الجديدة، وجلسته القديمة بتتبطل", async () => {
  const k1 = await loginAs(app, "kasher1", "kash1234");
  assert.equal((await k1.get("/api/analytics")).status, 403);

  const r = await admin.put(`/api/users/${find("kasher1").id}`, { role: "admin" });
  assert.equal(r.status, 200);
  assert.equal(r.body.role, "admin");

  const old = await request(app).get("/api/auth/me").set("Cookie", k1.cookies);
  assert.equal(old.status, 401); // الجلسة القديمة اتبطلت
  assert.equal(old.body.code, "SESSION_EXPIRED");
  const again = await loginAs(app, "kasher1", "kash1234");
  assert.equal((await again.get("/api/analytics")).status, 200);
  assert.equal((await again.get("/api/users")).status, 200);

  // ويرجع كاشير
  assert.equal((await admin.put(`/api/users/${find("kasher1").id}`, { role: "cashier" })).body.role, "cashier");
});

test("فاليديشن الصلاحية، ومستخدم Not found أو id غلط", async () => {
  const id = find("kasher2").id;
  let r = await admin.put(`/api/users/${id}`, { role: "boss" });
  assert.equal(r.status, 422);
  assert.equal(r.body.errors.role, "Role must be admin or cashier");
  assert.equal((await admin.put(`/api/users/${id}`, {})).status, 422);
  assert.equal((await admin.put("/api/users/aaaaaaaaaaaaaaaaaaaaaaaa", { role: "admin" })).status, 404);
  assert.equal((await admin.put("/api/users/xyz", { role: "admin" })).status, 404);
});

test("الأدمن ميقدرش يغيّر صلاحيته ولا يمسح نفسه", async () => {
  const me = find("admin").id;
  let r = await admin.put(`/api/users/${me}`, { role: "cashier" });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "SELF_MODIFY");
  r = await admin.del(`/api/users/${me}`);
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "SELF_MODIFY");
  assert.equal((await admin.get("/api/auth/me")).body.user.role, "admin");
});

test("مسح مستخدم: بيختفي وجلسته بتتبطل ومينفعش يدخل تاني", async () => {
  const k2 = await loginAs(app, "kasher2", "kash1234");
  assert.equal((await admin.del(`/api/users/${find("kasher2").id}`)).status, 204);
  assert.equal((await admin.get("/api/users")).body.some((u) => u.username === "kasher2"), false);
  assert.equal((await request(app).get("/api/auth/me").set("Cookie", k2.cookies)).status, 401);
  assert.equal((await request(app).post("/api/auth/login").send({ username: "kasher2", password: "kash1234" })).status, 401);
  assert.equal((await admin.del(`/api/users/${find("kasher2").id}`)).status, 404);
});

test("الكاشير ميقدرش يعدّل ولا يمسح مستخدمين", async () => {
  const k1 = await loginAs(app, "kasher1", "kash1234");
  assert.equal((await k1.put(`/api/users/${find("admin").id}`, { role: "cashier" })).status, 403);
  assert.equal((await k1.del(`/api/users/${find("admin").id}`)).status, 403);
});

test("أدمن تاني يقدر ينزّل الأدمن الأول (طالما فاضل أدمن)", async () => {
  await admin.post("/api/users", { username: "boss2", password: "boss1234", role: "admin" });
  const all = (await admin.get("/api/users")).body;
  const boss = await loginAs(app, "boss2", "boss1234");
  const r = await boss.put(`/api/users/${all.find((u) => u.username === "admin").id}`, { role: "cashier" });
  assert.equal(r.status, 200);
  assert.equal((await request(app).get("/api/users").set("Cookie", admin.cookies)).status, 401); // جلسة الأدمن الأول اتبطلت
});
