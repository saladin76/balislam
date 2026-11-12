/**
 * D109 (قرار المالك ١٢ نوفمبر: «اذا كان ليس لها استخدم نعم»): لا يدخل Git فيديو معاينة جديد.
 * الباقي متتبَّعًا قائمة مقفلة بسبب استعماله: مختبرات الإنتاج (lab.json يسجل حالة كل مقطع، و«مختبرات الإنتاج» تعرضه،
 * وtests/studio-labs.test.ts يقرأ library.mp4)، ونسخة مراجعة زبدة الكتب 018 التي يسميها مرجع القناة.
 * وما أُزيل (app/server/untracked-previews.json) غير متتبَّع ومساره متجاهَل، فيبقى على جهاز المالك وحده.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanGitEnv } from "../scripts/git-env.mjs";

const repo = path.resolve(import.meta.dirname, "..");
const git = (...a: string[]) => execFileSync("git", a, { cwd: repo, env: cleanGitEnv() }).toString();
const VIDEO = /\.(mp4|mov|webm|mkv|m4v|avi)$/i;

const KEPT = [
  "channels/balislam/episodes/900-engine-lab/previews/camera-ab.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/camera-portrait.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/engine-permanent-portrait.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/engine-permanent.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/engine-styles.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/framing-013-portrait.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/framing-013.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/light-009.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/light.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/motion-013-portrait.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/motion-013.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/motion-scenes.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/motion.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/review-014-portrait.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/review-014.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/transitions-011-portrait.mp4",
  "channels/balislam/episodes/900-engine-lab/previews/transitions-011.mp4",
  "channels/dafatir-alzaman/episodes/900-library-lab/previews/library.mp4",
  "channels/zubdat-alkutub/episodes/001-awwal-marra-osalli/previews/review-018.mp4",
  "channels/zubdat-alkutub/episodes/980-kit-lab/previews/all.mp4",
  "channels/zubdat-alkutub/episodes/980-kit-lab/previews/compare-016-017.mp4",
  "channels/zubdat-alkutub/episodes/980-kit-lab/previews/kit-book.mp4",
  "channels/zubdat-alkutub/episodes/980-kit-lab/previews/kit-chain.mp4",
  "channels/zubdat-alkutub/episodes/980-kit-lab/previews/kit-ideas.mp4",
  "channels/zubdat-alkutub/episodes/980-kit-lab/previews/kit-meter.mp4",
  "channels/zubdat-alkutub/episodes/980-kit-lab/previews/kit-shift-cross.mp4",
  "channels/zubdat-alkutub/episodes/980-kit-lab/previews/kit-shift.mp4",
];

describe("فيديوهات المعاينة في Git (D109)", () => {
  it("المتتبَّع منها هو القائمة المستعملة وحدها: لا فيديو معاينة جديد", () => {
    const tracked = git("ls-files", "-z", "--", "channels").split("\0")
      .filter((f) => /^channels\/[^/]+\/episodes\/[^/]+\/previews\//.test(f) && VIDEO.test(f)).sort();
    expect(tracked).toEqual([...KEPT].sort());
  });

  it("ما أُزيل غير متتبَّع ومساره متجاهَل، فيبقى على جهاز المالك ولا يُرفع", () => {
    const removed = (JSON.parse(readFileSync(path.join(repo, "app/server/untracked-previews.json"), "utf8")) as { files: { path: string; blob: string }[] }).files;
    expect(removed.length).toBe(19);
    for (const f of removed) {
      expect(git("ls-files", "--", f.path), f.path).toBe("");
      expect(git("check-ignore", "--no-index", "--", f.path).trim(), f.path).toBe(f.path);
      expect(f.blob).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it("أي امتداد فيديو جديد في مجلد معاينات متجاهَل", () => {
    for (const ext of ["mp4", "MP4", "mov", "webm", "mkv", "m4v"]) {
      const p = `channels/balislam/episodes/001-x/previews/new.${ext}`;
      expect(git("check-ignore", "--no-index", "--", p).trim()).toBe(p);
    }
  });
});
