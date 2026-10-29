import "dotenv/config";

// All settings come from the .env file only (no defaults in code). Anything missing or wrong stops the server with a clear message.
export function parseEnv(src) {
  const problems = [];
  const str = (k) => {
    const v = src[k];
    if (v === undefined || String(v).trim() === "") {
      problems.push(`${k}: missing`);
      return "";
    }
    return String(v).trim();
  };
  const int = (k, min = 0) => {
    const raw = str(k);
    if (!raw) return 0;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min) {
      problems.push(`${k}: must be a whole number, ${min} or more`);
      return 0;
    }
    return n;
  };
  const oneOf = (k, list) => {
    const v = str(k);
    if (v && !list.includes(v))
      problems.push(`${k}: must be one of ${list.join(" | ")}`);
    return v;
  };

  const nodeEnv = oneOf("NODE_ENV", ["development", "production", "test"]);
  const sameSite = oneOf("COOKIE_SAMESITE", ["lax", "strict", "none"]);
  const jwtSecret = str("JWT_SECRET");
  if (jwtSecret && jwtSecret.length < 32)
    problems.push("JWT_SECRET: must be at least 32 characters");
  const adminPassword = str("ADMIN_PASSWORD");
  if (nodeEnv === "production" && adminPassword && adminPassword.length < 8) {
    problems.push(
      "ADMIN_PASSWORD: must be at least 8 characters in production",
    );
  }

  const cfg = {
    nodeEnv,
    isProd: nodeEnv === "production",
    isTest: nodeEnv === "test",
    tz: str("TIMEZONE"),
    port: int("PORT", 1),
    mongoUri: str("MONGO_URI"),
    jwtSecret,
    jwtExpiresIn: str("JWT_EXPIRES"),
    adminUsername: str("ADMIN_USERNAME").toLowerCase(),
    adminPassword,
    cookieMaxAgeMs: int("COOKIE_MAX_AGE_HOURS", 1) * 3600 * 1000,
    cookieDomain: String(src.COOKIE_DOMAIN || "").trim() || undefined, // اختياري
    cookieSameSite: sameSite,
    cookieSecure: nodeEnv === "production" || sameSite === "none",
    corsOrigins: str("CORS_ORIGIN")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    bcryptRounds: int("BCRYPT_ROUNDS", 4),
    maxLoginAttempts: int("MAX_LOGIN_ATTEMPTS", 1),
    lockMinutes: int("LOCK_MINUTES", 1),
    trustProxy: int("TRUST_PROXY", 0),
    logLevel: oneOf("LOG_LEVEL", ["silent", "error", "warn", "info", "debug"]),
    rateLimitGlobal: int("RATE_LIMIT_GLOBAL", 1),
    rateLimitLogin: int("RATE_LIMIT_LOGIN", 1),
    bodyLimitKb: int("BODY_LIMIT_KB", 1),
  };
  if (problems.length)
    throw new Error(
      "The .env file is missing or has invalid values:\n- " +
        problems.join("\n- "),
    );
  return cfg;
}

export const env = parseEnv(process.env);
