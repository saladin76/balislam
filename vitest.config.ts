import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,tsx,mjs}", "src/**/*.test.{ts,tsx}"],
    // Keep integration-heavy filesystem tests responsive under load: default
    // workers can oversubscribe the Mac/CI, causing unrelated 5s test timeouts.
    // Preserve the 5-second per-test timeout and all test isolation semantics.
    maxWorkers: 4,
    // قبل أي اختبار: لا متغيرات تحدد المستودع الحقيقي في بيئة الاختبارات (الأمر 018)
    setupFiles: ["tests/setup/git-env.ts"],
  },
});
