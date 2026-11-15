/**
 * الآية على الشاشة (طلب المالك ١٥ نوفمبر «لما يذكر ايه خليها تظهر على الشاشة»):
 * النص من السكريبت حرفًا، لا يُرسل إلى الصوت، الآية الطويلة صفحات لا خط يضيع، والمرجع تحتها،
 * والبسملة المنطوقة داخل مشهد راوٍ تظهر وحدها. الآليات واحدة في القنوات الثلاث.
 */
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

const clock = vi.hoisted(() => ({ frame: 0, duration: 600 }));
vi.mock("remotion", async (orig) => ({
  ...(await orig<typeof import("remotion")>()),
  useCurrentFrame: () => clock.frame,
  useVideoConfig: () => ({ fps: 30, durationInFrames: clock.duration, width: 1920, height: 1080, id: "t", defaultProps: {}, props: {}, defaultCodec: null }),
}));

import { pageLetterBudget, pageOpacity, pageWindows, verseLetters, versePages } from "../src/quran/versePages";
import { parseScript } from "../src/script/parse";
import { quranFromScript } from "../src/quran/scriptText";
import { withQuran } from "../src/plan/quranText";
import { assertNoQuranForTts } from "../src/voice/quranGuard";
import { BASMALA_TEXT } from "../src/voice/basmala";
import { Providers } from "../src/remotion/Providers";
import { VerseCard } from "../src/remotion/scenes/VerseCard";
import { HorizonVerse } from "../src/remotion/scenes/HorizonShot";
import { SceneFromPlan, showsBasmalaOverlay } from "../src/remotion/scenes/components";
import { basmalaWindows } from "../src/remotion/scenes/BasmalaOnScreen";
import { intendedStillness } from "../src/render/stillness";
import { loadChannel, loadChannelIdentity } from "../src/channel";
import { channelInfo } from "../src/channel/types";
import type { Plan, PlanScene } from "../src/plan/types";

const root = path.join(__dirname, "..");
const CHANNELS = ["balislam", "dafatir-alzaman", "zubdat-alkutub"] as const;
const SCRIPTS: Record<string, string> = {
  balislam: "channels/balislam/episodes/001-know-the-truth",
  "zubdat-alkutub": "channels/zubdat-alkutub/episodes/001-awwal-marra-osalli",
};
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const plain = (html: string) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
const within = (ch: string, node: React.ReactNode) =>
  renderToStaticMarkup(<Providers identity={loadChannelIdentity(ch)} channel={channelInfo(loadChannel(ch))}>{node}</Providers>);

/** نص آية من سكريبت المالك نفسه (لا يُكتب نص آية في الاختبار) */
const scriptVerses = (ch: string) => {
  const dir = SCRIPTS[ch]!;
  const file = path.join(root, dir, "script.md");
  return quranFromScript(parseScript(readFileSync(file, "utf8"), file));
};
const aVerse = scriptVerses("balislam").ayahs[0]!;
/** آية طويلة للاختبار: آيات السكريبت متتابعة بفاصل ۝ (بيانات اختبار لا تُعرض) */
const joined = [...scriptVerses("balislam").ayahs, ...scriptVerses("zubdat-alkutub").ayahs].map((a) => a.text);
const longText = [...joined, ...joined, ...joined].join(" ۝ ");

describe("النص من السكريبت حرفًا", () => {
  it("بطاقة الآية تأخذ نص السكريبت كما كتبه المالك، بلا جلب ولا تعديل", () => {
    for (const ch of Object.keys(SCRIPTS)) {
      const authored = scriptVerses(ch);
      expect(authored.problems).toEqual([]);
      const plan = JSON.parse(readFileSync(path.join(root, SCRIPTS[ch]!, "plan.json"), "utf8")) as Plan;
      const filled = withQuran(plan, authored.texts);
      const cards = filled.chapters.flatMap((c) => c.scenes).filter((s) => s.template === "verse-card");
      expect(cards.length).toBeGreaterThan(0);
      for (const s of cards) expect(s.props.text).toBe(authored.texts[s.ayahKey!]);
    }
  });
  it("الصفحات تعيد كلمات الآية نفسها بترتيبها، والقصيرة صفحة واحدة مطابقة حرفًا", () => {
    expect(versePages(aVerse.text, pageLetterBudget(90))).toEqual([aVerse.text]);
    expect(verseLetters(longText)).toBeGreaterThan(2 * pageLetterBudget(90));
    const pages = versePages(longText, pageLetterBudget(90));
    expect(pages.length).toBeGreaterThan(2);
    expect(pages.join(" ")).toBe(words(longText).join(" "));
  });
  it("نص الآية والبسملة لا يُرسلان إلى الصوت (الحارس كما هو)", () => {
    expect(() => assertNoQuranForTts(`﴿${aVerse.text}﴾`)).toThrow();
    expect(() => assertNoQuranForTts(BASMALA_TEXT)).toThrow();
  });
});

