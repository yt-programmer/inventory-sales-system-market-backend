import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs, limit, standardHeaders: true, legacyHeaders: false,
    message: { status: "fail", error: message, code: "TOO_MANY_REQUESTS" },
  });

export const globalLimiter = (limit = env.rateLimitGlobal) => make(60 * 1000, limit, "Too many requests, please wait a bit");
export const loginLimiter = (limit = env.rateLimitLogin) => make(15 * 60 * 1000, limit, "Too many login attempts, try again in a bit");
