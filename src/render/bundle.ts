import path from "node:path";
import { bundle } from "@remotion/bundler";
import { projectRoot } from "../config/paths";

let cached: Promise<string> | null = null;

/** تجميع مشروع Remotion مرة واحدة لكل تشغيل (يُعاد استخدامه لكل الرندرات). */
export const getServeUrl = (fresh = false) => {
  if (!cached || fresh) cached = bundle({ entryPoint: path.join(projectRoot, "src", "remotion", "index.ts"), publicDir: path.join(projectRoot, "public") });
  return cached;
};

export const browserExecutable = () => process.env.REMOTION_BROWSER_EXECUTABLE || null;
