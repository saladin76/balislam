import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["app/src/review/**/*.test.ts"],
    environment: "node",
    maxWorkers: 2,
  },
});
