import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkShortIdea, ideaSentencesOf, isCommentCta, outwardHits, type IdeaSentence } from "../src/package/shortIdea";
import { assertShortRenderIdea, assertShortsIdea, checkPlanShorts } from "../src/package/shortIdeaPlan";
import { resolveDraftCut, scriptIdeaSentences } from "../src/package/shortIdeaDraft";
import { checkShortsInput, segmentPlan, shortSegments } from "../src/plan/shorts";
import { parseScript } from "../src/script/parse";
import type { Plan } from "../src/plan/types";

// D241 (قاعدة ثابتة للقنوات الثلاث، ٢٧ نوفمبر): الشورت فكرة كاملة وحده.
const root = path.join(__dirname, "..");
const n = (text: string): IdeaSentence => ({ text, kind: "narration" });
const v = (text: string): IdeaSentence => ({ text, kind: "verse" });
const rules = (r: ReturnType<typeof checkShortIdea>) => r.issues.map((i) => i.rule);

describe("D241: الحدود بالجملة", () => {
  const ep = [
    n("كيف بدأت القصة؟"), n("بدأت في بيت صغير."), n("وكما جاء في سورة المائدة:"), v("﴿وَاتْلُ عَلَيْهِمْ﴾"),
    n("فهذا خبر ثابت."), n("ومنذ ذلك اليوم،"), n("صار الدرس واضحًا."), n("هل تعلّمت منه شيئًا؟"),
  ];
  it("شورت يبدأ بسؤال وينتهي بخلاصة تامة يمر", () => {
    expect(checkShortIdea(ep, { parts: [[0, 1]] })).toMatchObject({ ok: true, issues: [] });
  });
  it("ينتهي بنقطتين قبل آية خارجه: منتصف الكلام", () => {
    expect(rules(checkShortIdea(ep, { parts: [[0, 2]] }))).toContain("end");
  });
  it("يبدأ بعد جملة لم تتم (نقطتان أو فاصلة): منتصف الكلام", () => {
    expect(rules(checkShortIdea(ep, { parts: [[3, 4]], hook: true }))).toContain("start");
    expect(rules(checkShortIdea(ep, { parts: [[6, 6]], hook: true }))).toContain("start");
  });
  it("ينتهي بفاصلة: منتصف الكلام", () => {
    expect(rules(checkShortIdea(ep, { parts: [[0, 5]] }))).toContain("end");
  });
  it("الآية داخل الشورت مع تمهيدها تمر، وآية وحدها بلا سرد بلا فكرة", () => {
    expect(rules(checkShortIdea(ep, { parts: [[0, 4]] }))).not.toContain("end");
    expect(rules(checkShortIdea([v("﴿أ﴾")], { parts: [[0, 0]], hook: true }))).toContain("empty");
  });
});

describe("D241: الختام والخطاف", () => {
  const ep = [n("لماذا نخاف من الجديد؟"), n("لأن العقل يحب ما يعرفه."), n("فهل جرّبت مرة أن تبدأ صغيرًا؟"), n("اكتب لنا في التعليقات: ما أول خطوة جرّبتها؟")];
  it("ينتهي بسؤال بلا جواب: مرفوض", () => {
    expect(rules(checkShortIdea(ep, { parts: [[0, 2]] }))).toContain("question");
  });
  it("سؤال التعليقات المقصود يمر بنمطه أو بالعلامة الصريحة", () => {
    expect(checkShortIdea(ep, { parts: [[0, 3]] }).ok).toBe(true);
    expect(checkShortIdea(ep, { parts: [[0, 2]], commentClose: true }).ok).toBe(true);
    expect(isCommentCta("أخبرنا في التعليقات: ماذا فعلت؟")).toBe(true);
    expect(isCommentCta("شاركنا رأيك؟")).toBe(true);
    expect(isCommentCta("فماذا بقي لنا من هذه القصة؟")).toBe(false);
  });
  it("الخطاف: سؤال، أو جملة علّمها المحرر خطافًا", () => {
    const e2 = [n("قربانان ونتيجتان."), n("قُبل أحدهما ورُدّ الآخر.")];
    expect(rules(checkShortIdea(e2, { parts: [[0, 1]] }))).toEqual(["hook"]);
    expect(checkShortIdea(e2, { parts: [[0, 1]], hook: true }).ok).toBe(true);
  });
});

