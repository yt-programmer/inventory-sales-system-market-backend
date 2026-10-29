import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { clearAuthCookie, setAuthCookie } from "../utils/cookies.js";
import { userDto } from "../utils/dto.js";
import { signToken } from "../utils/tokens.js";
import { changePasswordSchema, loginSchema } from "../validation/auth.validation.js";
import { validate } from "../validation/rules.js";

const DUMMY_HASH = bcrypt.hashSync("dummy-password", env.bcryptRounds); // عشان توقيت الرد ميفرّقش بين مستخدم موجود وغير موجود
const BAD = "Wrong password, try again.";
const badLogin = () => new ApiError(401, BAD, { errors: { password: BAD } });

const startSession = (res, user) => setAuthCookie(res, signToken(user));

export const login = asyncHandler(async (req, res) => {
  validate(req.body, loginSchema);
  const { password } = req.body;
  const username = String(req.body.username).toLowerCase().trim();
  const user = await User.findOne({ username }).select("+passwordHash");

  if (!user || !user.active) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw badLogin();
  }
  if (user.lockUntil && user.lockUntil > new Date()) {
    const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
    const msg = `Account temporarily locked, try again in ${mins} minutes`;
    throw new ApiError(429, msg, { code: "ACCOUNT_LOCKED", errors: { password: msg } });
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    user.failedLogins += 1;
    if (user.failedLogins >= env.maxLoginAttempts) {
      user.lockUntil = new Date(Date.now() + env.lockMinutes * 60000);
      user.failedLogins = 0;
    }
    await user.save();
    throw badLogin();
  }
  if (user.failedLogins || user.lockUntil) {
    user.failedLogins = 0;
    user.lockUntil = null;
    await user.save();
  }
  startSession(res, user);
  res.json({ user: userDto(user) });
});

export const logout = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } }); // يبطّل كل الجلسات
  clearAuthCookie(res);
  res.json({ ok: true });
});

export const me = (req, res) => res.json({ user: userDto(req.user) });

export const changePassword = asyncHandler(async (req, res) => {
  const b = req.body || {};
  validate(b, changePasswordSchema(b));
  const user = await User.findById(req.user._id).select("+passwordHash");
  if (!(await bcrypt.compare(b.current, user.passwordHash))) throw ApiError.unprocessable({ current: "Current password is wrong" });
  user.passwordHash = await bcrypt.hash(b.password, env.bcryptRounds);
  user.tokenVersion += 1; // الجلسات القديمة كلها تتبطل، والحالية بتتجدد
  await user.save();
  startSession(res, user);
  res.json({ ok: true });
});
