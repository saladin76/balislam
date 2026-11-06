import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,tsx,mjs}", "src/**/*.test.{ts,tsx}"],
  },
});
