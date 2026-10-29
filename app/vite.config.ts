import path from "node:path";
import { defineConfig } from "vite";
import { balApi } from "./server/api";

const root = path.resolve(__dirname, "..");

/** استوديو بالإسلام: يعمل محليًا فقط. التشغيل: npx bal app (أو npm run app) */
export default defineConfig({
  root: __dirname,
  publicDir: path.join(root, "public"),
  plugins: [balApi()],
  oxc: { jsx: { runtime: "automatic" } },
  server: {
    host: "127.0.0.1",
    port: 4321,
    open: false,
    fs: { allow: [root] },
    watch: { ignored: ["**/episodes/**", "**/brand/identity.json", "**/renders/**", "**/assets/elements/**"] },
  },
  resolve: { alias: { "@root": root } },
});
