import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { globalLimiter, loginLimiter } from "../middlewares/rateLimit.js";
import analyticsRoutes from "./analytics.routes.js";
import authRoutes from "./auth.routes.js";
import movementsRoutes from "./movements.routes.js";
import productsRoutes from "./products.routes.js";
import publicRoutes from "./public.routes.js";
import salesRoutes from "./sales.routes.js";
import settingsRoutes from "./settings.routes.js";
import usersRoutes from "./users.routes.js";

export default function routes(limits = {}) {
  const r = Router();
  r.use(globalLimiter(limits.global));
  r.get("/health", (req, res) => res.json({ ok: true }));
  r.use("/auth", authRoutes({ loginLimiter: loginLimiter(limits.login) }));
  r.use("/public", publicRoutes); // اسم المحل لصفحة الدخول

  // كل اللي تحت محمي بالكوكي (JWT)
  r.use(authenticate);
  r.use("/products", productsRoutes);
  r.use("/sales", salesRoutes);
  r.use("/movements", movementsRoutes);
  r.use("/settings", settingsRoutes);
  r.use("/analytics", analyticsRoutes);
  r.use("/users", usersRoutes);
  return r;
}
