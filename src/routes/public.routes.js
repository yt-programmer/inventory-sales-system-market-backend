import { Router } from "express";
import * as ctrl from "../controllers/settings.controller.js";

const r = Router();
r.get("/shop", ctrl.publicShop);
export default r;
