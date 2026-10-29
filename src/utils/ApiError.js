const CODES = {
  400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE", 422: "VALIDATION_ERROR", 429: "TOO_MANY_REQUESTS", 500: "INTERNAL_ERROR", 503: "SERVICE_UNAVAILABLE",
};

// أي خطأ "متوقع" بنرميه بالشكل ده، وهو اللي بيتحوّل لرد JSON موحّد في middlewares/error.js
export class ApiError extends Error {
  constructor(status, message, { code, errors, isOperational = true } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code || CODES[status] || "ERROR";
    this.errors = errors;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, ApiError);
  }
  static badRequest(m = "Invalid request", o) { return new ApiError(400, m, o); }
  static unauthorized(m = "You must log in", o) { return new ApiError(401, m, o); }
  static forbidden(m = "You're not allowed to do this", o) { return new ApiError(403, m, o); }
  static notFound(m = "Not found", o) { return new ApiError(404, m, o); }
  static conflict(m, o) { return new ApiError(409, m, o); }
  static unprocessable(errors, m = "The data contains errors") { return new ApiError(422, m, { errors }); }
  static tooMany(m, o) { return new ApiError(429, m, o); }
}
