import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 30 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "cashier"], default: "cashier" },
    active: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 }, // أي زيادة بتبطّل كل التوكنز القديمة
    failedLogins: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

export const User = mongoose.models.User || mongoose.model("User", schema);
