import { Movement } from "../models/Movement.js";
import { Product } from "../models/Product.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { movementDto } from "../utils/dto.js";
import { fromCents, toCents } from "../utils/ids.js";
import { parseLines } from "../validation/sale.validation.js";

// البيع من غير transactions (شغال على أي Mongo): كل صنف بيتخصم بتحديث ذرّي مشروط بالكمية،
// ولو أي صنف فشل بنرجّع اللي اتخصم قبله.
export const create = asyncHandler(async (req, res) => {
  const lines = parseLines(req.body);
  const taken = []; // { product, q }
  const rollback = () => Promise.all(taken.map(({ product, q }) => Product.updateOne({ _id: product._id }, { $inc: { qty: q, sold: -q } })));

  try {
    for (const [id, q] of lines) {
      const product = await Product.findOneAndUpdate({ _id: id, qty: { $gte: q } }, { $inc: { qty: -q, sold: q } }, { new: true });
      if (!product) {
        const cur = await Product.findById(id);
        if (!cur) throw ApiError.notFound(`Item #${id} not found`, { errors: { lines: `Item #${id} not found` } });
        const msg = `Only ${cur.qty} of "${cur.name}" available`;
        throw ApiError.conflict(msg, { code: "INSUFFICIENT_STOCK", errors: { lines: msg } });
      }
      taken.push({ product, q });
    }
    const at = Date.now();
    const docs = await Movement.insertMany(
      taken.map(({ product, q }) => ({
        product: product._id, name: product.name, type: "out", qty: q, at,
        amount: toCents(q * product.price), profit: toCents(q * (product.price - product.cost)),
      })),
    );
    const total = fromCents(docs.reduce((s, m) => s + m.amount, 0));
    const profit = fromCents(docs.reduce((s, m) => s + m.profit, 0));
    const body = { total, items: docs.map(movementDto) };
    if (req.user.role === "admin") body.profit = profit; // الكاشير ميشوفش الربح
    else body.items = body.items.map(({ pr, ...m }) => m);
    res.status(201).json(body);
  } catch (e) {
    await rollback();
    throw e;
  }
});
