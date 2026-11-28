/**
 * D248: «بالإسلام» بشخصيات بضوابط دار الإفتاء المصرية، بوابة في الكود: فحص الخطة (خطأ مبكر)، ورندر التكوين،
 * ومهام جهاز الرندر. الضوابط الخمس، وقائمة من لا تجوز معه شخصية بلا إنذار كاذب على سكريبتات القنوات الثلاث.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertCharacterPolicy, CHARACTER_PALETTE, characterPolicyIssues, characterSpecIssues, parseCharacters, sacredMentions,
} from "../src/plan/characterPolicy";
import { planIssues } from "../src/plan/validate";
import type { Plan, PlanScene } from "../src/plan/types";

const repo = path.resolve(__dirname, "..");
const good = { slot: "c1", kind: "ordinary-person", age: "adult", face: "featureless", attire: "modest-men", bodyEmphasis: false, palette: ["cream", "calm-green"] };
const scene = (o: Partial<PlanScene> & { props?: Record<string, string> }): PlanScene =>
  ({ id: "c1-s1", template: "new-character-stage", narration: "خرج الرجل إلى السوق في الصباح.", line: 1, sfx: [], ...o, props: { ...(o.props ?? {}) } }) as PlanScene;
const plan = (scenes: PlanScene[], channel = "balislam", themeId: Plan["themeId"] = "warm"): Plan =>
  ({ version: 1, episode: "t", title: "t", domain: "d", themeId, channel, updatedAt: "", chapters: [{ number: 1, title: "", scenes }] }) as Plan;
const chars = (...specs: unknown[]) => JSON.stringify(specs);
const errors = (p: Plan) => characterPolicyIssues(p).filter((i) => i.level === "error").map((i) => i.message);

describe("D248 CharacterSpec", () => {
  it("accepts a declared featureless, ordinary, modestly dressed character in the day palette", () => {
    expect(characterSpecIssues(good, 0)).toEqual([]);
    expect(characterSpecIssues({ ...good, slot: "c2", age: "child", attire: "child-normal", palette: ["turquoise", "gold"] }, 1)).toEqual([]);
    expect(characterSpecIssues({ ...good, age: "elder", attire: "modest-women-loose" }, 0)).toEqual([]);
    expect(errors(plan([scene({ props: { characters: chars(good) } })]))).toEqual([]);
  });

  it("1: features are refused, and a drawn face hidden under light/glow/blur/shadow is refused", () => {
    expect(characterSpecIssues({ ...good, face: "drawn" }, 0).join()).toMatch(/featureless/);
    for (const k of ["eyes", "mouth", "nose", "features", "faceCover", "faceGlow", "faceBlur", "faceShadow", "faceHiddenBy", "glow"])
      expect(characterSpecIssues({ ...good, [k]: k === "faceHiddenBy" ? "light" : true }, 0).join(), k).toMatch(/مرسوم ثم مغطى/);
    const { face: _f, ...noFace } = good;
    expect(characterSpecIssues(noFace, 0).join()).toMatch(/featureless/);
  });

  it("2: no name or label, ordinary people only", () => {
    for (const k of ["name", "label", "title", "caption"]) expect(characterSpecIssues({ ...good, [k]: "أحمد" }, 0).join()).toMatch(/لا تُسمّى/);
    expect(characterSpecIssues({ ...good, kind: "prophet" }, 0).join()).toMatch(/ordinary-person/);
    expect(characterSpecIssues({ ...good, slot: "musa" }, 0).join()).toMatch(/c1 إلى c9/);
    expect(characterSpecIssues({ ...good, mystery: 1 }, 0).join()).toMatch(/غير معروف/);
  });

  it("3: attire must be declared from the three values, bodyEmphasis false explicitly", () => {
    const { attire: _a, ...noAttire } = good;
    expect(characterSpecIssues(noAttire, 0).join()).toMatch(/attire إلزامي/);
    expect(characterSpecIssues({ ...good, attire: "casual" }, 0).join()).toMatch(/attire إلزامي/);
    expect(characterSpecIssues({ ...good, age: "child" }, 0).join()).toMatch(/child-normal/);
    expect(characterSpecIssues({ ...good, attire: "child-normal" }, 0).join()).toMatch(/child-normal/);
    const { bodyEmphasis: _b, ...noBody } = good;
    expect(characterSpecIssues(noBody, 0).join()).toMatch(/bodyEmphasis/);
    expect(characterSpecIssues({ ...good, bodyEmphasis: true }, 0).join()).toMatch(/bodyEmphasis/);
  });

  it("4 (amended by D250): no voice or dialogue in the character spec; character lines are [قول: …] in the script", () => {
    for (const k of ["voice", "dialogue", "line", "speech", "bubble"]) expect(characterSpecIssues({ ...good, [k]: "x" }, 0).join()).toMatch(/\[قول: …\]/);
  });

  it("5: palette tokens only from the day palette", () => {
    expect(Object.keys(CHARACTER_PALETTE)).toEqual(["cream", "gold", "calm-green", "turquoise"]);
    expect(characterSpecIssues({ ...good, palette: ["black"] }, 0).join()).toMatch(/خارج اللوحة/);
    expect(characterSpecIssues({ ...good, palette: ["#000000"] }, 0).join()).toMatch(/خارج اللوحة/);
    expect(characterSpecIssues({ ...good, palette: [] }, 0).join()).toMatch(/palette إلزامي/);
  });

  it("props.characters must be a non-empty JSON array with distinct slots", () => {
    expect(parseCharacters("{").issues.join()).toMatch(/JSON/);
    expect(parseCharacters("{}").issues.join()).toMatch(/مصفوفة/);
    expect(parseCharacters("[]").issues.join()).toMatch(/فارغة/);
    expect(parseCharacters(chars(good, good)).issues.join()).toMatch(/خانتان/);
    expect(parseCharacters(undefined)).toEqual({ specs: [], issues: [] });
  });
});

describe("D248 scene gate", () => {
  it("2: a character scene whose narration names a prophet, angel, companion, Household or Mother of the Believers is refused", () => {
    for (const n of ["قال النبي ﷺ: الدين النصيحة.", "وكان جبريل عليه السلام ينزل بالوحي.", "روى أبو بكر الصديق رضي الله عنه.", "قالت عائشة رضي الله عنها.",
      "وكان الحسن والحسين يلعبان.", "وأمهات المؤمنين قدوة.", "وجاء في قصة موسى."])
      expect(errors(plan([scene({ narration: n, props: { characters: chars(good) } })])).join(), n).toMatch(/D248: مشهد فيه شخصية وكلامه يذكر/);
    // المشهد نفسه بلا شخصية مسموح
    expect(errors(plan([scene({ template: "kinetic-text", narration: "قال النبي ﷺ: الدين النصيحة." })]))).toEqual([]);
  });

  it("existing figure templates (alley-tale) are character scenes for limits 2 and 4, with a warning to declare", () => {
    const p = plan([scene({ template: "alley-tale", narration: "قال رسول الله صلى الله عليه وسلم:" })]);
    expect(errors(p).join()).toMatch(/رسول الله/);
    const ok = characterPolicyIssues(plan([scene({ template: "alley-tale" })]));
    expect(ok.map((i) => i.level)).toEqual(["warning"]);
    expect(errors(plan([scene({ template: "board-story", narration: "قال النبي ﷺ", props: { beats: "person|قال" } })])).join()).toMatch(/النبي/);
  });

  it("4: scene voice, speech-bubble template and dialogue props are refused", () => {
    expect(errors(plan([scene({ voice: "abc", props: { characters: chars(good) } })])).join()).toMatch(/للراوي وحده/);
    expect(errors(plan([scene({ template: "character-talk", props: { line: "مرحبا" } })])).join()).toMatch(/فقاعة الكلام/);
    expect(errors(plan([scene({ props: { characters: chars(good), bubble: "مرحبا" } })])).join()).toMatch(/فقاعة/);
  });

  it("5: night lighting, night/dark grading and the night theme are refused in a declared character scene", () => {
    expect(errors(plan([scene({ props: { characters: chars(good), lighting: "night-lamp" } })])).join()).toMatch(/night-lamp/);
    expect(errors(plan([scene({ props: { characters: chars(good), grade: "dark-night" } })])).join()).toMatch(/ليلي أو قاتم/);
    expect(errors(plan([scene({ props: { characters: chars(good), mood: "ليل" } })])).join()).toMatch(/ليلي أو قاتم/);
    expect(errors(plan([scene({ props: { characters: chars(good) } })], "balislam", "night")).join()).toMatch(/ثيم الليل/);
    expect(errors(plan([scene({ props: { characters: chars(good), lighting: "day-sun" } })]))).toEqual([]);
    // القالب القائم المعتمد بلا إعلان يبقى كما هو (ليل الحارة)
    expect(errors(plan([scene({ template: "alley-tale", props: { lighting: "night-lamp" } })]))).toEqual([]);
  });

  it("the D248 limits apply to «بالإسلام» only («دفاتر الزمن» has its own D249 rules, «زبدة الكتب» none)", () => {
    const bad = [scene({ voice: "x", narration: "قال النبي ﷺ", props: { characters: chars({ ...good, name: "x" }) } })];
    expect(characterPolicyIssues(plan(bad, "dafatir-alzaman")).some((i) => i.message.includes("D248"))).toBe(false);
    expect(characterPolicyIssues(plan(bad, "zubdat-alkutub"))).toEqual([]);
    expect(() => assertCharacterPolicy(plan(bad, "zubdat-alkutub"))).not.toThrow();
    expect(() => assertCharacterPolicy(plan(bad))).toThrow(/D248/);
  });

  it("is an early plan error in planIssues and refused at render and in render-worker jobs", () => {
    const p = plan([scene({ narration: "قال النبي ﷺ", props: { characters: chars(good) } })]);
    const i = planIssues(p).find((x) => x.message.includes("D248"));
    expect(i).toMatchObject({ level: "error", sceneId: "c1-s1", early: true });
    const src = (f: string) => readFileSync(path.join(repo, f), "utf8");
    expect(src("src/render/episode.ts")).toMatch(/assertCharacterPolicy\(plan\);/);
    expect(src("src/render/worker/macJobs.ts").match(/assertCharacterPolicy\(plan\);/g)?.length).toBe(2);
  });
});

describe("D248 name list: normalisation and no false alarms", () => {
  it("catches spelling variants through the traces normaliser and Arabic clitics", () => {
    const hit = (t: string) => sacredMentions(t).map((x) => x.phrase);
    expect(hit("النَّبِيُّ")).toContain("النبي");
    expect(hit("والنبي")).toContain("النبي");
    expect(hit("للنبي")).toContain("النبي");
    expect(hit("بالنبي")).toContain("النبي");
    expect(hit("ﷺ")).toContain("صلى الله عليه وسلم");
    expect(hit("الن​بي")).toContain("النبي");
    expect(hit("عـائـشـة")).toContain("عائشه");
    expect(hit("عايشه")).toContain("عائشه");
    expect(hit("أبي بكر")).toContain("ابو بكر");
    expect(hit("علي بن أبي طالب")).toContain("علي بن ابو طالب");
    expect(hit("عبد الله ابن عمر")).toContain("بن عمر");
    expect(hit("ملك الموت")).toContain("ملك الموت");
    expect(hit("آل البيت")).toContain("ال البيت");
  });

  it("does not flag ordinary words that share a name's letters", () => {
    for (const t of ["جلس على الكرسي", "في عمره كله", "طال العمر", "الخلق الحسن", "حديث حسن", "الجليس الصالح", "عمل صالح", "الله يحيي الأرض",
      "أحمد الله", "الملك العادل", "يملك بيتًا", "أهل البيت يتغدّون", "الصديق الوفي", "كل ابن آدم خطاء", "يا بني آدم", "في سورة الأنبياء",
      "سورة يوسف", "سورة مريم", "هارون الرشيد", "المسيح الدجال", "عبد الله بن يوسف", "مالك بن أنس بن مالك"])
      expect(sacredMentions(t), t).toEqual([]);
  });

  const spoken = (ch: string): string[] => {
    const dir = path.join(repo, "channels", ch, "episodes");
    const texts: string[] = [];
    for (const ep of readdirSync(dir)) {
      const f = path.join(dir, ep, "script.md");
      if (existsSync(f)) texts.push(...readFileSync(f, "utf8").split("\n").filter((l) => l.trim() && !/^\s*[-[#>|`<]/.test(l)));
      const pf = path.join(dir, ep, "plan.json");
      if (existsSync(pf)) for (const c of (JSON.parse(readFileSync(pf, "utf8")) as Plan).chapters) for (const s of c.scenes) texts.push(s.narration ?? "");
    }
    return texts;
  };

  it("no false alarm on «بالإسلام»'s spoken lines (every hit names a sacred figure)", () => {
    // المراجَع يدويًا (٢٨ نوفمبر): كل ما يطابق في كلام «بالإسلام» ذكرٌ حقيقي. عبارة جديدة هنا تُراجع في سياقها قبل قبولها.
    const reviewed = new Set(["النبي", "صلى الله عليه وسلم", "رسول الله", "رضي الله عنه", "رضي الله عنها", "رضي الله عنهما", "عائشه", "ابو هريره",
      "ملائكه", "نبي"]);
    const seen = new Set(spoken("balislam").flatMap((t) => sacredMentions(t).map((h) => h.phrase)));
    expect([...seen].filter((x) => !reviewed.has(x))).toEqual([]);
  });

  it("the other two channels are untouched by the gate, and their known traps do not match", () => {
    // القاعدة لا تمسهما؛ وفحص الكلمات عليهما للإنذار الكاذب: «سورة …»، «… بن يوسف»، «هارون الرشيد»، «مالك بن أنس بن مالك»
    for (const ch of ["dafatir-alzaman", "zubdat-alkutub"])
      for (const t of spoken(ch)) for (const h of sacredMentions(t)) expect(["هارون", "يوسف", "اسحاق", "الزبير", "طلحه"], `${ch}: ${t}`).not.toContain(h.phrase);
  });
});
