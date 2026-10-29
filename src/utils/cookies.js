import { env } from "../config/env.js";

export const COOKIE_TOKEN = "mm_token";

const base = () => ({ secure: env.cookieSecure, sameSite: env.cookieSameSite, path: "/", domain: env.cookieDomain });

// التوكن httpOnly (الجافاسكريبت مبيقراش) + SameSite، والحماية من الطلبات الغريبة بـ CORS (قايمة CORS_ORIGIN)
export const setAuthCookie = (res, token) =>
  res.cookie(COOKIE_TOKEN, token, { ...base(), httpOnly: true, maxAge: env.cookieMaxAgeMs });

export const clearAuthCookie = (res) => res.clearCookie(COOKIE_TOKEN, { ...base(), httpOnly: true });
