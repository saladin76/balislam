/**
 * المرحلة A (خطة «احترافية بلا مثيل»)، المهمة ٣: ما يُنشر بعلو −14 LUFS بقياسين وكسب خطي واحد، والصورة كما هي.
 * على ملفات حقيقية يصنعها ffmpeg، ثم يُقاس الناتج بمقياس بطاقة الجودة نفسه (ebur128).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { measureLoudness } from "../src/studio/quality/audio";
import { LOUDNESS_TARGET, LOUDNESS_TOLERANCE, TRUE_PEAK_MAX } from "../src/studio/quality/card";
import { lastLoudnormJson, normalizeProgramLoudness, secondPassFilter } from "../src/studio/quality/normalize";

const dir = mkdtempSync(path.join(os.tmpdir(), "loudness-14-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const ff = (args: string[]) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });
const videoHash = (file: string) => execFileSync("ffmpeg", ["-nostdin", "-loglevel", "error", "-i", file, "-map", "0:v", "-c", "copy", "-f", "md5", "-"]).toString().trim();
/** ٦ ث صورة متحركة؛ صوت «راوٍ» نغمة متقطعة وخلفية أخفض بكثير، بعلو كلي يحدده volume */
const make = (file: string, volume: string, silent = false) => ff([
  "-f", "lavfi", "-i", "testsrc2=s=320x180:r=30:d=6",
  "-f", "lavfi", "-i", silent ? "anullsrc=r=48000:cl=stereo:d=6" : "sine=frequency=330:sample_rate=48000:duration=6",
  "-f", "lavfi", "-i", "anoisesrc=d=6:c=pink:r=48000:a=0.02",
  "-filter_complex", silent ? "[1:a]anull[a]" : `[1:a]volume='if(lt(mod(t,1),0.6),1,0.05)':eval=frame[v];[v][2:a]amix=inputs=2:normalize=0,volume=${volume}[a]`,
  "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", file]);

describe("علو الحلقة −14 LUFS (المهمة ٣)", () => {
  it("حلقة خافتة جدًا (≈ −32) وحلقة عالية (≈ −8): كلتاهما −14 ±1 وذروتهما ≤ −1 dBTP، والصورة نفسها بايتًا بايتًا", async () => {
    for (const [name, vol] of [["quiet", "0.05"], ["loud", "1.6"]] as const) {
      const f = path.join(dir, `${name}.mp4`);
      make(f, vol);
      const v = videoHash(f);
      const before = await measureLoudness(f);
      const r = await normalizeProgramLoudness(f, "192k");
      const after = await measureLoudness(f);
      expect(Math.abs(before.integrated - LOUDNESS_TARGET)).toBeGreaterThan(3);
      expect(r.type).toBe("linear");
      expect(Math.abs(after.integrated - LOUDNESS_TARGET)).toBeLessThanOrEqual(LOUDNESS_TOLERANCE);
      expect(after.truePeak).toBeLessThanOrEqual(TRUE_PEAK_MAX);
      expect(videoHash(f)).toBe(v);
    }
  }, 120_000);

  it("كسب خطي واحد: الفرق بين الراوي والخلفية لا يتغير (التوازن كما هو)", async () => {
    const f = path.join(dir, "balance.mp4");
    make(f, "0.1");
    const seg = (file: string, from: number, to: number) => {
      const r = spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-i", file, "-af", `atrim=${from}:${to},volumedetect`, "-f", "null", "-"], { encoding: "utf8" });
      return Number(/mean_volume:\s*(-?[\d.]+)/.exec(r.stderr)?.[1]);
    };
    const gap = (file: string) => seg(file, 2.1, 2.5) - seg(file, 2.7, 2.95);
    const g0 = gap(f);
    await normalizeProgramLoudness(f, "192k");
    expect(Math.abs(gap(f) - g0)).toBeLessThan(0.5);
  }, 60_000);

  it("ملف صامت يُترك كما هو بايتًا بايتًا", async () => {
    const f = path.join(dir, "silent.mp4");
    make(f, "1", true);
    const before = readFileSync(f);
    const r = await normalizeProgramLoudness(f, "192k");
    expect(r.type).toBe("silent");
    expect(readFileSync(f).equals(before)).toBe(true);
    expect(statSync(f).size).toBe(before.length);
  }, 60_000);

  it("القياس الثاني يأخذ قياسات الأول كما هي، خطيًا، بسقف ذروة −1.5", () => {
    const m = lastLoudnormJson(`junk\n{\n "input_i" : "-31.20",\n "input_tp" : "-12.00",\n "input_lra" : "3.10",\n "input_thresh" : "-41.50",\n "target_offset" : "0.20"\n}\n`);
    expect(secondPassFilter(m)).toBe("loudnorm=I=-14:TP=-1.5:LRA=20:measured_I=-31.20:measured_TP=-12.00:measured_LRA=3.10:measured_thresh=-41.50:offset=0.20:linear=true:print_format=json,aresample=48000");
    expect(() => lastLoudnormJson("no json")).toThrow(/علو الحلقة/);
  });
});
