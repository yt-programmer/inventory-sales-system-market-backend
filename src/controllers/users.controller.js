import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { userDto } from "../utils/dto.js";
import { createUserSchema, updateUserSchema } from "../validation/auth.validation.js";
import { assertValid, check, validate } from "../validation/rules.js";

export const list = asyncHandler(async (req, res) => {
  res.json((await User.find().sort({ createdAt: 1 })).map(userDto));
});

export const create = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const errors = check(b, createUserSchema);
  if (!errors.username && (await User.exists({ username: b.username.toLowerCase() }))) errors.username = "Username already exists";
  assertValid(errors);
  const user = await User.create({
    username: b.username,
    passwordHash: await bcrypt.hash(b.password, env.bcryptRounds),
    role: b.role || "cashier",
  });
  res.status(201).json(userDto(user));
});

const find = async (id) => {
  const u = await User.findById(id);
  if (!u) throw ApiError.notFound("User not found");
  return u;
};
const notSelf = (req, user, msg) => {
  if (String(user._id) === String(req.user._id)) throw ApiError.forbidden(msg, { code: "SELF_MODIFY" });
};
const keepOneAdmin = async (user) => {
  if (user.role === "admin" && (await User.countDocuments({ role: "admin" })) <= 1) {
    throw ApiError.conflict("At least one admin must remain", { code: "LAST_ADMIN" });
  }
};

// تغيير الصلاحية (الجلسات المفتوحة للمستخدم بتتبطل)
export const update = asyncHandler(async (req, res) => {
  const b = req.body || {};
  validate(b, updateUserSchema);
  const user = await find(req.params.id);
  notSelf(req, user, "You can't change your own role");
  if (user.role !== b.role) {
    if (b.role !== "admin") await keepOneAdmin(user);
    user.role = b.role;
    user.tokenVersion += 1;
    await user.save();
  }
  res.json(userDto(user));
});

export const remove = asyncHandler(async (req, res) => {
  const user = await find(req.params.id);
  notSelf(req, user, "You can't delete yourself");
  await keepOneAdmin(user);
  await user.deleteOne();
  res.status(204).end();
});
