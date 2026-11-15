/**
 * D136 — النبرة في «الجمل» عملية وواضحة (القنوات الثلاث، مكوّن واحد بلا شرط قناة):
 * نبرة التسجيل بجوار نبرة التوليد القادم، و«النبرة تغيّرت — اضغط ولّد لتسمع الجديد»، و«قارن: القديم / الجديد» مع
 * «استعمل هذا التسجيل»، ونبرة المشهد كله أو الحلقة كلها؛ وتأكيد «لم يتغير شيء يُرسل» قبل أي توليد مدفوع.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SceneToneBar, TONE_CHANGED, ToneLine } from "../app/src/workspace/sentences/ToneParts";
import type { SentenceRow, SentenceScene } from "../app/src/api";

const src = (f: string) => readFileSync(path.resolve(import.meta.dirname, "..", f), "utf8");
const row = (o: Partial<SentenceRow>): SentenceRow => ({
  id: "s1", sceneId: "c1-s1", kind: "narration", text: "كَتَبَ الوَلَدُ الدَّرْسَ.", status: "generated", tone: "", chars: 24,
  audio: { file: "s1-new.mp3", duration: 1.2, origin: "tts" }, takeTone: "dramatic", nextTone: "dramatic", toneChanged: false,
  wouldRepeat: true, previous: null, chosen: false, ...o,
} as SentenceRow);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const model = (o: Record<string, unknown> = {}): any => ({ busy: "", run: async () => true, ref: (r: SentenceRow) => ({ action: "init", id: r.id }),
  playClips: () => {}, urlOf: (f: string) => `/m/${f}`, read: { toneMap: null }, send: async () => null, setRead: () => {}, setError: () => {}, setMsg: () => {}, noKey: false, ...o });

describe("D136: سطر النبرة تحت الجملة", () => {
  it("نبرة التسجيل الحالي بجوار نبرة التوليد القادم", () => {
    const html = renderToStaticMarkup(<ToneLine m={model()} r={row({})} />);
    expect(html).toContain("التسجيل الحالي بنبرة «درامي»");
    expect(html).toContain("، والتوليد القادم بنبرة «درامي»");
    expect(html).not.toContain(TONE_CHANGED);
  });
  it("حين تختلفان: «النبرة تغيّرت — اضغط ولّد لتسمع الجديد»", () => {
    const html = renderToStaticMarkup(<ToneLine m={model()} r={row({ takeTone: "calm", nextTone: "warm", toneChanged: true })} />);
    expect(TONE_CHANGED).toBe("النبرة تغيّرت — اضغط ولّد لتسمع الجديد");
    expect(html).toContain(TONE_CHANGED);
    expect(html).toContain("«هادئ تأملي»");
    expect(html).toContain("«حكّاء دافئ»");
  });
  it("«قارن: القديم / الجديد» ولكل تسجيل «استعمل هذا التسجيل»؛ والمختار «المستعمل الآن»", () => {
    const prev = { file: "s1-old.mp3", duration: 1.1, tone: "calm", at: "2026-11-14T20:00:00Z" };
    const html = renderToStaticMarkup(<ToneLine m={model()} r={row({ previous: prev })} />);
    expect(html).toContain("قارن:");
    expect(html).toContain("▶ القديم («هادئ تأملي»)");
    expect(html).toContain("▶ الجديد («درامي»)");
    expect(html.match(/استعمل هذا التسجيل/g)).toHaveLength(2);
    const chosen = renderToStaticMarkup(<ToneLine m={model()} r={row({ previous: prev, chosen: true })} />);
    expect(chosen).toContain("المستعمل الآن");
    expect(chosen).toContain("اخترته بنفسك");
    expect(chosen.match(/استعمل هذا التسجيل/g)).toHaveLength(1);
  });
  it("لا سطر لجملة بلا تسجيل، ولا لصف آية أو بسملة، ولا لتسجيل «قديم» على نص سابق", () => {
    expect(renderToStaticMarkup(<ToneLine m={model()} r={row({ audio: null, status: "missing" })} />)).toBe("");
    expect(renderToStaticMarkup(<ToneLine m={model()} r={row({ kind: "verse" })} />)).toBe("");
    expect(renderToStaticMarkup(<ToneLine m={model()} r={row({ kind: "basmala" })} />)).toBe("");
    expect(renderToStaticMarkup(<ToneLine m={model()} r={row({ status: "old" })} />)).toBe("");
  });
});

describe("D136: نبرة المشهد كله أو الحلقة كلها", () => {
  const scene = (rows: SentenceRow[]): SentenceScene => ({ id: "c1-s1", index: 1, rows, managed: true } as unknown as SentenceScene);
  const p = { episodeId: "001", channelId: "zubdat-alkutub", sceneId: "c1-s1" };
  it("اختيار النطاق والنبرة، وجمل المشهد التي تغيّرت نبرتها بعددها وحروفها و«ولّد الجمل»", () => {
    const html = renderToStaticMarkup(<SceneToneBar m={model()} p={p} s={scene([row({ toneChanged: true, takeTone: "calm", nextTone: "warm" }), row({ id: "s2", toneChanged: true, takeTone: "calm", nextTone: "warm" })])} />);
    expect(html).toContain("هذا المشهد كله");
    expect(html).toContain("الحلقة كلها");
    expect(html).toContain("اختر نبرة…");
    expect(html).toContain("جملتان في هذا المشهد تغيّرت نبرتها ولم تُولَّد بعد (نحو ٤٨ حرفًا)");
    expect(html).toContain("ولّد الجمل (٢)");
  });
  it("لا شريط في حلقة بخريطة نبرة، ولا في قائمة الحلقة كلها", () => {
    expect(renderToStaticMarkup(<SceneToneBar m={model({ read: { toneMap: { version: "v1" } } })} p={p} s={scene([row({})])} />)).toBe("");
    expect(renderToStaticMarkup(<SceneToneBar m={model()} p={{ ...p, sceneId: undefined }} s={scene([row({})])} />)).toBe("");
  });
  it("موصول في الفقرة والقائمة، وتحت كل جملة، بلا شرط قناة", () => {
    for (const f of ["app/src/workspace/sentences/SentenceParagraph.tsx", "app/src/workspace/sentences/SentenceSceneBlock.tsx"]) expect(src(f), f).toContain("<SceneToneBar");
    expect(src("app/src/workspace/sentences/SentenceParts.tsx")).toContain("<ToneLine m={m} r={r} />");
    expect(src("app/src/workspace/sentences/ToneParts.tsx")).not.toMatch(/balislam|dafatir|zubdat/);
  });
  it("«لم يتغير شيء يُرسل» يطلب التأكيد قبل أي توليد، في «ولّد الجملة» و«أعد توليد الصوت»", () => {
    expect(src("app/src/workspace/sentences/useSentences.ts")).toMatch(/if \(r\.confirm\) \{\s*if \(!window\.confirm\(r\.confirm\.message\)\)[\s\S]{0,200}confirmSame: true/);
    expect(src("app/src/workspace/sceneProduction/useSceneProduction.ts")).toMatch(/if \(r\.confirm\) \{\s*if \(!window\.confirm\(r\.confirm\.message\)\)[\s\S]{0,200}confirmSame: true/);
  });
});
