import { Router } from "express";
import * as ctrl from "../controllers/products.controller.js";
import { authorize } from "../middlewares/auth.js";
import { ApiError } from "../utils/ApiError.js";
import { isId } from "../utils/ids.js";

const r = Router();
r.param("id", (req, res, next, id) => (isId(id) ? next() : next(ApiError.notFound("Item not found"))));

r.get("/", ctrl.list);                                       // أدمن + كاشير
r.get("/:id", ctrl.get);
r.post("/", authorize("admin"), ctrl.create);                // أدمن بس
r.put("/:id", authorize("admin"), ctrl.update);
r.delete("/:id", authorize("admin"), ctrl.remove);
r.post("/:id/stock", authorize("admin"), ctrl.restock);

export default r;
