import crypto from "node:crypto";

export function requestId(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
}
