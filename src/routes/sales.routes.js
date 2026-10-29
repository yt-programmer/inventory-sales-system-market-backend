import { Router } from "express";
import * as ctrl from "../controllers/sales.controller.js";

const r = Router();
r.post("/", ctrl.create); // أدمن + كاشير
export default r;
