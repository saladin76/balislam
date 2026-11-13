/**
 * بلاغا المالك ١٣ نوفمبر (D131):
 *  ١. «اهم نقطة عندي هي تغير النطق خليه مفتوح في كل القنوات»: سطر «النطق» تحت كل جملة راوٍ حقلٌ يُعدَّل دائمًا
 *     (كان نصًا للقراءة فقط، ولا يظهر إلا حين يختلف النطق عن النص)، ولا يظهر لصف آية ولا بسملة.
 *  ٢. «ليه بعد ما ولدت الصوت الفيديو فوق بلا صوت؟»: المعاينة السريعة كانت مكتومة دائمًا ومكتوبًا تحتها «معاينة صامتة»
 *     ولو رُكّب صوت المشهد. الآن: صامتة ما دام صوت المشهد لم يُركَّب، وتقول لماذا وكم جملة اكتملت؛ وحين يوجد تُشغَّل بصوته.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SayEditor } from "../app/src/workspace/sentences/SayEditor";
import { liveAudio } from "../app/src/workspace/sceneProduction/liveAudio";
import type { SentenceRow } from "../app/src/api";
import type { EpisodeMedia } from "../src/plan/media";
import type { PlanScene } from "../src/plan/types";

const src = (f: string) => readFileSync(path.resolve(import.meta.dirname, "..", f), "utf8");
const row = (o: Partial<SentenceRow>): SentenceRow => ({
  id: "s1", sceneId: "c1-s2", kind: "narration", text: "في سوق صغير، وقف شخصان أمام ميزان بائع الفاكهة.",
  spoken: "فِي سُوقٍ صَغِيرٍ، وَقَفَ شَخْصَانِ أَمَامَ مِيزَانِ بَائِعِ الفَاكِهَةِ.", say: { auto: "فِي سُوقٍ صَغِيرٍ، وَقَفَ شَخْصَانِ أَمَامَ مِيزَانِ بَائِعِ الفَاكِهَةِ.", custom: null },
  ...o,
} as SentenceRow);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const model = (o: Record<string, unknown> = {}): any => ({ sayDrafts: {}, setSayDrafts: () => {}, busy: "", run: async () => true, ref: (r: SentenceRow) => ({ action: "init", id: r.id }), ...o });

describe("١ · «النطق» مفتوح لكل جملة راوٍ", () => {
  it("حقل يُعدَّل بالنطق المرسل نفسه، ويقول إنه لا يغيّر النص ولا الترجمة", () => {
    const html = renderToStaticMarkup(<SayEditor m={model()} r={row({})} n={1} />);
    expect(html).toContain("<textarea");
    expect(html).toContain("النطق:");
    expect(html).toContain("فِي سُوقٍ صَغِيرٍ");
    expect(html).toContain("لا يغيّر نص الجملة ولا السكريبت ولا الترجمة");
    expect(html).not.toContain("احفظ النطق"); // nothing typed yet
  });
  it("يظهر ولو كان النطق مثل النص تمامًا (سكريبت مشكول)", () => {
    const t = "كَتَبَ الوَلَدُ الدَّرْسَ.";
    expect(renderToStaticMarkup(<SayEditor m={model()} r={row({ text: t, spoken: t, say: { auto: t, custom: null } })} n={1} />)).toContain("<textarea");
  });
  it("ما يكتبه المالك: «احفظ النطق» و«تراجع»، والمكتوب بيده «ارجع إلى النطق الآلي»", () => {
    const dirty = renderToStaticMarkup(<SayEditor m={model({ sayDrafts: { s1: "فِي سُوقٍ صَغِيرٍ جِدًّا" } })} r={row({})} n={1} />);
    expect(dirty).toContain("احفظ النطق");
    expect(dirty).toContain("تراجع");
    expect(dirty).toContain("لا يُولَّد شيء وحده");
    const custom = renderToStaticMarkup(<SayEditor m={model()} r={row({ spoken: "فِي سُوقٍ", say: { auto: "آلي", custom: "فِي سُوقٍ" } })} n={1} />);
    expect(custom).toContain("مكتوب بيدك");
    expect(custom).toContain("ارجع إلى النطق الآلي");
  });
  it("لا نطق لصف آية ولا بسملة", () => {
    expect(renderToStaticMarkup(<SayEditor m={model()} r={row({ kind: "basmala", say: null })} n={1} />)).toBe("");
    expect(renderToStaticMarkup(<SayEditor m={model()} r={row({ kind: "verse", say: null })} n={1} />)).toBe("");
  });
  it("في القائمة والفقرة معًا، بلا شرط «يختلف عن النص» ولا إخفاء للقنوات", () => {
    for (const f of ["app/src/workspace/sentences/SentenceListRow.tsx", "app/src/workspace/sentences/SentenceParagraph.tsx"]) {
      const s = src(f);
      expect(s, f).toContain("<SayEditor");
      expect(s, f).not.toMatch(/r\.spoken !== r\.text/);
    }
    expect(src("app/src/workspace/sentences/SayEditor.tsx")).not.toMatch(/channel|balislam|dafatir|zubdat/);
  });
});

const scene = (o: Partial<PlanScene> = {}) => ({ id: "c1-s2", template: "alley-tale", narration: "في سوق صغير، وقف شخصان.", sfx: [], props: {}, ...o } as unknown as PlanScene);
const media = (voice: EpisodeMedia["voice"] = {}): EpisodeMedia => ({ mode: "url", base: "", voice, sfx: [], recitations: {} });

describe("٢ · المعاينة السريعة: صامتة ولماذا، أو بصوت المشهد", () => {
  it("قبل تركيب صوت المشهد: صامتة، وتقول كم جملة اكتملت", () => {
    const a = liveAudio(scene(), media(), { done: 3, total: 5 });
    expect(a.audible).toBe(false);
    expect(a.line).toContain("معاينة صامتة لأن صوت المشهد لم يُركَّب بعد");
    expect(a.line).toContain("اكتمل صوت ٣ من ٥ جمل");
    expect(liveAudio(scene(), media()).line).toContain("لم يُولَّد بعد");
  });
  it("بعد تركيبه: تُشغَّل بصوته (ليست مكتومة)، وتقول إن «أنتج هذا المشهد» يصنع المعاينة التي تُعتمد", () => {
    const a = liveAudio(scene(), media({ "c1-s2": { file: "abc.wav", hash: "abc", text: "في سوق صغير، وقف شخصان.", duration: 2, words: [] } as never }), { done: 1, total: 1 });
    expect(a.audible).toBe(true);
    expect(a.line).toContain("«أنتج هذا المشهد»");
    expect(a.key).toBe("voice:abc.wav");
  });
  it("صوت لنص سابق لا يُشغَّل ويقول ذلك", () => {
    const a = liveAudio(scene(), media({ "c1-s2": { file: "old.wav", hash: "o", text: "نص قديم", duration: 2, words: [] } as never }));
    expect(a.audible).toBe(false);
    expect(a.line).toContain("نص سابق");
  });
  it("المشغّل في الخطوة ٢ مكتوم فقط حين لا صوت، ويُعاد تركيبه حين يصل الصوت؛ والسطر تحته من الدالة نفسها", () => {
    const ep = src("app/src/tabs/EpisodeTab.tsx");
    expect(ep).toContain("muted={!la.audible}");
    expect(ep).toContain("key={la.key}");
    const parts = src("app/src/workspace/sceneProduction/SceneStepParts.tsx");
    expect(parts).toContain("{la.line}");
    expect(parts).not.toContain("المعاينة بالصوت تظهر هنا حين تُجهَّز");
  });
});
