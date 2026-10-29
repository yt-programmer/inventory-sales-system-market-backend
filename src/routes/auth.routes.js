import { Router } from "express";
import * as ctrl from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.js";

export default function authRoutes({ loginLimiter }) {
  const r = Router();
  r.post("/login", loginLimiter, ctrl.login); // مفتوح (مفيش جلسة لسه)
  r.get("/me", authenticate, ctrl.me);
  r.post("/logout", authenticate, ctrl.logout);
  r.post("/change-password", authenticate, ctrl.changePassword);
  return r;
}
