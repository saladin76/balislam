import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    // مجلد مؤقت واحد لكل تشغيل، يُحذف كله في نهايته (tests/setup/runTmp.ts)
    globalSetup: ["tests/setup/runTmp.ts"],
  },
});
