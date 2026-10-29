import { ApiError } from "../utils/ApiError.js";
import { DAY, dayStart, dk, validDay } from "../utils/dates.js";

// GET /api/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD — الافتراضي آخر 7 أيام وأقصى فترة 31 يوم
export function parseRange(query) {
  const to = String(query.to || dk(Date.now()));
  const from = String(query.from || (validDay(to) ? dk(dayStart(to) - 6 * DAY) : ""));
  const errors = {};
  if (!validDay(from)) errors.from = "Start date is invalid";
  if (!validDay(to)) errors.to = "End date is invalid";
  if (!errors.from && !errors.to) {
    if (from > to) errors.from = "Start is after the end date";
    else if (Math.round((dayStart(to) - dayStart(from)) / DAY) + 1 > 31) errors.to = "Period is longer than 31 days";
  }
  if (Object.keys(errors).length) throw ApiError.unprocessable(errors);
  return { from, to };
}

// GET /api/analytics/forecast?days=30&horizon=30&buffer=20
export function parseForecast(query) {
  const read = (k, d, lo, hi, msg) => {
    const raw = query[k];
    if (raw === undefined || raw === "") return { v: d };
    const n = Number(raw);
    return Number.isInteger(n) && n >= lo && n <= hi ? { v: n } : { err: msg };
  };
  const days = read("days", 30, 7, 90, "Calculation days must be 7 to 90");
  const horizon = read("horizon", 30, 7, 60, "Purchase horizon must be 7 to 60 days");
  const buffer = read("buffer", 20, 0, 100, "Safety stock must be 0 to 100%");
  const errors = {};
  if (days.err) errors.days = days.err;
  if (horizon.err) errors.horizon = horizon.err;
  if (buffer.err) errors.buffer = buffer.err;
  if (Object.keys(errors).length) throw ApiError.unprocessable(errors);
  return { days: days.v, horizon: horizon.v, buffer: buffer.v };
}
