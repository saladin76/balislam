import path from "node:path";
import { defineConfig } from "vite";
import { existsSync } from "node:fs";
import { balApi } from "./server/api.ts";

const root = path.resolve(import.meta.dirname, "..");
// ملف المفاتيح يمكن مشاركته بين worktrees عند تحديد BAL_ENV_FILE صراحةً.
// لا ننسخ المفاتيح ولا نستوردها من مجلد مشروع آخر تلقائيًا.
const envPath = process.env.BAL_ENV_FILE ? path.resolve(process.env.BAL_ENV_FILE) : path.join(root, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

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
    watch: { ignored: ["**/channels/*/episodes/**", "**/channels/*/identity.json", "**/channels/*/channel.json", "**/channels/*/pronunciation.json", "**/channels/*/ideas.json", "**/channels/*/calendar.json", "**/.env", "**/renders/**", "**/assets/elements/**", "**/public/_render/**"] },
  },
  resolve: { alias: { "@root": root } },
});
