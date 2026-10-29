import mongoose from "mongoose";

const schema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  name: { type: String, required: true }, // اسم الصنف وقت الحركة (بيفضل حتى لو الصنف اتمسح)
  type: { type: String, enum: ["in", "out"], required: true },
  qty: { type: Number, required: true, min: 1 },
  // بالقروش (integer) — الواجهة بتاخدها بالجنيه من movementDto
  amount: { type: Number, required: true, validate: Number.isInteger },
  profit: { type: Number, default: 0, validate: Number.isInteger },
  at: { type: Number, required: true, index: true }, // ms
});
schema.index({ type: 1, at: -1 });

export const Movement = mongoose.models.Movement || mongoose.model("Movement", schema);
