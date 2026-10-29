import { ApiError } from "../utils/ApiError.js";
import { isId } from "../utils/ids.js";

// body: { lines: [{ id, q }] } ← بيدمج الأصناف المكررة ويرجّع Map(id → qty)
export function parseLines(body) {
  const lines = body?.lines;
  const bad = (m) => ApiError.unprocessable({ lines: m });
  if (!Array.isArray(lines) || !lines.length) throw bad("The invoice is empty");
  if (lines.length > 200) throw bad("The invoice is too large");
  const merged = new Map();
  for (const l of lines) {
    const q = Number(l?.q);
    if (!isId(l?.id) || typeof l?.q === "boolean" || !Number.isInteger(q) || q < 1) throw bad("An item has an invalid quantity");
    merged.set(l.id, (merged.get(l.id) || 0) + q);
  }
  return merged;
}
