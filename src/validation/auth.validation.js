import { R } from "./rules.js";

export const loginSchema = {
  password: [R.req("Enter your password"), R.str("Password must be text"), R.max(72, "Password is too long")],
  username: [R.req("Enter the username"), R.str("Username must be text"), R.max(30, "Username is too long")],
};

export const changePasswordSchema = (b) => ({
  current: [R.req("Enter your current password"), R.str("Password must be text")],
  password: [
    R.req("Enter the new password"), R.str("Password must be text"),
    R.min(4, "New password must be at least 4 characters"), R.max(72, "Password is too long"),
    (v) => (v === b?.current ? "New password must differ from the current one" : ""),
  ],
  confirm: [R.req("Confirm the new password"), (v) => (v !== b?.password ? "Confirmation doesn't match the new password" : "")],
});

export const createUserSchema = {
  username: [
    R.req("Enter the username"), R.str("Username must be text"),
    R.match(/^[A-Za-z0-9_.-]{3,30}$/, "Username must be 3 to 30 English letters, numbers, or _ . -"),
  ],
  password: [R.req("Enter your password"), R.str("Password must be text"), R.min(4, "Password must be at least 4 characters"), R.max(72, "Password is too long")],
  role: [(v) => (v === undefined || ["admin", "cashier"].includes(v) ? "" : "Role must be admin or cashier")],
};

export const updateUserSchema = {
  role: [R.req("Pick a role"), R.oneOf(["admin", "cashier"], "Role must be admin or cashier")],
};
