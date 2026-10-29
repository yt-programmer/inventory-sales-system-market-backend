import mongoose from "mongoose";

const schema = new mongoose.Schema({
  _id: { type: String, default: "main" },
  name: { type: String, default: "Mini Market" },
  low: { type: Number, default: 5, min: 0 },
});

schema.statics.getMain = function () {
  return this.findByIdAndUpdate("main", { $setOnInsert: { name: "Mini Market", low: 5 } }, { upsert: true, new: true });
};

export const Setting = mongoose.models.Setting || mongoose.model("Setting", schema);
