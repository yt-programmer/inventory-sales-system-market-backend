import { R } from "./rules.js";

export const settingsSchema = {
  name: [R.req("Enter the shop name"), R.str("Name must be text"), R.min(2, "Name must be at least 2 characters"), R.max(60, "Name is too long")],
  low: [R.int(0, "Alert threshold must be a whole number, zero or more")],
};
