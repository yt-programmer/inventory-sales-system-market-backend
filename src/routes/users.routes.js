import { Router } from "express";
import * as ctrl from "../controllers/users.controller.js";
import { authorize } from "../middlewares/auth.js";
import { ApiError } from "../utils/ApiError.js";
import { isId } from "../utils/ids.js";

const r = Router();
r.param("id", (req, res, next, id) => (isId(id) ? next() : next(ApiError.notFound("User not found"))));
r.use(authorize("admin"));
r.get("/", ctrl.list);
r.post("/", ctrl.create);
r.put("/:id", ctrl.update); // تغيير الصلاحية
r.delete("/:id", ctrl.remove);
export default r;