describe("D241: الإشارة إلى خارج الشورت (قائمة مراجَعة بعد التطبيع)", () => {
  const hit = (t: string, first = false) => outwardHits(n(t), first).map((h) => h.label);
  it("ذكر الحلقة وما قيل فيها يُرفض في أي موضع", () => {
    expect(hit("وكما قلنا، الصبر مفتاح.")).toContain("كما قلنا");
    expect(hit("في الحلقة الماضية رأينا الطوفان.")).toContain("الحلقة");
    expect(hit("وقد عرفنا في حلقة الأجيال الأولى قاعدة النبي.")).toContain("حلقة");
    expect(hit("وتركنا معها سؤالًا:")).toContain("تركنا معها");
    expect(hit("وخبر عطاء سنعود إليه بعد قليل.")).toEqual(expect.arrayContaining(["سنعود", "بعد قليل"]));
  });
  it("التطبيع: التشكيل والمحارف الخفية وأشكال الألف لا تخفي الإشارة", () => {
    expect(hit("فِي الْحَلْقَةِ الْمَاضِيَةِ وَقَفْنَا عِنْدَ الْفَاتِحَةِ.")).toContain("الحلقة");
    expect(hit("في الحل​قة الماضية.")).toContain("الحلقة");
    expect(hit("كما أشرنا من قبل.")).toContain("كما اشرنا");
  });
  it("الإشارة والإحالة والوصل في أول جملة من الجزء وحدها", () => {
    expect(hit("وهذا ما نعرفه.", true)).toContain("إشارة «هذا»");
    expect(hit("وهذا ما نعرفه.", false)).toEqual([]);
    expect(hit("ثم عاش بعدهما الناس زمنًا.", true)).toEqual(expect.arrayContaining(["وصل «ثم»", "إحالة «بعدهما»"]));
    expect(hit("فكيف نتعامل مع هذه الروايات؟", true)).toContain("إشارة «هذه»");
    expect(hit("والثالث: السوق.", true)).toContain("وصل «والثالث»");
    expect(hit("أي صرفتهم عن دينهم.", true)).toContain("تفسير «أي»");
    expect(hit("أيّ الكتابتين أقدم؟", true)).toEqual([]);
  });
  it("لا إنذار كاذب على جمل من سكريبتات القنوات الثلاث راجعناها", () => {
    for (const t of [
      "وبعد قليل، رأى الشاب القطة تعبث بأوراق الدفتر عند النافذة.", // بالإسلام 001: سرد لا إحالة
      "فالاعتراف بالحق قد يفرض علينا أن نتراجع عن كلام قلناه، وأن نرد حقًّا أخذناه.", // بالإسلام 001
      "ثم إذا عجزنا عنها في الأسبوع الأول، تركنا كل شيء.", // بالإسلام 010 (في غير أول الجزء)
      "وبين السور الأعظم والساحة الوسطى حلقةٌ من البيوت والطرق، يسكنها أهل الخليفة وقادته ورجال دولته.", // دفاتر الزمن 100
      "وإلى جوار القصر قام المسجد الجامع، فكان الحكم والصلاة في مركز واحد، والناس من حولهما في حلقات.", // دفاتر الزمن 100
      "لكن هل توقفنا مرة بعد آية منها، نتذكّر الجواب؟", // زبدة الكتب 002
    ]) expect(hit(t), t).toEqual([]);
    // بعد الفاصلة: الإشارة القائمة بنفسها تحيل إلى ما قبلها في الجملة نفسها
    expect(hit("وفي سنة مئة وست وأربعين انتقل المنصور إلى مدينته، واستمر العمل في أسوارها بعد ذلك سنوات.", true)).toEqual([]);
    expect(hit("قبل الكتابة، وجد علماء الآثار في تلك البلاد قطعًا صغيرة.", true)).toContain("إشارة «تلك»");
  });
  it("نص الآية والحديث والاقتباس لا يُفحص", () => {
    expect(outwardHits(v("﴿قُلْنَا يَا نَارُ كُونِي بَرْدًا﴾"), true)).toEqual([]);
    expect(hit("قال: «هذا ما قلناه لكم».", false)).toEqual([]);
  });
  it("كل ما تعلّمه القائمة في أي موضع من سكريبتات القنوات الثلاث إشارة حقيقية إلى الحلقة أو السلسلة", () => {
    // D58: القائمة مفحوصة على كل السكريبتات؛ كل إصابة فيها كلمة من مفردات الحلقة/السلسلة أو ما قيل فيها
    const REAL = /حلق|الجزء|سنعود|سنرى|سنعرف|سنتحدث|بعد قليل|ذكرنا|تحدثنا|شرحنا|عقدنا|تركنا|وقفنا|توقفنا|رأينا|مررنا|عرفنا|أشرنا|اشرنا|كما/;
    let seen = 0;
    for (const ch of ["balislam", "dafatir-alzaman", "zubdat-alkutub"]) {
      const eps = path.join(root, "channels", ch, "episodes");
      for (const e of readdirSync(eps)) {
        const f = path.join(eps, e, "script.md");
        if (!existsSync(f)) continue;
        for (const s of scriptIdeaSentences(parseScript(readFileSync(f, "utf8"), f)))
          for (const h of outwardHits(s, false)) { seen++; expect(`${h.label}|${h.word}`, `${ch}/${e}: ${s.text}`).toMatch(REAL); }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe("D241: أجزاء غير متتالية من الحلقة نفسها", () => {
  const ep = [n("ما الذي يجعل المكان مدينة؟"), n("سور يحميها."), n("ثم جاء زمن طويل."), n("وقناة تسقي حقولها."), n("وسوق يجمع الناس."), n("فتلك هي المدينة الأولى:")];
  it("أجزاء تامة بالترتيب تمر، وبداية جزء بعد جملة لم تتم تُرفض", () => {
    expect(checkShortIdea(ep, { parts: [[0, 1], [3, 4]] }).ok).toBe(true);
    expect(rules(checkShortIdea(ep, { parts: [[0, 1], [2, 2]] }))).toContain("outward"); // «ثم» أول الجزء
    expect(rules(checkShortIdea(ep, { parts: [[0, 1], [3, 5]] }))).toContain("end");
    expect(rules(checkShortIdea(ep, { parts: [[0, 1], [1, 1]] }))).toContain("empty"); // جملة مكررة
  });
});

const plan = (): Plan => ({
  version: 1, episode: "009", title: "ت", domain: "history" as Plan["domain"], themeId: "night" as Plan["themeId"], updatedAt: "",
  chapters: [{ number: 1, title: "", scenes: [
    { id: "c1-s1", template: "kinetic-text", narration: "ما الذي يجعل المكان مدينة؟ سور يحميها.", line: 1, props: {}, sfx: [] },
    { id: "c1-s2", template: "kinetic-text", narration: "وكما قلنا في الحلقة الماضية، كانت قرية.", line: 2, props: {}, sfx: [] },
    { id: "c1-s3", template: "kinetic-text", narration: "وقناة تسقي حقولها.", line: 3, props: {}, sfx: [] },
    { id: "c1-s4", template: "kinetic-text", narration: "وكما جاء في القرآن:", line: 4, props: {}, sfx: [] },
    { id: "c1-s5", template: "verse-card", narration: "", line: 5, props: { reference: "هود 61" }, sfx: [] },
    { id: "c1-end", template: "end-screen", narration: "", line: 6, props: {}, sfx: [] },
  ] }],
});

describe("D241: الخطة — الصيغة القديمة باقية، والأجزاء جديدة", () => {
  it("segments: مشاهد الأجزاء موصولة بترتيبها، وsegmentPlan يوصلها كما هي بلا مشهد جديد", () => {
    const p = { ...plan(), shorts: [{ from: "c1-s1", to: "c1-s3", segments: [{ from: "c1-s1", to: "c1-s1" }, { from: "c1-s3", to: "c1-s3" }], title: "ما المدينة؟" }] };
    const seg = shortSegments(p).segments[0]!;
    expect(seg.sceneIds).toEqual(["c1-s1", "c1-s3"]);
    expect(seg.parts).toEqual([["c1-s1"], ["c1-s3"]]);
    expect(segmentPlan(p, seg).plan.chapters[0]!.scenes.map((s) => s.id)).toEqual(["c1-s1", "c1-s3"]);
    expect(checkPlanShorts(p)[0]!.result.ok).toBe(true);
  });
  it("from/to القديمة تعمل كما كانت، والبوابة ترفض ما يشير إلى الحلقة", () => {
    const p = { ...plan(), shorts: [{ from: "c1-s1", to: "c1-s3" }] };
    expect(shortSegments(p).segments[0]!.sceneIds).toEqual(["c1-s1", "c1-s2", "c1-s3"]);
    const r = checkPlanShorts(p)[0]!.result;
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.rule)).toContain("outward");
    expect(() => assertShortsIdea(p, shortSegments(p).segments)).toThrow(/D241/);
  });
  it("ينتهي بتمهيد آية خارج الشورت: مرفوض؛ ومع بطاقة الآية يمر", () => {
    const end = { ...plan(), shorts: [{ from: "c1-s3", to: "c1-s4", hook: "line" as const }] };
    expect(checkPlanShorts(end)[0]!.result.issues.map((i) => i.rule)).toContain("end");
    const withVerse = { ...plan(), shorts: [{ from: "c1-s3", to: "c1-s5", hook: "line" as const }] };
    expect(checkPlanShorts(withVerse)[0]!.result.ok).toBe(true);
  });
  it("قلب الرندر يجد الشورت بمشاهده ويفحصه بعلاماته", () => {
    const p = { ...plan(), shorts: [{ from: "c1-s3", to: "c1-s5", hook: "line" as const }] };
    expect(() => assertShortRenderIdea(p, { sceneIds: ["c1-s3", "c1-s4", "c1-s5"] })).not.toThrow();
    // المقطع نفسه بلا علامة الخطاف (ليس في الخطة): يُرفض
    expect(() => assertShortRenderIdea({ ...p, shorts: [] }, { sceneIds: ["c1-s3", "c1-s4", "c1-s5"] })).toThrow(/خطاف/);
  });
  it("حفظ الاستوديو يقبل الأجزاء والعلامتين ويرفض الأجزاء المتداخلة، والصيغة القديمة كما هي", () => {
    const ok = checkShortsInput(plan(), [{ from: "c1-s1", to: "c1-s1", segments: [{ from: "c1-s1", to: "c1-s1" }, { from: "c1-s3", to: "c1-s3" }], hook: "line", closingQuestion: "comment" }]);
    expect(ok.errors).toEqual([]);
    expect(ok.shorts[0]).toEqual({ from: "c1-s1", to: "c1-s3", segments: [{ from: "c1-s1", to: "c1-s1" }, { from: "c1-s3", to: "c1-s3" }], hook: "line", closingQuestion: "comment" });
    expect(checkShortsInput(plan(), [{ from: "c1-s1", to: "c1-s3", segments: [{ from: "c1-s1", to: "c1-s2" }, { from: "c1-s2", to: "c1-s3" }] }]).errors.join(" ")).toContain("يتداخل");
    expect(checkShortsInput(plan(), [{ from: "c1-s1", to: "c1-s2", hook: "yes" }]).errors.join(" ")).toContain("الخطاف");
    expect(checkShortsInput(plan(), [{ from: "c1-s1", to: "c1-s2", title: "س؟" }]).shorts).toEqual([{ from: "c1-s1", to: "c1-s2", title: "س؟" }]);
  });
});

describe("D241: قراءة قص المسودات (publish.draft.json) على جمل السكريبت", () => {
  const script = `---\ntitle: "ت"\ndomain: history\nepisode: "002"\n---\n\nكيف دلّ الغراب ابن آدم؟ من هنا نبدأ.\n\nوكانوا كلما سمعوه سدّوا آذانهم، وغطّوا وجوههم حتى لا يروه. فلم يسمعوا.\n\nفلن نكتب رقمًا. المسافة بينهما مجهولة.\n\nوهذا ما نعرفه.\n`;
  const ss = scriptIdeaSentences(parseScript(script, "script.md"));
  it("«حتى» داخل الاقتباس ليست فاصلًا، والاقتباس المبتور يأخذ فقرته كلها", () => {
    expect(resolveDraftCut(ss, "«كيف دلّ الغراب ابن آدم؟» … «وكانوا كلما سمعوه سدّوا آذانهم، وغطّوا وجوههم حتى لا…»")).toEqual({ parts: [[0, 3]] });
  });
  it("«ثم» بين اقتباسين أجزاء غير متتالية؛ و«ثم» في وصف بلا اقتباس ليست فاصلًا", () => {
    expect(resolveDraftCut(ss, "«كيف دلّ الغراب ابن آدم؟» ثم «فلن نكتب رقمًا.» حتى «وهذا ما نعرفه»")).toEqual({ parts: [[0, 0], [4, 6]] });
    expect("error" in resolveDraftCut(ss, "قول ابن عباس ثم العقد العشر")).toBe(true);
  });
  it("مرجع وحده أو جملة لم تعد في السكريبت: لا حكم آلي، يُرد ليُحدَّد بجمله", () => {
    expect(resolveDraftCut(ss, "حديث البخاري 3445")).toMatchObject({ error: expect.stringContaining("غير محدد") });
    expect(resolveDraftCut(ss, "«جملة حذفها المحرر من النص» … «وهذا ما نعرفه»")).toMatchObject({ error: expect.stringContaining("ليست في السكريبت") });
  });
  it("الفقرة تُقسم جملًا بعلامات الوقف خارج الاقتباس", () => {
    expect(ideaSentencesOf("قال: «أين أنت؟ تعال.» ثم مضى. وانتهى")).toEqual(["قال:", "«أين أنت؟ تعال.»", "ثم مضى.", "وانتهى"]);
  });
});

describe("D241: البوابة في كل طريق إلى رندر شورت", () => {
  const src = (f: string) => readFileSync(path.join(root, f), "utf8");
  it("package --shorts يفحص قبل تجهيز الوسائط والرندر", () => {
    const s = src("src/package/package.ts");
    expect(s.indexOf("assertShortsIdea(plan, shorts)")).toBeGreaterThan(0);
    expect(s.indexOf("assertShortsIdea(plan, shorts)")).toBeLessThan(s.indexOf("prepareRenderMedia(ep, plan"));
  });
  it("worker-submit/worker-collect (الويندوز) يفحصان في سياق الماك قبل الوسائط", () => {
    const s = src("src/render/worker/macSide.ts");
    const body = s.slice(s.indexOf("export const macShortsContext"));
    expect(body.indexOf("assertShortsIdea(plan, pick.segments)")).toBeGreaterThan(0);
    expect(body.indexOf("assertShortsIdea(plan, pick.segments)")).toBeLessThan(body.indexOf("prepareRenderMedia"));
  });
  it("قلب الرندر (الماك والعامل) يفحص كل مقطع عمودي قبل إذن الماك والتجميع", () => {
    const s = src("src/render/episode.ts");
    const body = s.slice(s.indexOf("export const renderComposition"));
    expect(body.indexOf("assertShortRenderIdea")).toBeGreaterThan(0);
    expect(body.indexOf("assertShortRenderIdea")).toBeLessThan(body.indexOf("consumeMacRenderPermit"));
    expect(body.indexOf("assertShortRenderIdea")).toBeLessThan(body.indexOf("createIsolatedRenderBundle"));
  });
  it("npx bal shorts-check موجود", () => {
    expect(src("src/cli/index.ts")).toContain('.command("shorts-check")');
  });
});
