import { Movement } from "../models/Movement.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { movementDto } from "../utils/dto.js";

// GET /api/movements?type=in|out&limit=50&offset=0
export const list = asyncHandler(async (req, res) => {
  const type = ["in", "out"].includes(req.query.type) ? req.query.type : "";
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const rows = await Movement.find(type ? { type } : {}).sort({ at: -1, _id: -1 }).skip(offset).limit(limit);
  res.json(rows.map(movementDto));
});
