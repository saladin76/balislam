/**
 * D249 («دفاتر الزمن»: شخصيات بلا ملامح وأصوات ممثَّلة بضوابط، ولا شيء منها في حلقة فيها من لا يُصوَّر) وD250 («بالإسلام»:
 * حوار الشخصيات بأصوات المكتبة بضوابط): الصيغة [قول: …] في السكريبت، والبوابة في فحص السكريبت، وتوجيه الصوت بعيدًا عن
 * صوت الراوي المستنسخ، وبوابة الخطة لشخصيات «دفاتر الزمن» القائمة بملامحها.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseScript } from "../src/script/parse";
import {
  characterLineIssues, characterVoicesConfigIssues, hadithMarkers, loadCharacterVoices, rulingMarkers, speechLines, type CharacterVoicesFile,
} from "../src/script/characterLines";
import { characterVoiceFor, speakCharacterLine } from "../src/voice/characterVoice";
import { characterPolicyIssues, DAFATIR_FIGURES, dafatirFiguresNeedingConversion } from "../src/plan/characterPolicy";
import { figureNamesAr } from "../characters/HistoricFigure";
import { scriptSentences } from "../src/studio/scriptPipeline";
import type { Plan, PlanScene } from "../src/plan/types";

const repo = path.resolve(__dirname, "..");
const NARRATOR = "cloned-narrator-id";
const at = { approvedBy: "المالك", approvedAt: "2026-11-28" };
const voices: CharacterVoicesFile = { version: 1, voices: [
  { key: "رجل كبير", role: "older-man", libraryVoiceId: "lib-old", ...at },
  { key: "شاب", role: "young-man", libraryVoiceId: "lib-young", ...at },
  { key: "امرأة", role: "woman", libraryVoiceId: "lib-woman", delivery: "normal", ...at },
  { key: "طفل", role: "child", libraryVoiceId: "lib-child", ...at },
] };
const dafatirVoices: CharacterVoicesFile = { version: 1, voices: voices.voices.filter((v) => v.role !== "child") };
const script = (body: string, title = "حكاية في السوق") => parseScript(`---\ntitle: "${title}"\ndomain: general\nepisode: "001"\n---\n\n${body}\n`);
const issues = (body: string, channel: string, v = channel === "balislam" ? voices : dafatirVoices, title?: string) =>
  characterLineIssues(script(body, title), channel, v, { narratorVoiceId: NARRATOR }).map((i) => i.message).join("\n");

describe("the [قول: …] line", () => {
  it("parses to a typed speech block, never narration, and is an editor unit", () => {
    const p = script("خرج الرجل إلى السوق.\n\n[قول: رجل كبير | «السلام عليكم يا جماعة» | اسم: الحسن البصري | مصدر: الزهد لأحمد ٢٦٣]\n");
    const blocks = p.chapters.flatMap((c) => c.blocks);
    expect(blocks.map((b) => b.kind)).toEqual(["narration", "speech"]); // owner-pin-ok: بيانات مصطنعة داخل الاختبار
    expect(speechLines(p)[0]).toMatchObject({ voice: "رجل كبير", text: "السلام عليكم يا جماعة", name: "الحسن البصري", source: "الزهد لأحمد ٢٦٣" });
    expect(p.parseIssues).toEqual([]);
    const units = scriptSentences(`---\ntitle: x\n---\n[قول: شاب | مرحبا]\n`).map((s) => s.text);
    expect(units).toEqual(["[قول: شاب | مرحبا]"]); // owner-pin-ok: بيانات مصطنعة داخل الاختبار
  });

  it("refuses a malformed line", () => {
    expect(script("[قول: | نص]").parseIssues.map((i) => i.code)).toEqual(["speech-syntax"]); // owner-pin-ok: بيانات مصطنعة داخل الاختبار
    expect(script("[قول: شاب]").parseIssues.map((i) => i.code)).toEqual(["speech-syntax"]); // owner-pin-ok: بيانات مصطنعة داخل الاختبار
    expect(script("[قول: شاب | نص | صوت: آخر]").parseIssues[0]!.message).toMatch(/حقل غير معروف/);
  });

  it("existing scripts of the three channels have no character line, so their check is unchanged", () => {
    for (const ch of ["balislam", "dafatir-alzaman", "zubdat-alkutub"]) {
      const dir = path.join(repo, "channels", ch, "episodes");
      for (const ep of readdirSync(dir)) {
        const f = path.join(dir, ep, "script.md");
        if (existsSync(f)) expect(speechLines(parseScript(readFileSync(f, "utf8"))), `${ch}/${ep}`).toEqual([]);
      }
    }
  });
});

describe("voices config", () => {
  it("ships empty for both channels: every character line is refused until the owner approves a library voice", () => {
    for (const ch of ["balislam", "dafatir-alzaman"]) expect(loadCharacterVoices(ch).voices).toEqual([]);
    expect(issues("[قول: شاب | تفضل يا أخي]", "balislam", { version: 1, voices: [] })).toMatch(/لم يُعتمد صوت بعد/);
  });

  it("refuses the cloned narrator voice, a woman without normal delivery, an unknown role and a missing approval", () => {
    expect(characterVoicesConfigIssues("balislam", voices, NARRATOR)).toEqual([]);
    const bad: CharacterVoicesFile = { version: 1, voices: [
      { key: "رجل", role: "older-man", libraryVoiceId: NARRATOR, ...at },
      { key: "امرأة", role: "woman", libraryVoiceId: "w", ...at },
      { key: "طفل", role: "child", libraryVoiceId: "c", approvedBy: "", approvedAt: "" },
    ] };
    const m = characterVoicesConfigIssues("dafatir-alzaman", bad, NARRATOR).join("\n");
    expect(m).toMatch(/صوت الراوي المستنسخ نفسه/);
    expect(m).toMatch(/delivery: "normal"/);
    expect(m).toMatch(/ليس من أدوار القناة/);
    expect(m).toMatch(/بلا سجل اعتماد/);
  });
});

describe("D250 «بالإسلام»", () => {
  it("accepts an unnamed ordinary person's line in an approved library voice", () => {
    expect(issues("[قول: رجل كبير | تعال نجلس قليلًا ونتكلم بهدوء.]", "balislam")).toBe("");
    expect(issues("[قول: امرأة | الغداء جاهز، نادِ إخوتك.]", "balislam")).toBe("");
  });

  it("4: no character recites a verse or narrates a hadith", () => {
    expect(issues("[قول: شاب | قال تعالى ﴿وأن ليس للإنسان إلا ما سعى﴾]", "balislam")).toMatch(/تتلو آية/);
    const withVerse = "[آية: النجم 39 | وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ]\n\n[قول: شاب | وأن ليس للإنسان إلا ما سعى]";
    expect(issues(withVerse, "balislam")).toMatch(/تتلو آية/);
    for (const t of ["قال رسول الله صلى الله عليه وسلم الدين النصيحة", "رواه البخاري", "عن النبي ﷺ أنه قال", "حدثنا فلان"])
      expect(issues(`[قول: شاب | ${t}]`, "balislam"), t).toMatch(/تروي حديثًا/);
  });

  it("5: no character issues a fatwa or states a ruling", () => {
    for (const t of ["هذا حرام يا أخي", "يجب أن تصلي الآن", "لا يجوز هذا البيع", "الصيام فرض", "ما حكم هذا؟", "هذه سنة مؤكدة", "أفتى الشيخ بكذا"])
      expect(issues(`[قول: رجل كبير | ${t}]`, "balislam"), t).toMatch(/تفتي أو تقرر حكمًا/);
  });

  it("6: no voice for, or mention of, a prophet, angel, companion, household member or Mother of the Believers", () => {
    for (const t of ["كان أبو بكر يفعل هذا", "قالت عائشة كذا", "جبريل نزل", "كما فعل موسى"])
      expect(issues(`[قول: شاب | ${t}]`, "balislam"), t).toMatch(/لا صوت لنبي/);
  });

  it("1: no real name; the voice must be an approved library voice", () => {
    expect(issues("[قول: شاب | مرحبا | اسم: خالد]", "balislam")).toMatch(/لا اسم للشخصية/);
    expect(issues("[قول: الراوي | مرحبا]", "balislam")).toMatch(/ليس من أصوات المكتبة المعتمدة/);
  });

  it("ordinary lines do not trip the hadith or ruling markers", () => {
    for (const t of ["أخبرني صاحبي أنه سيتأخر", "الحديث معك ممتع", "في السنة الماضية سافرنا", "الحكمة ضالة المؤمن عندنا مثل", "حُرم من النوم ليلتها",
      "الحكم في المباراة كان ظالمًا", "شهر محرم بدأ", "شرعا في العمل", "روّح البيت بدري"])
      expect([...hadithMarkers(t), ...rulingMarkers(t)], t).toEqual([]);
  });
});

describe("D249 «دفاتر الزمن»", () => {
  it("an episode that names a prophet, angel, companion, household member or Mother of the Believers has no character voices at all", () => {
    expect(issues("ونقف مع نوح عليه السلام.\n\n[قول: رجل كبير | الريح شديدة اليوم.]", "dafatir-alzaman")).toMatch(/لا شخصيات ولا أصوات ممثَّلة فيها/);
    expect(issues("[قول: رجل كبير | الريح شديدة اليوم.]", "dafatir-alzaman", dafatirVoices, "قصة آدم عليه السلام")).toMatch(/لا شخصيات ولا أصوات/);
    expect(issues("ازدحم السوق في بغداد.\n\n[قول: رجل كبير | الريح شديدة اليوم.]", "dafatir-alzaman")).toBe("");
  });

  it("a named character speaks only sourced words, and the source is required (shown on screen)", () => {
    expect(issues("[قول: رجل كبير | كلام منسوب | اسم: صلاح الدين]", "dafatir-alzaman")).toMatch(/المصدر إلزامي/);
    expect(issues("[قول: رجل كبير | كلام منسوب | اسم: صلاح الدين | مصدر: النوادر السلطانية ٢٢]", "dafatir-alzaman")).toBe("");
  });

  it("well-known imams and scholars never appear as characters", () => {
    expect(issues("[قول: رجل كبير | كلام | اسم: الإمام الشافعي | مصدر: الرسالة]", "dafatir-alzaman")).toMatch(/لا يظهر شخصيةً/);
  });

  it("an unnamed person's line is short and generic: no new historical information", () => {
    expect(issues("[قول: شاب | " + "كلمة ".repeat(13).trim() + "]", "dafatir-alzaman")).toMatch(/١٢ كلمة/);
    expect(issues("[قول: شاب | بنيت المدينة سنة 762]", "dafatir-alzaman")).toMatch(/لا رقم ولا تاريخ/);
  });

  it("no child voice in «دفاتر الزمن» (owner: older man, young man, woman)", () => {
    expect(characterVoicesConfigIssues("dafatir-alzaman", voices, NARRATOR).join()).toMatch(/ليس من أدوار القناة/);
  });

  it("the existing 8 characters are drawn with eyes and mouth: all need conversion, and any scene using one is refused", () => {
    expect([...DAFATIR_FIGURES].sort()).toEqual(Object.keys(figureNamesAr).sort());
    expect(dafatirFiguresNeedingConversion()).toEqual([...DAFATIR_FIGURES]);
    const p = (s: Partial<PlanScene>, narration = "ازدحم السوق.") => ({ version: 1, episode: "x", title: "t", domain: "d", themeId: "warm", channel: "dafatir-alzaman", updatedAt: "",
      chapters: [{ number: 1, title: "", scenes: [{ id: "c1-s1", template: "set-scene", narration, line: 1, sfx: [], props: {}, ...s } as PlanScene] }] }) as Plan;
    expect(characterPolicyIssues(p({ props: { figure: "merchant" } })).map((i) => i.message).join()).toMatch(/D249: الشخصية «merchant» مرسومة بملامح/);
    expect(characterPolicyIssues(p({ props: { figure2: "woman" } }, "ونوح عليه السلام يبني")).map((i) => i.message).join()).toMatch(/لا شخصيات ولا أصوات/);
    expect(characterPolicyIssues(p({ props: {} }))).toEqual([]);
    // the trailer still uses three of them: refused until converted or disabled
    const trailer = JSON.parse(readFileSync(path.join(repo, "channels/dafatir-alzaman/episodes/000-trailer/plan.json"), "utf8")) as Plan;
    expect(characterPolicyIssues(trailer, "dafatir-alzaman").filter((i) => i.level === "error").length).toBeGreaterThan(0);
  });
});

describe("routing a character line to its voice", () => {
  const fake = () => { const calls: { text: string; voiceId?: string }[] = []; return { calls, client: { tts: async (text: string, ctx: { voiceId?: string } = {}) => { calls.push({ text, voiceId: ctx.voiceId }); return {} as never; } } }; };

  it("sends the approved library voice id, never the cloned narrator", async () => {
    const { calls, client } = fake();
    await speakCharacterLine(client, "balislam", { voice: "امرأة", text: "الغداء جاهز." }, voices, NARRATOR);
    expect(calls).toEqual([{ text: "الغداء جاهز.", voiceId: "lib-woman" }]);
  });

  it("refuses before any request: unknown voice, the narrator's own voice, unknown narrator, verse/hadith/ruling text", async () => {
    const { calls, client } = fake();
    const narratorAsCharacter: CharacterVoicesFile = { version: 1, voices: [{ key: "رجل كبير", role: "older-man", libraryVoiceId: NARRATOR, ...at }] };
    expect(() => characterVoiceFor("balislam", { voice: "مجهول", text: "مرحبا" }, voices, NARRATOR)).toThrow(/ليس من أصوات المكتبة/);
    expect(() => characterVoiceFor("balislam", { voice: "رجل كبير", text: "مرحبا" }, narratorAsCharacter, NARRATOR)).toThrow(/صوت الراوي المستنسخ/);
    expect(() => characterVoiceFor("balislam", { voice: "رجل كبير", text: "مرحبا" }, voices, undefined)).toThrow(/صوت الراوي غير معروف/);
    for (const t of ["﴿قل هو الله أحد﴾", "قال النبي ﷺ", "هذا حرام"])
      await expect(speakCharacterLine(client, "balislam", { voice: "شاب", text: t }, voices, NARRATOR)).rejects.toThrow();
    expect(calls).toEqual([]);
  });
});

describe("«زبدة الكتب» has no character lines", () => {
  it("refuses any [قول: …] line", () => {
    expect(issues("[قول: شاب | مرحبا]", "zubdat-alkutub", voices)).toMatch(/لا أقوال شخصيات/);
  });
});
