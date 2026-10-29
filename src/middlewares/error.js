import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";

// أسماء حقول الموديل ← أسماء حقول الواجهة
const FIELD = { name: "n", nameKey: "n", category: "cat", qty: "q", cost: "c", price: "p" };

export const notFound = (req, res, next) => next(ApiError.notFound("Route not found", { code: "ROUTE_NOT_FOUND" }));

function normalize(err) {
  if (err instanceof ApiError) return err;
  if (err.type === "entity.parse.failed") return ApiError.badRequest("Invalid JSON", { code: "BAD_JSON" });
  if (err.type === "entity.too.large") return new ApiError(413, "Request too large");
  if (err.name === "ValidationError" && err.errors) {
    const errors = {};
    for (const [path, e] of Object.entries(err.errors)) errors[FIELD[path] || path] = e.message;
    return ApiError.unprocessable(errors);
  }
  if (err.name === "CastError") return ApiError.badRequest("Invalid value", { code: "BAD_VALUE" });
  if (err.code === 11000) {
    const key = Object.keys(err.keyPattern || err.keyValue || {})[0];
    const field = FIELD[key] || key || "_";
    const msg = field === "n" ? "This name already exists" : field === "username" ? "Username already exists" : "This value already exists";
    return ApiError.unprocessable({ [field]: msg });
  }
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") return ApiError.unauthorized("Session expired, please log in again", { code: "SESSION_EXPIRED" });
  if (/^Mongo(ServerSelection|Network)/.test(err.name)) return new ApiError(503, "Database is unavailable right now");
  return new ApiError(500, "A server error occurred", { isOperational: false });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const e = normalize(err);
  const meta = { id: req.id, method: req.method, url: req.originalUrl?.split("?")[0], status: e.status, code: e.code };
  if (e.status >= 500) logger.error(err.message, { ...meta, stack: err.stack });
  else logger.warn(e.message, meta);

  res.status(e.status).json({
    status: e.status >= 500 ? "error" : "fail",
    error: e.message,
    code: e.code,
    ...(e.errors ? { errors: e.errors } : {}),
    requestId: req.id,
    ...(!env.isProd && e.status >= 500 ? { stack: err.stack } : {}),
  });
}
