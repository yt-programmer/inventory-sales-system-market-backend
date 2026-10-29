import { CATS } from "../models/Product.js";
import { R } from "./rules.js";

export const productSchema = {
  n: [R.req("Enter the item name"), R.str("Name must be text"), R.min(2, "Name must be at least 2 characters"), R.max(80, "Name is too long")],
  cat: [R.oneOf(CATS, "Pick a valid category")],
  q: [R.int(0, "Quantity must be a whole number, zero or more")],
  c: [R.num(0, "Purchase price must be a number, zero or more")],
  p: [R.num(0, "Selling price must be greater than zero", true)],
};

export const stockSchema = { q: [R.int(1, "Quantity must be a whole number, one or more")] };
