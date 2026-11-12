/**
 * قواعد القنوات ومحتواها وعزلها (١٢ نوفمبر، D100): الآية الصامتة في زبدة الكتب (D68) في الواجهة والرندر،
 * واللقطات المصمَّمة على نص سابق (D-5 وM4)، والنص المجاور من الخطة الحالية (M11)، وتسرّب محتوى قناة إلى أخرى،
 * وصياغة السرد الواحد (D87)، وقالب الحلقة الجديدة، وفاصل «·»، ولون السلسلة الافتراضي.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChannelProvider } from "../src/channel/context";
import { channelInfo } from "../src/channel/types";
import { loadChannel } from "../src/channel";
import { recitationStageNeeded, verseRoleAr, versesAreCitations } from "../src/quran/citation";
import { BoardViewer, type BoardShot } from "../app/src/tabs/BoardViewer";
import { PreFinalPanel } from "../app/src/workspace/PreFinal";
import { shotGaps } from "../src/render/shotsPreview";
import type { Plan, PlanScene } from "../src/plan/types";
import { horizonShotWordIssue, shotWordIssues } from "../src/plan/shotWords";
import { planIssues } from "../src/plan/validate";
import { InkSpokenContext, Write } from "../src/remotion/zubdat/inkKit";
import { HZ_SCENES } from "../src/remotion/dafatir/horizon/episode001";
import { buildTimeline, isMissingWord } from "../src/remotion/dafatir/horizon/timeline";
import { HZ_LEAD, hzSentences } from "../src/remotion/dafatir/horizon/meta";
import { ShotGuard } from "../src/remotion/scenes/HorizonShot";
import { partNeighbourText } from "../src/voice/generate";
import { channelSamples, sampleForChannel } from "../src/remotion/scenes/channelSamples";
import { sceneCatalog } from "../src/remotion/scenes/catalog";
import { channelLibrary, type LibraryRules } from "../src/channel/library";
import { channelPlaceholders } from "../src/channel/placeholders";
import { parseScript } from "../src/script/parse";
import { checkForChannel } from "../src/script/checkChannel";
import { runWithChannel } from "../src/channel";
import { inkVerseReference } from "../src/remotion/scenes/VerseCard";
import { verseRef } from "../app/src/ui/format";
import { deriveSeriesIdentity } from "../src/channel/series";

const root = path.join(__dirname, "..");
const src = (f: string) => readFileSync(path.join(root, f), "utf8");
const json = (f: string) => JSON.parse(src(f));
const info = (id: string) => channelInfo(loadChannel(id));
const within = (id: string, node: React.ReactNode) => renderToStaticMarkup(<ChannelProvider channel={info(id)}>{node}</ChannelProvider>);
const text = (html: string) => html.replace(/<[^>]*>/g, " ");
const noop = () => {};
const ZUBDAT_PLAN = "channels/zubdat-alkutub/episodes/001-awwal-marra-osalli/plan.json";
const DAFATIR_PLAN = "channels/dafatir-alzaman/episodes/001-adam-beginning/plan.json";
const scenesOf = (p: Plan) => p.chapters.flatMap((c) => c.scenes);

describe("D68: الآية في زبدة الكتب استشهاد مكتوب صامت، والقناتان الأخريان على التلاوة البشرية", () => {
  const verse: PlanScene = { id: "c1-s2", template: "verse-card", narration: "", line: 5, ayahKey: "20:14", props: { text: "نص", reference: "طه · ١٤" }, sfx: [] };
  it("مرحلة «التلاوات» تُحكم من حقل القناة: لا تلاوات في زبدة الكتب إلا البسملة", () => {
    expect(versesAreCitations(loadChannel("zubdat-alkutub"))).toBe(true);
    expect(recitationStageNeeded(loadChannel("zubdat-alkutub"), [verse], false)).toBe(false);
    expect(recitationStageNeeded(loadChannel("zubdat-alkutub"), [verse], true)).toBe(true);
    for (const ch of ["balislam", "dafatir-alzaman"]) expect(recitationStageNeeded(loadChannel(ch), [verse], false)).toBe(true);
    // الحقل لا المعرّف: أي قناة تختار الاستشهاد تأخذه
    expect(recitationStageNeeded({ verse: { recitation: "none" } } as never, [verse], false)).toBe(false);
  });
  it("لوح الآية في الخطوة ١: «استشهاد صامت» في زبدة الكتب، لا «تُتلى بصوت القارئ» في أي قناة", () => {
    const shots: BoardShot[] = [{ s: verse, chapter: { number: 1, title: "" }, from: 0, d: 150 }];
    const board = (ch: string) => text(within(ch, <BoardViewer shots={shots} index={0} order={["c1-s2"]} fps={30} citations={[]} lineEnd={() => 1e9}
      onIndex={noop} onClose={noop} onEdit={noop} frame={() => <div />} onScreen={() => ""} elements={() => []} />));
    expect(board("zubdat-alkutub")).toContain("استشهاد بنصها ومرجعها، بلا تلاوة");
    expect(board("balislam")).toContain("تسجيل بشري ترفعه بنفسك");
    for (const ch of ["balislam", "dafatir-alzaman", "zubdat-alkutub"]) expect(board(ch)).not.toContain("تُتلى بصوت القارئ");
    expect(verseRoleAr(loadChannel("dafatir-alzaman"))).toContain("تسجيل بشري");
  });
  it("المعاينة قبل النهائية في الخطوة ٣: لا «التلاوة تُضاف لاحقًا» في زبدة الكتب، وتبقى في بالإسلام", () => {
    const pre = (ch: string) => text(within(ch, <PreFinalPanel episodeId="001" channelId={ch} order={["c1-s1"]} />));
    expect(pre("zubdat-alkutub")).not.toContain("التلاوة تُضاف لاحقًا");
    expect(pre("zubdat-alkutub")).toContain("استشهاد مكتوب");
    expect(pre("balislam")).toContain("التلاوة تُضاف لاحقًا");
  });
  it("الرندر: لا تطلب بطاقة الآية تلاوة في زبدة الكتب، ولا تُعلَّم «التلاوة تُضاف لاحقًا»؛ والبوابة كما هي في غيرها", () => {
    const plan = { chapters: [{ number: 1, title: "", scenes: [verse] }] } as unknown as Plan;
    const media = { mode: "url", base: "", voice: {}, sfx: [], recitations: {} } as never;
    const gaps = (ch: string) => shotGaps(plan, media, ["c1-s2"], path.join(root, `channels/${ch}/episodes/001-x/script.md`), true).map((g) => g.what);
    expect(gaps("zubdat-alkutub").join(" ")).not.toMatch(/التلاوة/);
    expect(gaps("balislam").join(" ")).toMatch(/التلاوة البشرية/);
    expect(gaps("dafatir-alzaman").join(" ")).toMatch(/التلاوة البشرية/);
    const preview = src("src/render/shotsPreview.ts");
    expect(preview).toMatch(/s\.template === "verse-card" && !cited/);
  });
  it("«الجمل» والخادم وإعدادات القناة: لا رفع تلاوة لآية في قناة الاستشهاد، والبسملة تبقى", () => {
    const panel = src("app/src/workspace/SentencesPanel.tsx");
    expect(panel).toMatch(/cited \? \(\s*<p className="sp-hint sv-citation"/);
    const api = src("app/server/api.ts");
    expect(api).toMatch(/if \(key !== "basmala"\) \{[\s\S]{0,400}versesAreCitations\(loadChannel\(\)\)\) return send\(res, 409/);
    const settings = src("app/src/tabs/ChannelTab.tsx");
    expect(settings).toContain("الآية في هذه القناة استشهاد مكتوب صامت");
    expect(src("app/src/App.tsx")).toContain('label: recStage ? "التلاوات" : "قبل النهائية"');
  });
  it("قالب الحلقة الجديدة في زبدة الكتب بلا قارئ ولا تلاوة", () => {
    const t = src("templates/zubdat-alkutub/script.md");
    expect(t).not.toMatch(/القارئ|تلاوة بشرية|تُتلى/);
    expect(t).toContain("استشهاد مكتوب صامت");
  });
});

describe("D-5 وM4: اللقطة المصمَّمة على نص سابق لا تنهار ولا ترسم الخطأ، وفحص الخطة يقولها صراحةً", () => {
  it("زبدة الكتب 001: اللقطات المضبوطة على السكريبت المعتمد (D98) بلا فرق؛ وتعديل نص يُكشف بكلمته", () => {
    const plan = json(ZUBDAT_PLAN) as Plan;
    expect(shotWordIssues(plan, "زبدة الكتب")).toEqual([]);
    // تعديل نص المشهد ٢ بعد تصميم لقطته: «نعمة» صُمم عليها حدث فلا بد أن يُكشف
    const s2 = scenesOf(plan).find((x) => x.id === "c1-s2")!;
    expect(s2.narration).toContain("نِعْمَةٌ");
    const edited = { ...plan, chapters: plan.chapters.map((c) => ({ ...c, scenes: c.scenes.map((x) => (x.id === "c1-s2" ? { ...x, narration: x.narration.replace("نِعْمَةٌ", "عَطَاءٌ") } : x)) })) } as Plan;
    const found = shotWordIssues(edited, "زبدة الكتب");
    expect(found.map((i) => i.sceneId)).toEqual(["c1-s2"]);
    expect([...found[0]!.missing, ...found[0]!.unspoken].join(" ")).toMatch(/نعمة/);
    const warn = planIssues(edited, info("zubdat-alkutub")).filter((i) => i.sceneId === "c1-s2" && /رسم اللقطة المصمَّمة/.test(i.message));
    expect(warn).toHaveLength(1);
    expect(warn[0]!.level).toBe("warning");
  });
  it("«قبل أن تعتمد» يعدّ الرسوم التي لا تطابق الكلام، لا «بلا أخطاء» وحدها", () => {
    expect(src("app/src/shell/EpisodeSpine.tsx")).toMatch(/shotMismatch\.length \? \(\s*<li className="is-warn">[\s\S]{0,80}الرسوم/);
    expect(src("app/src/App.tsx")).toContain("shotMismatch={shotMismatch}");
  });
  it("وقت العرض: لا تُكتب عبارة لا تُنطق، والمشهد بكلمة لم تعد فيه يُعرض بالكلمات وحدها", () => {
    const w = <svg><Write id="t" x={0} y={0} text="عيبا" size={60} p={1} c="#111" /></svg>;
    expect(renderToStaticMarkup(w)).toContain("عيبا");
    expect(renderToStaticMarkup(<InkSpokenContext.Provider value={() => false}>{w}</InkSpokenContext.Provider>)).not.toContain("عيبا");
    const ink = src("src/remotion/scenes/InkShot.tsx");
    expect(ink).toMatch(/const shot = def && !wordsOnly \?/);
    expect(ink).toContain("<InkWordsOnly");
  });
  it("دفاتر الزمن (M4): «قديمة» ← «عتيقة» في المشهد ٤ لا تُسقط اللقطة: خطأ معروف، وحارس، وتنبيه", () => {
    const plan = json(DAFATIR_PLAN) as Plan;
    expect(shotWordIssues(plan)).toEqual([]);
    const s = scenesOf(plan).find((x) => x.id === "c1-s3")!;
    const edited = { ...s, narration: s.narration.replace("قديمة", "عتيقة") };
    expect(horizonShotWordIssue(edited)?.missing).toEqual(["قديمة"]);
    const tl = buildTimeline(hzSentences(edited.narration), HZ_LEAD);
    let err: unknown;
    try { (HZ_SCENES.return as unknown as (p: unknown) => unknown)({ t: 1, tl, dur: tl.end + 2, exit: "turn", p: edited.props }); } catch (e) { err = e; }
    expect(isMissingWord(err)).toBe(true);
    // الحارس: أي خطأ في رسم اللقطة يعرض البديل (الكلمات وحدها)، لا شاشة سوداء
    const guard = new ShotGuard({ fallback: <i>words-only</i>, resetKey: "a", children: <b>shot</b> });
    expect(guard.render()).toEqual(<b>shot</b>);
    guard.state = ShotGuard.getDerivedStateFromError();
    expect(renderToStaticMarkup(<>{guard.render()}</>)).toBe("<i>words-only</i>");
    expect(src("src/remotion/scenes/HorizonShot.tsx")).toMatch(/\{stale \? <HorizonWordsOnly[\s\S]{0,200}<ShotGuard resetKey=[\s\S]{0,200}fallback=\{<HorizonWordsOnly/);
    const warn = planIssues({ ...plan, chapters: plan.chapters.map((c) => ({ ...c, scenes: c.scenes.map((x) => (x.id === "c1-s3" ? edited : x)) })) }, info("dafatir-alzaman"))
      .filter((i) => i.sceneId === "c1-s3" && /رسم اللقطة/.test(i.message));
    expect(warn[0]?.message).toContain("«قديمة»");
  });
});

describe("M11: النص المجاور للتوليد من الخطة الحالية لا من خريطة النبرة القديمة", () => {
  const plan = { chapters: [{ number: 1, title: "", scenes: [
    { id: "a", template: "x", narration: "لا تبدأ من مدينة عتيقة.", props: {}, sfx: [], line: 1 },
    { id: "b", template: "x", narration: "بل تبدأ من آدم.", props: {}, sfx: [], line: 2 },
  ] }] } as unknown as Plan;
  it("المشهد المجاور تغيّر نصه بعد الخريطة: يُرسل نصه الحالي من الخطة", () => {
    expect(partNeighbourText({ scene: "a", text: "لَا تَبْدَأُ مِنْ مَدِينَةٍ قَدِيمَةٍ." }, { scene: "b" }, plan)).toBe("لا تبدأ من مدينة عتيقة.");
  });
  it("المجاور لم يتغير: نص الخريطة المشكول كما هو؛ وداخل المشهد نفسه: نص الجزء", () => {
    expect(partNeighbourText({ scene: "b", text: "بَلْ تَبْدَأُ مِنْ آدَمَ." }, { scene: "a" }, plan)).toBe("بَلْ تَبْدَأُ مِنْ آدَمَ.");
    expect(partNeighbourText({ scene: "a", text: "قَدِيمَةٍ" }, { scene: "a" }, plan)).toBe("قَدِيمَةٍ");
    expect(partNeighbourText(undefined, { scene: "a" }, plan)).toBeUndefined();
  });
});

describe("عزل القنوات: لا يرى صاحب قناة محتوى قناة أخرى", () => {
  const ch = (id: string): LibraryRules => json(`channels/${id}/channel.json`);
  const BALISLAM = /بعين الإسلام|نؤجّل|نؤجل|التأجيل|procrastination|ليالي رمضان|ramadan/i;
  it("كل قالب في مكتبة دفاتر الزمن وزبدة الكتب له نموذج بمحتواها (لا نموذج «بالإسلام» العام)", () => {
    for (const id of ["dafatir-alzaman", "zubdat-alkutub"]) {
      const lib = channelLibrary(ch(id));
      for (const tpl of lib.templates) {
        const base = sceneCatalog.find((e) => e.id === tpl)!.sample;
        const merged = sampleForChannel(id, tpl, base);
        // ما لا نموذج له هنا نموذجه العام من محتوى القناة نفسها (مشاهد الحبر لزبدة الكتب، وخط الأفق لدفاتر الزمن)
        if (!channelSamples[id]?.[tpl]) expect(["ink-shot", "ink-meaning", "horizon-shot", "map-journey", "doc-plate", "noor-text"], `${id}/${tpl}`).toContain(tpl);
        expect(JSON.stringify(merged), `${id}/${tpl}`).not.toMatch(BALISLAM);
      }
    }
  });
  it("لا «الفصل N ·» في أي نموذج (D87)، ولا في رأس صفحة خط الأفق", () => {
    for (const f of ["samples.ts", "BigNumber.tsx", "Comparison.tsx", "KineticText.tsx", "Timeline.tsx", "HadithCard.tsx", "ChartScene.tsx", "InkMeaning.tsx", "BoardStory.tsx", "MotionStory.tsx", "HorizonShot.tsx"])
      expect(src(`src/remotion/scenes/${f}`), f).not.toMatch(/eyebrow: "(الفصل \d+ ·|Chapter \d+ ·)|head: "الفصل/);
  });
  it("معاينة الهوية تأخذ نماذج القناة نفسها، وأسماء ألوان الشعار من شعارها", () => {
    expect(src("src/remotion/scenes/TemplateReel.tsx")).toContain("sampleForChannel(channel.id, id, base)");
    // دفاتر الزمن بلا «حوار شخصية» في مكتبتها: القائمة مكانه في المعاينة، لا «من أين يأتي التأجيل؟»
    expect(src("src/remotion/scenes/TemplateReel.tsx")).toMatch(/const talk = !channelSamples\[/);
    const id = src("app/src/tabs/IdentityTab.tsx");
    expect(id).toContain('channel.logo.emblem !== "mihrab" ? "لون الشعار الأساسي" : "حرف الباء"');
    expect(id).not.toContain("الطاقية والخمار");
    expect(id).not.toContain("عنوان الفصل الصغير");
  });
  it("أمثلة «حلقة جديدة» و«سلسلة جديدة» لكل قناة من محتواها", () => {
    for (const id of ["dafatir-alzaman", "zubdat-alkutub", "new-channel"]) expect(JSON.stringify(channelPlaceholders(id)), id).not.toMatch(BALISLAM);
    expect(channelPlaceholders("balislam").seriesName).toBe("ليالي رمضان");
    for (const f of ["app/src/App.tsx", "app/src/tabs/Series.tsx"]) expect(src(f), f).not.toMatch(/placeholder="(لماذا نؤجّل|procrastination|ليالي رمضان|الأسرة|ramadan-nights)/);
  });
});

describe("D87: صياغة السرد الواحد في قالب السلسلة والهوية والمحرر", () => {
  it("لا «بنية الفصول» ولا «طول الفصل» ولا «عدد الفصول» ولا «رقم الفصل»", () => {
    const all = ["app/src/tabs/Series.tsx", "app/src/tabs/IdentityTab.tsx", "app/src/ui/Overlays.tsx", "src/plan/templates.ts", "brand/identity/index.tsx"].map(src).join("\n");
    for (const w of ["بنية الفصول", "طول الفصل", "عدد الفصول", "رقم الفصل", "بعناوين فصول", "عنوان الفصل في الأعلى", "divisionTitlesOnScreen، D82"]) expect(all, w).not.toContain(w);
  });
});

describe("قالب الحلقة الجديدة لا يبدأ بخطأ يمنع", () => {
  for (const id of ["balislam", "dafatir-alzaman", "zubdat-alkutub"]) {
    it(id, () => {
      runWithChannel(id, () => {
        const domain = Object.keys(loadChannel(id).domains)[0]!;
        const t = src(`templates/${id}/script.md`).replaceAll("{{TITLE}}", "عنوان؟").replace("{{DOMAIN}}", domain).replace("{{EPISODE}}", "099");
        const r = checkForChannel(parseScript(t, path.join(root, `channels/${id}/episodes/099-x/script.md`)));
        expect(r.issues.filter((i) => i.level === "error").map((i) => i.message)).toEqual([]);
        expect(t).not.toMatch(/السورة رقم|القارئ:/);
      });
    });
  }
});

describe("«·» بجوار الأرقام العربية يُقرأ «٠» (D61)", () => {
  it("بطاقة الآية في زبدة الكتب والمرجع في الواجهة بلا «·»", () => {
    expect(inkVerseReference("طه · ١٤")).toBe("طه، الآية ١٤");
    expect(inkVerseReference("المؤمنون · ١–٢")).toBe("المؤمنون، الآيتان ١–٢");
    expect(verseRef("طه · ١٤")).toBe("طه ١٤");
  });
});

describe("لون السلسلة الافتراضي مشتق من الهوية، والبرتقالي للشطب والتنبيه", () => {
  it("زبدة الكتب: لا #FF6B4A افتراضيًا (يبقى اختيارًا صريحًا)، والقناتان الأخريان كما كانتا", () => {
    const z = deriveSeriesIdentity("zubdat-alkutub");
    expect(z.accent).not.toBe("#FF6B4A");
    expect(z.accent).not.toBe("#E8F542");
    expect(["#111111", "#FFFFFF"]).toContain(z.accent);
    expect(deriveSeriesIdentity("zubdat-alkutub", { accent: { base: "#FF6B4A" } }).accent).toBe("#FF6B4A");
    expect(deriveSeriesIdentity("balislam").accent).toBe("#F2B35B");
    expect(deriveSeriesIdentity("dafatir-alzaman").accent).toBe("#E07A3F");
  });
});
