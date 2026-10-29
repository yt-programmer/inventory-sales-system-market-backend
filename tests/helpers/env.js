import { fileURLToPath } from "node:url";

// لازم يتعمل import الأول في كل ملف اختبار. القيم كلها في .env.test (مفيش قيم في الكود)
process.env.DOTENV_CONFIG_PATH = fileURLToPath(new URL("../../.env.test", import.meta.url));
