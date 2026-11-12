import { defineConfig } from "vitest/config";

/**
 * `npm run e2e`: the owner's whole journey over the real Studio server (stabilization brief, work ٤).
 * One channel per file, run one after another (each starts its own server and renders a tiny real Master).
 * BAL_E2E_CHANNELS=balislam,dafatir-alzaman,zubdat-alkutub chooses the channels (default: balislam).
 */
export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 1_800_000,
    hookTimeout: 300_000,
    setupFiles: ["tests/setup/git-env.ts"],
  },
});
