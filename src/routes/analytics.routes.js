import { Router } from "express";
import * as ctrl from "../controllers/analytics.controller.js";
import { authorize } from "../middlewares/auth.js";

const r = Router();
r.get("/", authorize("admin"), ctrl.summary);
r.get("/forecast", authorize("admin"), ctrl.forecast); // تشتري إيه الشهر الجاي
export default r;
