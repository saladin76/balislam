import path from "node:path";
import { bundle } from "@remotion/bundler";
import { projectRoot } from "../config/paths";

let cached: Promise<string> | null = null;

/** تجميع مشروع Remotion مرة واحدة لكل تشغيل (يُعاد استخدامه لكل الرندرات). */
export const getServeUrl = (fresh = false) => {
  // Fresh episode snapshots must never reuse a bundle assembled before their assets existed.
  // Do not replace the shared cache while another render is consuming its serve URL.
  const build = () => bundle({ entryPoint: path.join(projectRoot, "src", "remotion", "index.ts"), publicDir: path.join(projectRoot, "public") });
  if (fresh) return build();
  if (!cached) cached = build().catch((e) => { cached = null; throw e; });
  return cached;
};

export const browserExecutable = () => process.env.REMOTION_BROWSER_EXECUTABLE || null;
