import { ApiError } from "../utils/ApiError.js";

// NoSQL injection: أي مفتاح بيبدأ بـ $ أو فيه نقطة بيتّرفض في body و query و params
const dirty = (v, depth = 0) => {
  if (!v || typeof v !== "object" || depth > 8) return false;
  return Object.keys(v).some((k) => k.startsWith("$") || k.includes(".") || dirty(v[k], depth + 1));
};

export function sanitize(req, res, next) {
  if (dirty(req.body) || dirty(req.query) || dirty(req.params)) {
    return next(ApiError.badRequest("The request contains disallowed keys", { code: "INVALID_KEYS" }));
  }
  next();
}
