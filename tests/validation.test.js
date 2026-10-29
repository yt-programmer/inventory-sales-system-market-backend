import "./helpers/env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { R, check, run } from "../src/validation/rules.js";
import { parseRange } from "../src/validation/analytics.validation.js";
import { parseLines } from "../src/validation/sale.validation.js";

test("قواعد الأرقام", () => {
  assert.equal(run([R.int(0, "x")], 5), "");
  assert.equal(run([R.int(0, "x")], "5"), "");
  for (const bad of ["", " ", 1.5, -1, "abc", [5], true, null, undefined, {}]) assert.equal(run([R.int(0, "x")], bad), "x", String(bad));
  assert.equal(run([R.num(0, "x", true)], 0), "x");
  assert.equal(run([R.num(0, "x", true)], 0.01), "");
  assert.equal(run([R.num(0, "x")], Infinity), "x");
});

test("قواعد النصوص", () => {
  assert.equal(run([R.req("r"), R.str("s")], "  "), "r");
  assert.equal(run([R.req("r"), R.str("s")], { a: 1 }), "s");
  assert.equal(run([R.min(2, "m")], " a "), "m");
  assert.equal(check({ a: "", b: "ok" }, { a: [R.req("a!")], b: [R.req("b!")] }).a, "a!");
});

test("تحليل الفترة", () => {
  assert.equal(parseRange({ from: "2026-01-01", to: "2026-01-31" }).from, "2026-01-01");
  assert.throws(() => parseRange({ from: "2026-01-01", to: "2026-02-01" }), /The data contains errors/);
});

test("تحليل سطور الفاتورة", () => {
  const id = "a".repeat(24);
  assert.equal(parseLines({ lines: [{ id, q: 1 }, { id, q: "2" }] }).get(id), 3);
  assert.throws(() => parseLines({ lines: [{ id, q: true }] }));
  assert.throws(() => parseLines({ lines: "x" }));
});
