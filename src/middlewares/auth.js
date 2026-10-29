import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { COOKIE_TOKEN } from "../utils/cookies.js";
import { verifyToken } from "../utils/tokens.js";

// بيقرا التوكن من الكوكي httpOnly ويتأكد من المستخدم ونسخة التوكن
export const authenticate = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[COOKIE_TOKEN];
  if (!token) throw ApiError.unauthorized();
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized("Session expired, please log in again", { code: "SESSION_EXPIRED" });
  }
  const user = await User.findById(payload.sub);
  if (!user || !user.active || user.tokenVersion !== payload.tv) {
    throw ApiError.unauthorized("Session expired, please log in again", { code: "SESSION_EXPIRED" });
  }
  req.user = user;
  next();
});

export const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(ApiError.forbidden());
