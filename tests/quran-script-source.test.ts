import { afterAll, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { parseScript } from "../src/script/parse";
import { reviewItems } from "../src/script/review";
import { alignDiff } from "../src/quran/audit";
import { assertFetchAllowed, episodeQuranTexts, quranTextSourceFor, scriptVerseTexts, scriptVerses } from "../src/quran/scriptText";
import { withQuran, VERSE_PLACEHOLDER } from "../src/plan/quranText";
import type { Plan } from "../src/plan/types";

/**
 * نص الآيات من السكريبت (قرار صاحب القناة، 027 و٨ نوفمبر): يكتبه صاحب القناة بيده، ولا يُجلب ولا يُصحَّح آليًا،
 * ثم يُقابَل بالمصحف المعتمد وتُعرض الفروق للمراجعة الشرعية.
 * النصوص هنا عيّنات اصطناعية للاختبار (ليست نص آية)، فالاختبار يفحص المسار لا القرآن.
 */
const SAMPLE = "نَصٌّ تَجْرِيبِيٌّ";
const script = (verse?: string) => `# حلقة تجريبية

## الفصل 1: فصل

تعليق.

[آية: البقرة 42${verse ? ` | ${verse}` : ""}]

## الاستشهادات

- آية | البقرة 42
`;

const tmp = mkdtempSync(path.join(os.tmpdir(), "bal-qscript-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const episodeIn = (channel: string, quranText: "script" | "fetch" | undefined, body: string, quranJson?: Record<string, string>) => {
  const ch = path.join(tmp, "channels", channel);
  const ep = path.join(ch, "episodes", "001-t");
  mkdirSync(ep, { recursive: true });
  writeFileSync(path.join(ch, "channel.json"), JSON.stringify({ id: channel, rules: { quran: true, ...(quranText ? { quranText } : {}) } }));
  writeFileSync(path.join(ep, "script.md"), body);
  if (quranJson) writeFileSync(path.join(ep, "quran.json"), JSON.stringify(quranJson));
  return path.join(ep, "script.md");
};

describe("علامة الآية بنص صاحب القناة", () => {
  it("[آية: المرجع | النص] يُقرأ مرجعًا ونصًّا، وبلا نص كما كان", () => {
    const withText = scriptVerses(parseScript(script(SAMPLE), "x.md"));
    expect(withText).toEqual([{ ref: "البقرة 42", key: "2:42", text: SAMPLE.normalize("NFC"), line: 7 }]);
    const bare = scriptVerses(parseScript(script(), "x.md"));
    expect(bare[0]!.key).toBe("2:42");
    expect(bare[0]!.text).toBeUndefined();
  });

  it("النص يُستخرج كما كُتب بحروفه وتشكيله (NFC وحده)، ولا يُدخل شيء لم يُكتب", () => {
    expect(scriptVerseTexts(parseScript(script(SAMPLE), "x.md"))).toEqual({ "2:42": SAMPLE.normalize("NFC") });
    expect(scriptVerseTexts(parseScript(script(), "x.md"))).toEqual({});
  });

  it("البطاقة تعرض نص السكريبت نفسه، والآية التي لم يُكتب نصها تبقى بلا نص", () => {
    const plan = { chapters: [{ scenes: [{ id: "c1-s2", template: "verse-card", ayahKey: "2:42", props: { text: "" } }] }] } as unknown as Plan;
    expect(withQuran(plan, { "2:42": SAMPLE }).chapters[0]!.scenes[0]!.props.text).toBe(SAMPLE);
    expect(withQuran(plan, {}).chapters[0]!.scenes[0]!.props.text).toBe(VERSE_PLACEHOLDER);
  });
});

describe("مصدر النص حسب القناة", () => {
  it("قناة «script»: النص من السكريبت، وquran.json لا يُقرأ ولو وُجد", async () => {
    const p = episodeIn("s1", "script", script(SAMPLE), { "2:42": "نص مجلوب" });
    expect(quranTextSourceFor(p)).toBe("script");
    expect(await episodeQuranTexts(p)).toEqual({ source: "script", texts: { "2:42": SAMPLE.normalize("NFC") } });
    const bare = episodeIn("s2", "script", script(), { "2:42": "نص مجلوب" });
    expect((await episodeQuranTexts(bare)).texts).toEqual({});
  });

  it("الجلب الآلي مرفوض في قناة «script»، ومسموح في غيرها كما كان", () => {
    expect(() => assertFetchAllowed(episodeIn("s3", "script", script()))).toThrow(/صاحب القناة/);
    const f = episodeIn("f1", undefined, script(), { "2:42": "نص مجلوب" });
    expect(quranTextSourceFor(f)).toBe("fetch");
    expect(() => assertFetchAllowed(f)).not.toThrow();
  });

  it("قناة بالإسلام نفسها مصدرها السكريبت", () => {
    expect(quranTextSourceFor(path.join(__dirname, "../channels/balislam/episodes/001-know-the-truth/script.md"))).toBe("script");
  });
});

describe("التوثيق والمقابلة", () => {
  const item = (body: string) => reviewItems(parseScript(body, "x.md"), null).find((i) => i.kind === "ayah")!;

  it("بصمة الاستشهاد تتضمن نص الآية بحروفه وتشكيله: أي تعديل بعد التوثيق يعيده للمراجعة", () => {
    const a = item(script(SAMPLE));
    const changedHaraka = item(script(SAMPLE.replace("ٌّ", "ٍّ")));
    expect(changedHaraka.hash).not.toBe(a.hash);
    expect(a.text).toBe(SAMPLE.normalize("NFC"));
    // وبلا نص: البصمة كما كانت قبل هذا المسار
    expect(item(script()).hash).not.toBe(a.hash);
    const ledger = { version: 1 as const, items: { [a.key]: { hash: a.hash, status: "verified" as const, at: "x", ref: a.ref } } };
    expect(reviewItems(parseScript(script(SAMPLE), "x.md"), ledger).find((i) => i.kind === "ayah")!.status).toBe("verified");
    expect(reviewItems(parseScript(script(SAMPLE.replace("ٌّ", "ٍّ")), "x.md"), ledger).find((i) => i.kind === "ayah")!.status).toBe("changed");
  });

  it("المقابلة تُظهر الفرق بموضعه وفئته، ولا تصحح نص صاحب القناة", () => {
    const written = SAMPLE;
    const reference = SAMPLE.replace("ٌّ", "ٍّ");
    const ops = alignDiff(written, reference);
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.every((o) => o.cls === "haraka")).toBe(true);
    expect(written).toBe(SAMPLE);
  });
});
