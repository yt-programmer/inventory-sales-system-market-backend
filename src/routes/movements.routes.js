import { Router } from "express";
import * as ctrl from "../controllers/movements.controller.js";
import { authorize } from "../middlewares/auth.js";

const r = Router();
r.get("/", authorize("admin"), ctrl.list);
export default r;
