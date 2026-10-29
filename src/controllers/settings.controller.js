import { Setting } from "../models/Setting.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { settingsSchema } from "../validation/settings.validation.js";
import { validate } from "../validation/rules.js";

const dto = (s) => ({ name: s.name, low: s.low });

export const get = asyncHandler(async (req, res) => res.json(dto(await Setting.getMain())));

export const update = asyncHandler(async (req, res) => {
  const b = req.body || {};
  validate(b, settingsSchema);
  const s = await Setting.findByIdAndUpdate("main", { name: String(b.name).trim(), low: Number(b.low) }, { upsert: true, new: true, setDefaultsOnInsert: true });
  res.json(dto(s));
});

// مسار عام (من غير دخول): اسم المحل بس، عشان صفحة الدخول تعرضه
export const publicShop = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ name: (await Setting.getMain()).name });
});