describe("الآية الطويلة صفحات لا تُقطع فيها كلمة", () => {
  for (const [room, label] of [[90, "أفقي"], [80, "رأسي"], [95, "حبر أفقي"]] as const) {
    it(`كل صفحة في حدها (${label})، والقطع عند ۝ أولًا`, () => {
      const budget = pageLetterBudget(room);
      const pages = versePages(longText, budget);
      for (const p of pages) expect(verseLetters(p) <= budget || words(p).length === 1).toBe(true);
      // كل صفحة كلمات كاملة من الآية (لا نصف كلمة)
      const all = new Set(words(longText));
      for (const p of pages) for (const w of words(p)) expect(all.has(w)).toBe(true);
      // القطع عند فاصل الآيات: لا صفحة تبدأ بـ ۝ ولا تقطع آية تتسع لصفحة
      for (const p of pages) expect(p.startsWith("۝")).toBe(false);
    });
  }
  it("التوقيت بنصيب الحروف على مدى التلاوة، وصفحة واحدة ظاهرة في كل لحظة، والأخيرة حتى آخر المشهد", () => {
    const pages = versePages(longText, pageLetterBudget(90));
    const w = pageWindows(pages, 0, 900);
    for (let f = 0; f < 1200; f += 3) {
      const shown = w.map((x) => pageOpacity(x, f));
      expect(shown.filter((o) => o > 0).length).toBeLessThanOrEqual(1);
    }
    expect(pageOpacity(w[0]!, 0)).toBe(1); // owner-pin-ok: بيانات مصطنعة في الاختبار
    expect(pageOpacity(w[w.length - 1]!, 5000)).toBe(1); // owner-pin-ok: بيانات مصطنعة في الاختبار
    expect(w[w.length - 1]!.to).toBe(Infinity);
  });
});

describe("البطاقة في القنوات الثلاث: النص والمرجع قبل التلاوة وبعدها", () => {
  const card = (ch: string, text: string, recitationDuration?: number) =>
    within(ch, <VerseCard themeId="night" orientation="landscape" text={text} reference="البقرة · ٤٢" recitationDuration={recitationDuration} />);
  for (const ch of CHANNELS) {
    it(`${ch}: الآية القصيرة كاملة والمرجع ظاهر`, () => {
      clock.frame = 200; clock.duration = 300;
      const html = card(ch, aVerse.text);
      for (const w of words(aVerse.text)) expect(plain(html)).toContain(w);
      expect(plain(html)).toMatch(/البقرة/);
      expect(html).not.toContain("data-verse-page");
    });
    it(`${ch}: الآية الطويلة صفحات في موضع واحد تتقدم مع التلاوة`, () => {
      clock.duration = 1500;
      clock.frame = 5;
      const first = card(ch, longText, 45);
      expect((first.match(/data-verse-page=/g) ?? []).length).toBeGreaterThan(1);
      clock.frame = 1300;
      const last = card(ch, longText, 45);
      // آخر صفحة ظاهرة في آخر التلاوة
      const pages = versePages(longText, pageLetterBudget(ch === "zubdat-alkutub" ? 50 : 90));
      expect(last).toContain(pages[pages.length - 1]!.split(" ")[0]);
    });
  }
  it("دفاتر الزمن «خط الأفق»: نص السكريبت يظهر قبل رفع التلاوة (نسخة قبل النهائية)، لا «موضع آية»", () => {
    clock.frame = 60; clock.duration = 300;
    const html = within("dafatir-alzaman", <HorizonVerse themeId="night" orientation="landscape" text={aVerse.text} ayahKey="2:42" />);
    expect(html).not.toContain("موضع آية");
    for (const w of words(aVerse.text)) expect(plain(html)).toContain(w);
    // بلا نص في السكريبت: وسم الإنتاج كما كان، ولا نص مؤقت
    expect(within("dafatir-alzaman", <HorizonVerse themeId="night" orientation="landscape" text="" ayahKey="2:42" />)).toContain("موضع آية");
  });
});

