# ميني ماركت — API

Express + MongoDB (Mongoose) + JWT في **كوكي httpOnly** + bcrypt.

## التشغيل
```bash
npm install
cp .env.example .env        # املأ القيم (JWT_SECRET و ADMIN_PASSWORD و MONGO_URI)
npm run dev                 # أو npm start
npm test                    # اختبارات (بتشغّل MongoDB مؤقتة لوحدها)
```
- **كل الإعدادات في `.env` بس.** مفيش قيم افتراضية في الكود: لو متغير ناقص أو غلط السيرفر مبيشتغلش وبيقولك إيه اللي ناقص.
- الأدمن الأول بيتعمل أوتوماتيك من `ADMIN_USERNAME` / `ADMIN_PASSWORD` لو مفيش مستخدمين.
- الاختبارات بتقرا `.env.test`. لو معندكش إنترنت لتحميل MongoDB المؤقتة، شغّل أي MongoDB وحدد `TEST_MONGO_URI=mongodb://127.0.0.1:27017` قبل `npm test`.

## متغيرات `.env`
| المتغير | الوظيفة |
|---|---|
| `NODE_ENV` | `development` أو `production` |
| `TZ` | توقيت المحل (بداية ونهاية اليوم في التقارير) |
| `PORT` · `MONGO_URI` | البورت واتصال القاعدة |
| `JWT_SECRET` · `JWT_EXPIRES` | سر التوقيع (32 حرف+) ومدة التوكن |
| `COOKIE_MAX_AGE_HOURS` · `COOKIE_SAMESITE` · `COOKIE_DOMAIN` | إعدادات الكوكي (الدومين اختياري) |
| `ADMIN_USERNAME` · `ADMIN_PASSWORD` | الأدمن الأول (في الإنتاج 8 خانات+) |
| `CORS_ORIGIN` | الواجهات المسموحة (مفصولة بفاصلة) |
| `BCRYPT_ROUNDS` · `MAX_LOGIN_ATTEMPTS` · `LOCK_MINUTES` | التشفير وقفل الحساب |
| `RATE_LIMIT_GLOBAL` · `RATE_LIMIT_LOGIN` · `BODY_LIMIT_KB` | حدود الطلبات وحجم الـ body |
| `TRUST_PROXY` · `LOG_LEVEL` | خلف proxy، ومستوى السجل |

## الهيكل
```
src/
  index.js               تشغيل السيرفر + إيقاف آمن + معالجة الأخطاء العامة
  app.js                 بناء الـ app (helmet, cors, cookies, sanitize, routes, errors)
  bootstrap.js           ensureAdmin (الأدمن الأول من .env)
  config/                env.js (تحقق من .env)  ·  db.js (اتصال Mongo)
  models/                User · Product · Movement · Setting
  controllers/           auth · users · products · sales · movements · settings · analytics
  routes/                ملف لكل مورد + index.js (الحماية والصلاحيات)
  middlewares/           auth (كوكي+صلاحيات) · sanitize · rateLimit · error · requestId
  validation/            rules.js + schema لكل مورد (نفس قواعد ورسائل الواجهة)
  utils/                 ApiError · asyncHandler · tokens · cookies · dto · dates · ids · forecast · logger
tests/                   auth · users · products · sales · reports · forecast · errors · env · validation
```
السجل (`utils/logger.js`) بيكتب JSON على stdout/stderr للتشغيل والأخطاء بس (مفيش `console`)، وبيتقفل بـ `LOG_LEVEL=silent`.

## الحماية بالكوكيز و CORS
- الدخول `POST /api/auth/login` `{ username, password }` (الاتنين مطلوبين) بيحط كوكي `mm_token` (JWT، **httpOnly**، `SameSite`، و`Secure` في الإنتاج). الواجهة لازم تستخدم `credentials: "include"`.
- **CORS** بقايمة مسموحة (`CORS_ORIGIN`): أي طلب فيه `Origin` غير مسموح (حتى لو الكوكي صح) بيتصدّ بـ 403 قبل أي معالجة، بالإضافة لـ `SameSite` على الكوكي.
- الجلسة مربوطة بـ `tokenVersion`: الخروج وتغيير كلمة السر وتغيير صلاحية المستخدم أو مسحه بيبطّلوا جلساته القديمة.
- قفل الحساب بعد `MAX_LOGIN_ATTEMPTS` محاولات فاشلة، وحد لمحاولات الدخول (rate limit)، ورفض مفاتيح `$` و`.` في الطلبات (NoSQL injection).
- صلاحيات: `admin` (كل حاجة) و`cashier` (يشوف المنتجات من غير سعر الشراء ويبيع من غير ما يشوف الربح).
- لو الواجهة بتتخدّم من **نفس** عنوان الـ API ضيف العنوان ده في `CORS_ORIGIN` كمان. ولو على دومينين مختلفين: اضبط `COOKIE_DOMAIN` و`CORS_ORIGIN`، وتجنّب `COOKIE_SAMESITE=none` إلا لو لازم (مع HTTPS).

