/**
 * الخطاف المسبق (D198، قرار المالك ٢٢ نوفمبر لـ«دفاتر الزمن 001»): الحلقة تبدأ بتسجيل مشهد لاحق نفسه حتى نهاية كلمة،
 * ثم قلب صفحة، والحلقة بعده كما هي متأخرة بمدته بالضبط. لا صوت جديد.
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COLD_OPEN_TAIL_SEC, coldOpenCut, coldOpenFrames, coldOpenIssues, coldOpenOf } from "../src/plan/coldOpen";
import { channelIntroFramesFor, introFramesFor } from "../src/remotion/scenes/ChannelIntro";
import { episodeFrames } from "../src/remotion/scenes/Episode";
import { hookIn } from "../src/studio/quality/card";
import { writePlanFile } from "../src/plan/io";
import type { Plan, PlanScene } from "../src/plan/types";

const words = [
  { word: "فمتى", start: 0, end: 0.56 }, { word: "كانت", start: 0.6, end: 1.013 }, { word: "تلك", start: 1.04, end: 1.32 },
  { word: "البداية؟", start: 1.36, end: 2.32 }, { word: "وأين", start: 2.82, end: 3.31 }, { word: "كانت؟", start: 3.35, end: 4.2078 },
  { word: "لا", start: 4.7, end: 4.9 }, { word: "نملك", start: 4.95, end: 5.4 },
];
const narration = "فمتى كانت تلك البداية؟ وأين كانت؟ لا نملك";
const scene = (id: string, text: string): PlanScene => ({ id, template: "horizon-shot", narration: text, line: 0, props: { shot: "no-date" }, sfx: [] } as unknown as PlanScene);
const base = (): Plan => ({
  version: 1, episode: "001", title: "t", domain: "islamic", themeId: "paper", updatedAt: "x", channel: "dafatir-alzaman",
  chapters: [{ number: 1, title: "", scenes: [scene("c1-s2", "عرفت الأرض أممًا كثيرة."), scene("c1-s5", narration)] }],
} as unknown as Plan);
const voice = { "c1-s5": { file: "a.wav", text: narration, duration: 5.5, words } };
const FRAMES = Math.round((4.21 + COLD_OPEN_TAIL_SEC) * 30);

describe("الخطاف المسبق (D198)", () => {
  it("مدته القطع وقلب الصفحة، ولا وجود له في فصل أو شورت أو حين تُطفأ الافتتاحية", () => {
    const p = { ...base(), coldOpen: { scene: "c1-s5", to: 4.21 } };
    expect(coldOpenFrames(p)).toBe(FRAMES);
    expect(coldOpenFrames(base())).toBe(0);
    expect(coldOpenFrames(p, 1)).toBe(0);
    // مستقل عن افتتاحية القناة المطفأة (D155): «دفاتر الزمن 001» خطتها intro: false
    expect(coldOpenFrames({ ...p, intro: false } as Plan)).toBe(FRAMES);
    expect(coldOpenOf({ coldOpen: { scene: "c1-s5", to: 40 } })!.to).toBe(12);
  });
  it("يأخذ خانة الافتتاحية: كل الأزمنة بعده تتأخر بمدته بالضبط، وافتتاحية القناة كما هي", () => {
    const p = { ...base(), coldOpen: { scene: "c1-s5", to: 4.21 } };
    expect(introFramesFor(undefined, p)).toBe(FRAMES);
    expect(channelIntroFramesFor(undefined, p)).toBe(0);
    expect(introFramesFor(undefined, base())).toBe(0);
    expect(episodeFrames({ plan: p }) - episodeFrames({ plan: base() })).toBe(FRAMES);
  });
  it("القطع بعد نهاية كلمة: نص الخطاف الكلمات المنطوقة فيه وحدها، والقطع داخل كلمة مرفوض", () => {
    expect(coldOpenCut({ words }, 4.21).text).toBe("فمتى كانت تلك البداية؟ وأين كانت؟");
    const p = { ...base(), coldOpen: { scene: "c1-s5", to: 4.21 } };
    expect(coldOpenIssues(p, voice)).toEqual([]);
    expect(coldOpenIssues({ ...p, coldOpen: { scene: "c1-s5", to: 4.8 } }, voice).join()).toMatch(/ليس في الوقفة/);
    expect(coldOpenIssues({ ...p, coldOpen: { scene: "c1-s9", to: 2 } }, voice).join()).toMatch(/غير موجود/);
    expect(coldOpenIssues(p, {}).join()).toMatch(/لا تسجيل مطابق/);
    // مشهد غير الأول: رندره يحذف coldOpen من خطته، فلا فحص
    expect(coldOpenIssues({ ...p, coldOpen: undefined, chapters: [] }, {})).toEqual([]);
    expect(readFileSync("src/render/shotsPreview.ts", "utf8")).toContain("{ intro: false, coldOpen: undefined }");
  });
  it("بعدد الكلمات: يبقى صحيحًا مع إيقاع أسرع (التسجيل المرندر)، والقطع في الوقفة بعد الكلمة الأخيرة وحده", () => {
    // تسجيل مُسرَّع (D140): الكلمات نفسها بأزمنة أقصر — «لا نملك» تقع قبل ٤٫٢١
    const paced = words.map((w) => ({ ...w, start: w.start * 0.82, end: w.end * 0.82 }));
    const v = { "c1-s5": { ...voice["c1-s5"], words: paced } };
    const p = { ...base(), coldOpen: { scene: "c1-s5", words: 6, to: 3.5 } };
    expect(coldOpenCut({ words: paced }, 3.5, 6).text).toBe("فمتى كانت تلك البداية؟ وأين كانت؟");
    expect(coldOpenIssues(p, v)).toEqual([]);
    expect(coldOpenIssues({ ...p, coldOpen: { scene: "c1-s5", words: 6, to: 4.21 } }, v).join()).toMatch(/ليس في الوقفة/);
    expect(coldOpenIssues({ ...p, coldOpen: { scene: "c1-s5", words: 6, to: 3.2 } }, v).join()).toMatch(/ليس في الوقفة/);
    expect(coldOpenIssues({ ...p, coldOpen: { scene: "c1-s5", words: 99, to: 3.5 } }, v).join()).toMatch(/خارج تسجيل/);
  });
  it("بطاقة الجودة: الخطاف عند الثانية صفر", () => {
    const p = { ...base(), coldOpen: { scene: "c1-s5", to: 4.21 } };
    expect(hookIn(p, { voice, recitations: {} } as never)).toEqual({ ok: true, text: "فمتى كانت تلك البداية؟", at: 0 });
  });
  it("نسخة المشهد المصدر للرندر لا تُكتب في plan.json أبدًا", async () => {
    const f = path.join(mkdtempSync(path.join(tmpdir(), "cold-")), "plan.json");
    const p = { ...base(), coldOpen: { scene: "c1-s5", to: 4.21 }, coldOpenSource: scene("c1-s5", narration) };
    await writePlanFile(f, p);
    const saved = JSON.parse(readFileSync(f, "utf8"));
    expect(saved.coldOpen).toEqual({ scene: "c1-s5", to: 4.21 });
    expect(saved.coldOpenSource).toBeUndefined();
  });
  it("لا طريق إلى توليد الصوت: الخطاف يستعمل ملف التسجيل القائم وحده", () => {
    for (const f of ["src/plan/coldOpen.ts", "src/remotion/scenes/Episode.tsx"]) {
      const code = readFileSync(f, "utf8");
      expect(code, f).not.toMatch(/elevenlabs|sentenceGenerate|generateVoice|textToSpeech/i);
    }
    expect(readFileSync("src/remotion/scenes/Episode.tsx", "utf8")).toMatch(/<Audio src=\{mediaSrc\(media, `voice\/\$\{clip\.file\}`\)\} endAt=\{end\}/);
  });
});
