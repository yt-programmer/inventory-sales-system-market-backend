import { Movement } from "../models/Movement.js";
import { Product, nameKey } from "../models/Product.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { movementDto, productDto } from "../utils/dto.js";
import { escapeRegex, toCents } from "../utils/ids.js";
import { productSchema, stockSchema } from "../validation/product.validation.js";
import { assertValid, check, validate } from "../validation/rules.js";

const found = async (id) => {
  const p = await Product.findById(id);
  if (!p) throw ApiError.notFound("Item not found");
  return p;
};

// بيجمّع أخطاء الشكل + التكرار في رد واحد
async function validateProduct(b, excludeId) {
  const errors = check(b, productSchema);
  if (!errors.n) {
    const filter = { nameKey: nameKey(b.n) };
    if (excludeId) filter._id = { $ne: excludeId };
    if (await Product.exists(filter)) errors.n = "This name already exists";
  }
  assertValid(errors);
}
const fields = (b) => ({ name: String(b.n).trim(), category: b.cat, qty: Number(b.q), cost: Number(b.c), price: Number(b.p) });

export const list = asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const cat = String(req.query.cat ?? "").trim();
  const filter = {};
  if (q) filter.nameKey = { $regex: escapeRegex(q) };
  if (cat) filter.category = cat;
  const rows = await Product.find(filter).sort({ createdAt: 1, _id: 1 });
  res.json(rows.map((p) => productDto(p, req.user.role)));
});

export const get = asyncHandler(async (req, res) => res.json(productDto(await found(req.params.id), req.user.role)));

export const create = asyncHandler(async (req, res) => {
  const b = req.body || {};
  await validateProduct(b);
  const p = await Product.create(fields(b));
  if (p.qty > 0) {
    try {
      await Movement.create({ product: p._id, name: p.name, type: "in", qty: p.qty, amount: toCents(p.qty * p.cost), at: Date.now() });
    } catch (e) {
      await Product.deleteOne({ _id: p._id }); // مفيش صنف من غير حركة
      throw e;
    }
  }
  res.status(201).json(productDto(p));
});

export const update = asyncHandler(async (req, res) => {
  const p = await found(req.params.id);
  const b = req.body || {};
  await validateProduct(b, p._id);
  Object.assign(p, fields(b));
  await p.save();
  res.json(productDto(p));
});

export const remove = asyncHandler(async (req, res) => {
  const p = await found(req.params.id);
  await p.deleteOne();
  await Movement.updateMany({ product: p._id }, { $set: { product: null } });
  res.status(204).end();
});

// إضافة كمية: زيادة ذرّية للكمية + حركة "داخل"
export const restock = asyncHandler(async (req, res) => {
  validate(req.body, stockSchema);
  const q = Number(req.body.q);
  const p = await Product.findByIdAndUpdate(req.params.id, { $inc: { qty: q } }, { new: true });
  if (!p) throw ApiError.notFound("Item not found");
  const m = await Movement.create({ product: p._id, name: p.name, type: "in", qty: q, amount: toCents(q * p.cost), at: Date.now() });
  res.json({ product: productDto(p), movement: movementDto(m) });
});
