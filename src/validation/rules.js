import { ApiError } from "../utils/ApiError.js";

// نفس قواعد الواجهة (src/lib/utils.js) بنفس الرسائل
const s = (v) => String(v ?? "").trim();
const scalar = (v) => typeof v === "number" || typeof v === "string";

export const R = {
  req: (m) => (v) => (s(v) ? "" : m),
  str: (m) => (v) => (typeof v === "string" ? "" : m),
  min: (n, m) => (v) => (s(v).length >= n ? "" : m),
  max: (n, m) => (v) => (s(v).length <= n ? "" : m),
  oneOf: (list, m) => (v) => (list.includes(v) ? "" : m),
  match: (re, m) => (v) => (re.test(s(v)) ? "" : m),
  int: (lo, m) => (v) => { const x = Number(v); return scalar(v) && s(v) !== "" && Number.isInteger(x) && x >= lo ? "" : m; },
  num: (lo, m, strict) => (v) => { const x = Number(v); return scalar(v) && s(v) !== "" && Number.isFinite(x) && (strict ? x > lo : x >= lo) ? "" : m; },
};

export const run = (rules, v) => { for (const r of rules) { const e = r(v); if (e) return e; } return ""; };

// بيرجّع { field: message } لأول خطأ في كل حقل (من غير ما يرمي)
export function check(obj, schema) {
  const errors = {};
  for (const [k, rules] of Object.entries(schema)) {
    const e = run(rules, obj?.[k]);
    if (e) errors[k] = e;
  }
  return errors;
}

export const assertValid = (errors) => { if (Object.keys(errors).length) throw ApiError.unprocessable(errors); };
export const validate = (obj, schema) => assertValid(check(obj, schema));