describe("البسملة على الشاشة حين تُنطق داخل مشهد راوٍ", () => {
  const scene = (narration: string, template = "kinetic-text", props: Record<string, string> = {}): PlanScene =>
    ({ id: "c1-s1", template, narration, line: 1, props, sfx: [] }) as PlanScene;
  const narration = "بسم الله الرحمن الرحيم. نبدأ الحكاية من أولها.";
  it("تُرسم فوق القالب لحظة كلماتها فقط، بكلمات السكريبت", () => {
    const wins = basmalaWindows(narration, undefined, 300);
    expect(wins).toHaveLength(1); // owner-pin-ok: بيانات مصطنعة في الاختبار
    expect(wins[0]!.text).toBe("بسم الله الرحمن الرحيم"); // owner-pin-ok: بيانات مصطنعة في الاختبار
    for (const ch of CHANNELS) {
      clock.duration = 300;
      clock.frame = Math.round((wins[0]!.from + wins[0]!.to) / 2);
      const html = within(ch, <SceneFromPlan scene={scene(narration)} themeId="night" orientation="portrait" />);
      expect(html).toContain("data-basmala-on-screen");
      clock.frame = 290;
      expect(within(ch, <SceneFromPlan scene={scene(narration)} themeId="night" orientation="landscape" />)).not.toContain("data-basmala-on-screen");
    }
  });
  it("لا تُكرَّر في لقطة البسملة المصممة ولا في بطاقة الآية ولا في مشهد بلا بسملة", () => {
    expect(showsBasmalaOverlay(scene("بسم الله الرحمن الرحيم.", "horizon-shot", { shot: "basmala" }))).toBe(false);
    expect(showsBasmalaOverlay(scene("", "verse-card"))).toBe(false);
    expect(showsBasmalaOverlay(scene("نبدأ الحكاية من أولها."))).toBe(false);
    expect(showsBasmalaOverlay(scene(narration))).toBe(true);
  });
  it("سكون مقصود: البسملة كلها مستثناة من مقياس الحركة", () => {
    const plan = { chapters: [{ number: 1, title: "", scenes: [scene(narration)] }] } as unknown as Plan;
    const spans = intendedStillness(plan, 0).filter((s) => s.why === "بسملة");
    expect(spans).toHaveLength(1); // owner-pin-ok: بيانات مصطنعة في الاختبار
    expect(spans[0]!.to - spans[0]!.from).toBeGreaterThan(1);
  });
});

describe("السجل: يُعاد فتح المشهد الذي تغيّر عرضه وحده", () => {
  it("لا يتغير شيء في مشاهد الحلقات 001 للقنوات الثلاث (الآيات قصيرة، والبسملة في لقطتها)", async () => {
    const { quranOnScreenSignature } = await import("../src/quran/onScreen");
    const { readPlanFile } = await import("../src/plan/io");
    for (const dir of [SCRIPTS.balislam!, SCRIPTS["zubdat-alkutub"]!, "channels/dafatir-alzaman/episodes/001-adam-beginning"]) {
      const plan = (await readPlanFile(path.join(root, dir, "script.md")))!;
      for (const s of plan.chapters.flatMap((c) => c.scenes)) expect([s.id, quranOnScreenSignature(s, loadChannel(dir.split("/")[1]!).verse?.style)]).toEqual([s.id, null]);
    }
  });
  it("مشهد راوٍ فيه البسملة، وآية طويلة صارت صفحات: بصمة جديدة تعيده للمراجعة", async () => {
    const { quranOnScreenSignature } = await import("../src/quran/onScreen");
    expect(quranOnScreenSignature({ template: "kinetic-text", narration: "بسم الله الرحمن الرحيم. نبدأ.", props: {} })).toBe("basmala-overlay-v1"); // owner-pin-ok: بيانات مصطنعة في الاختبار
    expect(quranOnScreenSignature({ template: "verse-card", narration: "", props: { text: longText } })).toBe("verse-pages-v1"); // owner-pin-ok: بيانات مصطنعة في الاختبار
    expect(quranOnScreenSignature({ template: "verse-card", narration: "", props: { text: aVerse.text } })).toBeNull();
  });
});
