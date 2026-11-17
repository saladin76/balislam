/**
 * KI-082 (#154): «أعد الدمج» / التجميع فشل حين تأتي وصلة قطع مباشر (آية، سكون مقصود، مشهد بلا كلام: concat)
 * قبل وصلة ذوبان (xfade): concat يخرج بأساس زمني 1/1000000 وxfade يشترط أساس المشاهد 1/fps، فيرفض ffmpeg
 * «First input link main timebase … do not match». الإصلاح: settb=1/fps بعد كل concat في src/studio/assembleScenes.ts.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repo = path.resolve(import.meta.dirname, "..");
const ff = (args: string[]) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });

describe("KI-082: قطع مباشر ثم ذوبان في التجميع", () => {
  it("كل concat في رسم التجميع يعود إلى أساس المشاهد الزمني قبل أي xfade", () => {
    const src = readFileSync(path.join(repo, "src/studio/assembleScenes.ts"), "utf8");
    expect(src).toMatch(/concat=n=2:v=1:a=0,settb=1\/\$\{fps\}\[/);
  });
  it("ffmpeg نفسه: الرسم بعد الإصلاح يعمل، وبدونه يفشل (فالاختبار يقيس السبب الحقيقي)", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "ki082-"));
    try {
      const clip = (n: number) => { const f = path.join(dir, `c${n}.mp4`); ff(["-f", "lavfi", "-i", `testsrc=s=64x36:r=30:d=1`, "-pix_fmt", "yuv420p", f]); return f; };
      const files = [clip(0), clip(1), clip(2)];
      const graph = (fix: boolean) => [
        ...files.map((_, i) => `[${i}:v:0]settb=AVTB,fps=30,format=yuv420p,setsar=1[v${i}]`),
        `[v0][v1]concat=n=2:v=1:a=0${fix ? ",settb=1/30" : ""}[x1]`,
        `[x1][v2]xfade=transition=fade:duration=0.2:offset=1.8[vout]`,
      ].join(";");
      const run = (fix: boolean) => ff([...files.flatMap((f) => ["-i", f]), "-filter_complex", graph(fix), "-map", "[vout]", path.join(dir, `out-${fix}.mp4`)]);
      expect(() => run(false)).toThrow();
      expect(() => run(true)).not.toThrow();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
