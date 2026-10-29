import "./helpers/env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { parseEnv } from "../src/config/env.js";

const good = {
  NODE_ENV: "development", TZ: "Africa/Cairo", PORT: "4000", MONGO_URI: "mongodb://127.0.0.1:27017/x",
  JWT_SECRET: "x".repeat(40), JWT_EXPIRES: "12h", COOKIE_MAX_AGE_HOURS: "12", COOKIE_SAMESITE: "lax",
  ADMIN_USERNAME: "Admin", ADMIN_PASSWORD: "secret", CORS_ORIGIN: "http://a.com, http://b.com",
  BCRYPT_ROUNDS: "12", MAX_LOGIN_ATTEMPTS: "5", LOCK_MINUTES: "15", TRUST_PROXY: "0",
  RATE_LIMIT_GLOBAL: "300", RATE_LIMIT_LOGIN: "10", BODY_LIMIT_KB: "100", LOG_LEVEL: "info",
};

test("إعدادات سليمة بتتحوّل لقيم مظبوطة", () => {
  const e = parseEnv(good);
  assert.equal(e.port, 4000);
  assert.equal(e.adminUsername, "admin");
  assert.deepEqual(e.corsOrigins, ["http://a.com", "http://b.com"]);
  assert.equal(e.cookieMaxAgeMs, 12 * 3600 * 1000);
  assert.equal(e.cookieSecure, false);
  assert.equal(e.cookieDomain, undefined);
  assert.equal(parseEnv({ ...good, NODE_ENV: "production", ADMIN_PASSWORD: "longenough" }).cookieSecure, true);
  assert.equal(parseEnv({ ...good, COOKIE_SAMESITE: "none" }).cookieSecure, true);
});

test("المتغيرات الناقصة كلها بتتذكر في رسالة واحدة", () => {
  assert.throws(() => parseEnv({}), (err) => /JWT_SECRET: missing/.test(err.message) && /MONGO_URI: missing/.test(err.message) && /PORT: missing/.test(err.message));
  const { MONGO_URI, ...rest } = good;
  assert.throws(() => parseEnv(rest), /MONGO_URI: missing/);
  assert.throws(() => parseEnv({ ...good, PORT: " " }), /PORT: missing/);
});

test("القيم الغلط بتتكتشف", () => {
  assert.throws(() => parseEnv({ ...good, PORT: "abc" }), /PORT: must be a whole number/);
  assert.throws(() => parseEnv({ ...good, BCRYPT_ROUNDS: "2" }), /BCRYPT_ROUNDS/);
  assert.throws(() => parseEnv({ ...good, JWT_SECRET: "short" }), /JWT_SECRET: must be at least 32 characters/);
  assert.throws(() => parseEnv({ ...good, COOKIE_SAMESITE: "x" }), /COOKIE_SAMESITE: must be one of/);
  assert.throws(() => parseEnv({ ...good, NODE_ENV: "prod" }), /NODE_ENV/);
  assert.throws(() => parseEnv({ ...good, NODE_ENV: "production", ADMIN_PASSWORD: "1234" }), /ADMIN_PASSWORD: must be at least 8 characters/);
});
