import { Router } from "express";
import * as ctrl from "../controllers/settings.controller.js";
import { authorize } from "../middlewares/auth.js";

const r = Router();
r.get("/", ctrl.get);
r.put("/", authorize("admin"), ctrl.update);
export default r;
