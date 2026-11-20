import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sfxLibrary } from "../brand/sfx";
import { MASTER, roleOf } from "../brand/sfxMastering";

// Owner, 20 Nov («نخليها احترافية»): every effect in the library is mastered by its role — loudness, ceiling, edges.
const dir = path.join(import.meta.dirname, "..", "assets", "sfx");
const live = sfxLibrary.filter((d) => existsSync(path.join(dir, `${d.id}.mp3`)));
const run = (f: string) => String(spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", "ebur128=peak=true,astats=metadata=0", "-f", "null", "-"], { encoding: "utf8" }).stderr);

describe("مكتبة المؤثرات معالَجة بدورها", () => {
  it("كل مؤثر حي له أصل محفوظ في assets/sfx/original", () => {
    expect(live.length).toBeGreaterThan(0);
    for (const d of live) expect(existsSync(path.join(dir, "original", `${d.id}.mp3`)), d.id).toBe(true);
    for (const f of readdirSync(path.join(dir, "original"))) expect(existsSync(path.join(dir, f)), f).toBe(true);
  });
  it.each(live.map((d) => [d.id, d] as const))("%s: ٤٨ كيلوهرتز، الذروة تحت السقف، والعلو عند هدف دوره", (_id, d) => {
    const f = path.join(dir, `${d.id}.mp3`);
    const sr = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=sample_rate", "-of", "csv=p=0", f], { encoding: "utf8" }).trim();
    expect(sr, d.id).toBe(String(MASTER.sampleRate));
    const e = run(f);
    const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(e.slice(e.lastIndexOf("Summary")))?.[1]);
    expect(peak, `${d.id} true peak`).toBeLessThanOrEqual(MASTER.truePeak + 0.5);
    const role = roleOf(d.id, d.category);
    const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(e.slice(e.lastIndexOf("Summary")))?.[1]);
    const rms = Number(/Overall[\s\S]*?RMS level dB: (-?[\d.]+)/.exec(e)?.[1]);
    // أقصر من بوابة LUFS (٠٫٤ ث): يُقاس بالطاقة المتوسطة
    const level = lufs > -70 ? lufs : rms;
    expect(Math.abs(level - MASTER.lufs[role]), `${d.id} ${role} level ${level}`).toBeLessThanOrEqual(role === "impact" || lufs <= -70 ? 3 : 2);
  }, 30_000);
});
