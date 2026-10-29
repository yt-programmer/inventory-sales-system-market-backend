import { env } from "../config/env.js";

const levels = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
const current = levels[env.logLevel];

// بيكتب JSON على stdout/stderr مباشرة (مفيش console)، والمستوى من LOG_LEVEL في .env
const out = (level, msg, meta = {}) => {
  if (levels[level] > current) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...meta }) + "\n";
  (level === "error" ? process.stderr : process.stdout).write(line);
};

export const logger = {
  error: (m, x) => out("error", m, x),
  warn: (m, x) => out("warn", m, x),
  info: (m, x) => out("info", m, x),
  debug: (m, x) => out("debug", m, x),
};
