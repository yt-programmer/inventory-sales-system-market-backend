import mongoose from "mongoose";

export const CATS = ["Dairy & Eggs", "Snacks", "Drinks", "Bakery", "Grocery"];
export const nameKey = (n) => String(n).trim().toLowerCase();

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nameKey: { type: String, required: true, unique: true }, // عشان منع التكرار يبقى case-insensitive
    category: { type: String, required: true, enum: CATS },
    qty: { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: "Quantity must be a whole number" } },
    cost: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: [0.01, "Selling price must be greater than zero"] },
    sold: { type: Number, default: 0, min: 0 }, // إجمالي المباع (عشان ترتيب "الأكتر مبيعاً" في الكاشير)
  },
  { timestamps: true },
);
schema.pre("validate", function () { if (this.name) this.nameKey = nameKey(this.name); });

export const Product = mongoose.models.Product || mongoose.model("Product", schema);
