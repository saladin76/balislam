/**
 * الفيديو التجميعي: النسخ النهائية بإذن نشرها تُوصل بترتيبها بلا إعادة ترميز، والفصول من مددها، ولا يُجمع ما تختلف
 * خصائصه، ولا عنوان فيه أثر أدوات، ولا حلقة بلا إذن نشر لبصمتها. القياس على ملفات حقيقية يصنعها ffmpeg.
 */
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/studio/sceneService", () => ({ publishHandoffFacts: vi.fn(async (ep: string) => { throw Error(`Publishing is blocked (${ep}).`); }) }));

import { compilationChapters, compilationDir, compilationProblems, concatList, joinParts, makeCompilation, probeProfile, type CompilationPart, type StreamProfile } from "../src/package/compilation";
import { runWithChannel } from "../src/channel";

const profile: StreamProfile = { vcodec: "h264", width: 3840, height: 2160, fps: "30/1", pixFmt: "yuv420p", acodec: "aac", sampleRate: 48000, channels: 2 };
const part = (episode: string, seconds = 600, extra: Partial<CompilationPart> = {}): CompilationPart =>
  ({ episode, title: `حلقة ${episode}`, file: `/x/${episode}.mp4`, sha256: "a".repeat(64), seconds, profile, ...extra });

describe("الفيديو التجميعي: القواعد", () => {
  it("حلقتان على الأقل بلا تكرار، وعنوان، وكل حلقة ١٠ ث على الأقل", () => {
    expect(compilationProblems("تجميع نوفمبر", [part("001"), part("002")])).toEqual([]);
    expect(compilationProblems("تجميع", [part("001")])).toContain("التجميع يحتاج حلقتين على الأقل.");
    expect(compilationProblems("تجميع", [part("001"), part("001")])).toContain("الحلقة 001 مكررة.");
    expect(compilationProblems(" ", [part("001"), part("002")])).toContain("اكتب عنوان التجميع.");
    expect(compilationProblems("تجميع", [part("001"), part("002", 8)]).join()).toContain("أقصر من ١٠ ث");
  });
  it("ملف يختلف في خصائصه لا يُوصل (لا ترميز يخفي الفرق)", () => {
    const p = compilationProblems("تجميع", [part("001"), part("002", 600, { profile: { ...profile, width: 1920, height: 1080 } })]);
    expect(p.join()).toContain("002 تختلف عن 001 في width، height");
  });
  it("القاعدة الأولى: أثر أدوات في العنوان أو في عنوان فصل يرفض", () => {
    expect(compilationProblems("تجميع صُنع بالذكاء الاصطناعي", [part("001"), part("002")]).join()).toContain("قاعدة القناة");
    expect(compilationProblems("تجميع", [part("001"), part("002", 600, { title: "Made with Remotion" })]).join()).toContain("قاعدة القناة");
  });
  it("الفصول تبدأ عند 0:00 وكل حلقة عند مجموع ما قبلها، وبالساعة بعد الستين دقيقة", () => {
    expect(compilationChapters([{ title: "آدم", seconds: 754.4 }, { title: "نوح", seconds: 3000 }, { title: "هود", seconds: 100 }]))
      .toBe("0:00 آدم\n12:34 نوح\n1:02:34 هود");
  });
  it("قائمة الوصل تهرّب علامة الاقتباس في المسار، واسم التجميع مقيّد", () => {
    expect(concatList(["/a/b's.mp4"])).toBe("file '/a/b'\\''s.mp4'\n");
    expect(compilationDir("/c", "2026-11")).toBe(path.join("/c", "compilations", "2026-11"));
    expect(() => compilationDir("/c", "../x")).toThrow();
  });
  it("حلقة بلا إذن نشر لبصمتها لا تدخل، ولا يُكتب شيء", async () => {
    await expect(runWithChannel("dafatir-alzaman", () => makeCompilation({ name: "t-1", title: "تجميع", episodes: ["001", "002"] })))
      .rejects.toThrow("الحلقة 001: لا إذن نشر");
  });
});

describe("الفيديو التجميعي: الوصل على ملفات حقيقية", () => {
  let dir = "";
  const make = (name: string, sec: number, size = "320x180") => {
    const f = path.join(dir, name);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `testsrc=size=${size}:rate=30:duration=${sec}`, "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=48000:duration=${sec}`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ac", "2", "-shortest", "-metadata", "encoder=Remotion", f]);
    return f;
  };
  beforeAll(async () => { dir = await mkdtemp(path.join(os.tmpdir(), "compile-")); });
  afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

  it("يوصل بلا إعادة ترميز: المدة مجموع المدد والخصائص كما هي، ويمر على التنظيف", async () => {
    const a = make("a.mp4", 2), b = make("b.mp4", 3);
    const pa = await probeProfile(a), pb = await probeProfile(b);
    expect(pa.profile).toEqual(pb.profile);
    const parts = [{ ...part("001", pa.seconds), file: a, profile: pa.profile }, { ...part("002", pb.seconds), file: b, profile: pb.profile }];
    const out = path.join(dir, "out", "compilation.mp4");
    const clean = vi.fn(async () => {});
    await joinParts(parts, out, { title: "تجميع", artist: "دفاتر الزمن" }, clean);
    expect(clean).toHaveBeenCalledWith(out.replace(/\.mp4$/, ".part.mp4"), { title: "تجميع", artist: "دفاتر الزمن" });
    const r = await probeProfile(out);
    expect(r.profile).toEqual(pa.profile);
    expect(r.seconds).toBeGreaterThan(4.8);
    expect(r.seconds).toBeLessThan(5.3);
  });
  it("الخصائص المختلفة تظهر في الفحص قبل الوصل", async () => {
    const c = await probeProfile(make("c.mp4", 1, "640x360"));
    expect(c.profile.width).toBe(640);
  });
});