## الـ API (كلها تحت `/api`)
| الطريقة | المسار | الصلاحية |
|---|---|---|
| GET | `/public/shop` ← `{ name }` (اسم المحل لصفحة الدخول) | مفتوح |
| POST | `/auth/login` `{ username, password }` | مفتوح |
| GET | `/auth/me` | مسجّل |
| POST | `/auth/logout` · `/auth/change-password` `{ current, password, confirm }` | مسجّل |
| GET | `/products?q=&cat=` · `/products/:id` | أدمن + كاشير (`{ id, n, cat, q, p, s }` + `c` للأدمن، و`s` = إجمالي المباع) |
| POST / PUT / DELETE | `/products` · `/products/:id` | أدمن |
| POST | `/products/:id/stock` `{ q }` إضافة كمية | أدمن |
| POST | `/sales` `{ lines: [{ id, q }] }` | أدمن + كاشير |
| GET | `/movements?type=&limit=&offset=` | أدمن |
| GET | `/analytics?from=&to=` | أدمن |
| GET | `/analytics/forecast?days=30&horizon=30&buffer=20` | أدمن — تشتري إيه الشهر الجاي |
| GET / PUT | `/settings` `{ name, low }` | قراءة للكل، تعديل أدمن |
| GET / POST | `/users` `{ username, password, role? }` | أدمن |
| PUT | `/users/:id` `{ role }` تغيير الصلاحية | أدمن (مش على نفسه) |
| DELETE | `/users/:id` | أدمن (مش على نفسه) |

## الأخطاء
كل الأخطاء بنفس الشكل:
```json
{ "status": "fail", "error": "البيانات فيها أخطاء", "code": "VALIDATION_ERROR",
  "errors": { "n": "الاسم ده موجود قبل كده" }, "requestId": "…" }
```
- `errors` مفاتيحها أسماء حقول الواجهة (`n, cat, q, c, p, name, low, username, password, current, confirm, role, lines, from, to, days, horizon, buffer`) فتتمرّر لـ `error` في `<Field>`.
- الأكواد: `VALIDATION_ERROR` 422 · `UNAUTHORIZED`/`SESSION_EXPIRED` 401 · `FORBIDDEN`/`SELF_MODIFY`/`CORS_BLOCKED` 403 · `NOT_FOUND` 404 · `INSUFFICIENT_STOCK`/`LAST_ADMIN` 409 · `ACCOUNT_LOCKED`/`TOO_MANY_REQUESTS` 429 · `INVALID_KEYS`/`BAD_JSON` 400 · `INTERNAL_ERROR` 500.
- أخطاء Mongoose وJWT واتصال القاعدة بتتحوّل لنفس الشكل. أي خطأ غير متوقع بيرجّع رسالة عامة (والـ stack في التطوير بس) وبيتسجّل بالـ `requestId`.

## توصية الشراء (تشتري إيه الشهر الجاي)
`GET /api/analytics/forecast?days=30&horizon=30&buffer=20` (أدمن):
- `days` فترة حساب المبيعات (7–90)، `horizon` المدة اللي بنشتري ليها (7–60)، `buffer` مخزون الأمان % (0–100).
- معدل البيع اليومي = المباع ÷ الأيام (أو أيام وجود الصنف من تاريخ إضافته لو أقل). المطلوب = المعدل × المدة × (1 + الأمان). **الكمية المقترحة = المطلوب − المخزون الحالي**.
- مرتبة بالأكتر مبيعاً، والأولوية: `urgent` (يكفي أقل من 7 أيام) · `soon` (أقل من 14) · `later` · `ok` (المخزون كفاية). `confidence: "low"` لو الصنف له أقل من 7 أيام بيانات. الصنف اللي مبيعش في الفترة مش بيتقترح.
- بعد ما تشتري وتضيف الكمية للمخزون (`/products/:id/stock`) التوصية بتتحسب من جديد والاقتراح بيختفي.

## ملاحظات
- البيع شغال من غير transactions (على أي MongoDB): خصم ذرّي مشروط بالكمية لكل صنف + تراجع تلقائي لو أي صنف فشل، فمفيش مخزون بالسالب.
- الفلوس في سجل الحركات بتتخزن بالقروش (أرقام صحيحة) والـ API بيرجّعها بالجنيه.
- في الإنتاج: `NODE_ENV=production` و`JWT_SECRET` قوي و`ADMIN_PASSWORD` و`CORS_ORIGIN`، وشغّله ورا HTTPS (ومعاه `TRUST_PROXY=1` لو ورا proxy).
