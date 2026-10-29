import path from "node:path";
import { defineConfig } from "vite";
import { existsSync } from "node:fs";
import { balApi } from "./server/api.ts";

const root = path.resolve(import.meta.dirname, "..");
// مفاتيح ElevenLabs وQuran Foundation من .env (على جهازك فقط)
if (existsSync(path.join(root, ".env"))) process.loadEnvFile(path.join(root, ".env"));

/** استوديو بالإسلام: يعمل محليًا فقط. التشغيل: npx bal app (أو npm run app) */
export default defineConfig({
  root: import.meta.dirname,
  publicDir: path.join(root, "public"),
  plugins: [balApi()],
  oxc: { jsx: { runtime: "automatic" } },
  server: {
    host: "127.0.0.1",
    port: 4321,
    open: false,
    fs: { allow: [root] },
    watch: { ignored: ["**/channels/*/episodes/**", "**/channels/*/identity.json", "**/channels/*/channel.json", "**/channels/*/pronunciation.json", "**/.env", "**/renders/**", "**/assets/elements/**", "**/public/_render/**"] },
  },
  resolve: { alias: { "@root": root } },
});
