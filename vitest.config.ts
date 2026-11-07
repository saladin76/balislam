import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,tsx,mjs}", "src/**/*.test.{ts,tsx}"],
    // قبل أي اختبار: لا متغيرات تحدد المستودع الحقيقي في بيئة الاختبارات (الأمر 018)
    setupFiles: ["tests/setup/git-env.ts"],
  },
});
