/**
 * تطابق القنوات الثلاث في الاستوديو (طلب المالك ١٤ نوفمبر: «تأكد ان كل القنوات متطابقة في العناصر والامكانيات وتجربة
 * المستخدم»، D150). المصفوفة الكاملة في docs/studio/channel-parity.md.
 *
 * يفشل هذا الملف إن ظهر عنصر في الخطوة ٢ أو في «الجمل» (أو في أي شاشة يعمل فيها المالك) في قناة دون أخرى بلا
 * استثناء معلن بقاعدته في `src/studio/channelParity.ts`، أو إن غاب عنصر بقاعدة دون سطر يقول لماذا.
 */
import React from "react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ChannelConfig } from "../src/channel/types";
import { versesAreCitations } from "../src/quran/citation";
import { channelEngineFeatures } from "../src/plan/engine";
import {
  CHANNEL_EXCEPTIONS, CHANNEL_READS, DOCK_CONTROLS, ENGINE_ISOLATED_WHY, SENTENCE_CONTROLS, VERSE_CITATION_WHY, absentWhy, allSentencesHint,
  dockVoiceAbsent, isDeclaredRead,
} from "../src/studio/channelParity";
import { SceneDecisionActions } from "../app/src/workspace/sceneProduction/SceneDecisionActions";
import { SentenceSceneBlock } from "../app/src/workspace/sentences/SentenceSceneBlock";
import { ChannelBrand } from "../app/src/tabs/ChannelBrand";
import { STEPS } from "../app/src/shell/EpisodeSpine";

const root = path.resolve(import.meta.dirname, "..");
const src = (f: string) => readFileSync(path.join(root, f), "utf8");
const CHANNELS = ["balislam", "dafatir-alzaman", "zubdat-alkutub"] as const;
const config = (id: string): ChannelConfig => JSON.parse(src(`channels/${id}/channel.json`));

const noop = () => {};
const base = {
  stage: "review" as const, voice: "ok" as const, voiceBusy: false, canVoice: true, readyForAv: true,
  pending: false, problem: null, problemText: "", tone: "", confirming: false, reviewed: false,
  onVoice: noop, onProblem: noop, onProblemText: noop, onTone: noop, onCancelProblem: noop, onSubmitProblem: noop,
  onConfirm: noop, onApprove: noop, onRender: noop,
};
const label = (inner: string) => inner.replace(/<svg[\s\S]*?<\/svg>|<kbd[\s\S]*?<\/kbd>/g, "").replace(/<[^>]+>/g, "").trim();
const buttons = (html: string) => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => label(m[1]!));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, "\"").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

/** The dock of one scene in one channel, as SceneDock builds it (voice slot said when there is no voice). */
const dock = (ch: ChannelConfig, scene: { template: string; narration: string }, o: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<SceneDecisionActions {...base} voice={scene.narration.trim() ? "ok" : "none"} voiceAbsent={dockVoiceAbsent(ch, scene)} {...o} />);

describe("الشريط في الخطوة ٢: العناصر نفسها وترتيبها وأسماؤها في القنوات الثلاث", () => {
  const narration = { template: "big-question", narration: "جُمْلَةٌ" };
  const verse = { template: "verse-card", narration: "" };
  const end = { template: "end-card", narration: "" };

  it("مشهد بتعليق: «اعتمد المشهد» ثم «الحركة» ثم «النبرة» ثم «أعد توليد الصوت»، و⏎ على «اعتمد»، كما يعلنها العقد", () => {
    const all = CHANNELS.map((c) => dock(config(c), narration));
    for (const html of all) {
      expect(buttons(html)).toEqual(DOCK_CONTROLS.filter((x) => x.id !== "render").map((x) => x.label));
      expect(html).toMatch(/اعتمد المشهد<kbd aria-hidden="true">⏎<\/kbd>/);
    }
    expect(new Set(all).size, "the same markup in the three channels").toBe(1);
  });

  it("قبل المعاينة وأثناء التجهيز وبلا مفتاح: الشريط نفسه في القنوات الثلاث", () => {
    for (const o of [{ stage: "render", voice: "missing" }, { stage: "render", preparing: "now" }, { canVoice: false, voice: "missing" }, { confirming: true }]) {
      expect(new Set(CHANNELS.map((c) => dock(config(c), narration, o))).size, JSON.stringify(o)).toBe(1);
    }
    const render = dock(config("balislam"), narration, { stage: "render", voice: "missing" });
    expect(buttons(render)).toEqual(DOCK_CONTROLS.map((x) => x.id === "voice" ? "ولّد الصوت" : x.label));
  });

  it("مشهد بلا تعليق: زر الصوت لا يختفي بصمت؛ في مكانه سطر بالسبب، والأزرار الثلاثة كما هي", () => {
    for (const c of CHANNELS) {
      const html = dock(config(c), end);
      expect(buttons(html)).toEqual(["اعتمد المشهد", "الحركة غير مناسبة", "النبرة غير مناسبة"]);
      expect(html).toContain('class="s3-absent"');
      expect(text(html)).toContain("بلا تعليق صوتي");
    }
  });

  it("مشهد الآية: السبب بقاعدة القناة (تلاوة بشرية D35، أو استشهاد مكتوب D68) في مكان زر الصوت", () => {
    for (const c of CHANNELS) {
      const ch = config(c);
      const html = dock(ch, verse);
      expect(buttons(html)).toEqual(["اعتمد المشهد", "الحركة غير مناسبة", "النبرة غير مناسبة"]);
      expect(text(html)).toContain(dockVoiceAbsent(ch, verse)!);
      expect(text(html)).toMatch(versesAreCitations(ch) ? /استشهاد مكتوب/ : /تلاوتك/);
    }
    expect(versesAreCitations(config("zubdat-alkutub"))).toBe(true);
  });

  it("المشهد بتعليق لا سطر غياب فيه", () => {
    for (const c of CHANNELS) expect(dockVoiceAbsent(config(c), narration)).toBeNull();
  });
});

/** A sentences model for one verse scene (the parts read only these). */
const verseModel = (cited: boolean): any => ({ cited, recs: null, load: async () => {}, sceneQueue: () => [] });
const verseScene: any = { id: "c1-s2", index: 2, verse: { reference: "الشرح ٥", ayahKey: "94:5" }, rows: [] };
const panel: any = { episodeId: "001", channelId: "x", sceneId: "c1-s2" };

describe("«الجمل»: صف الآية بقاعدة القناة، وسطر واحد مشترك حين لا رفع", () => {
  it("قناة التلاوة: «ارفع التلاوة»؛ قناة الاستشهاد: السطر المعلن نفسه بدل الخانة", () => {
    for (const c of CHANNELS) {
      const ch = config(c);
      const html = renderToStaticMarkup(<SentenceSceneBlock m={verseModel(versesAreCitations(ch))} p={{ ...panel, channelId: c }} s={verseScene} />);
      if (versesAreCitations(ch)) {
        expect(text(html)).toContain(VERSE_CITATION_WHY);
        expect(html).not.toContain("ارفع التلاوة");
        expect(absentWhy(ch, "recitation-upload")).toBe(VERSE_CITATION_WHY);
      } else {
        expect(html).toContain("ارفع التلاوة");
        expect(absentWhy(ch, "recitation-upload")).toBeNull();
      }
    }
  });

  it("«جمل الحلقة كلها» لا تَعِد برفع التلاوة في قناة الاستشهاد", () => {
    expect(allSentencesHint(config("zubdat-alkutub"))).not.toContain("برفع التلاوة");
    expect(allSentencesHint(config("zubdat-alkutub"))).toContain(VERSE_CITATION_WHY);
    expect(allSentencesHint(config("balislam"))).toContain("برفع التلاوة");
    expect(allSentencesHint(config("balislam"))).toBe(allSentencesHint(config("dafatir-alzaman")));
    expect(src("app/src/workspace/sceneProduction/SceneStepParts.tsx")).toContain("allSentencesHint(");
  });

  it("عناصر الجملة المعلنة كلها في مكوّنات «الجمل» المشتركة (لا نسخة لكل قناة)", () => {
    const parts = ["SentenceParagraph.tsx", "SentenceListRow.tsx", "SentenceParts.tsx", "SayEditor.tsx", "WordPopovers.tsx", "ToneParts.tsx", "format.ts", "useSentences.ts"]
      .map((f) => src(`app/src/workspace/sentences/${f}`)).join("\n") + src("app/src/workspace/PronunciationNote.tsx");
    for (const c of SENTENCE_CONTROLS) expect(parts, c.id).toContain(c.label);
  });
});

describe("أدوات المحرك: معزولة لقناتها، وسطر يقول ذلك حيث تغيب", () => {
  it("«إعدادات القناة»: قناة بلا أدوات محرك ترى السبب، والقناة صاحبتها ترى الجدول", () => {
    for (const c of CHANNELS) {
      const ch = config(c);
      const html = renderToStaticMarkup(<ChannelBrand c={ch} set={noop} />);
      if (channelEngineFeatures(c).length) {
        expect(html).toContain('id="engine-panel"');
        expect(text(html)).not.toContain(ENGINE_ISOLATED_WHY);
      } else {
        expect(text(html)).toContain(ENGINE_ISOLATED_WHY);
        expect(absentWhy(ch, "engine-panel")).toBe(ENGINE_ISOLATED_WHY);
      }
    }
  });

  it("محرر المشهد: «الدخول من المشهد السابق» الغائب يُقال سببه", () => {
    expect(src("app/src/tabs/EpisodeTab.tsx")).toMatch(/absentWhy\(channel, "scene-transition"\)/);
  });
});

/** Every owner screen: the files whose controls the owner sees in the four steps. */
const OWNER_FILES = (() => {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(path.join(root, d))) {
      const p = `${d}/${f}`;
      if (statSync(path.join(root, p)).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f)) out.push(p);
    }
  };
  for (const d of ["app/src/workspace", "app/src/shell"]) walk(d);
  return [...out, "app/src/App.tsx", ...["ShortsPicker", "PublishTab", "DriveHandoff", "SocialKit", "ScriptTab", "StoryboardPanel", "TashkeelTab", "ReviewPanel",
    "EpisodeTab", "BoardAuditLog", "ChannelBrand", "ChannelTab"].map((f) => `app/src/tabs/${f}.tsx`)];
})();

/** What makes a control depend on the channel. A new one must be declared with its rule, or the test fails. */
const CHANNEL_READ = /useChannel\(|versesAreCitations\(|recitationStageNeeded\(|engineEnabled\(|channelEngineFeatures\(|channelProductionProfile\(|isPartsChannel|\b(?:channel|channelId|ch|c)(?:\??\.id)?\s*[!=]==?\s*"(?:balislam|dafatir-alzaman|zubdat-alkutub)"|\bchannel\??\.(?:rules|verse|script|cast|frame|pacing|library)\b/g;

describe("لا انحراف بعد اليوم: كل ما يختلف بين القنوات معلن بقاعدته", () => {
  it("كل قراءة للقناة في شاشات المالك معلنة باستثناء له قاعدة وسطر سبب", () => {
    const undeclared: string[] = [];
    for (const f of OWNER_FILES) {
      const lines = src(f).split("\n");
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        for (const m of line.matchAll(CHANNEL_READ)) if (!isDeclaredRead(f, m[0])) undeclared.push(`${f}:${i + 1} ${m[0]}`);
      });
    }
    expect(undeclared, "declare it in CHANNEL_READS with its rule, or make the control the same in every channel").toEqual([]);
  });

  it("كل قراءة معلنة ما زالت في ملفها (لا إعلان ميت)، وكل استثناء له قاعدة وسطر سبب وعناصر", () => {
    for (const r of CHANNEL_READS) {
      expect(src(r.file), `${r.file}: ${r.match}`).toContain(r.match);
      expect(CHANNEL_EXCEPTIONS.map((x) => x.id), r.file).toContain(r.exception);
    }
    for (const x of CHANNEL_EXCEPTIONS) {
      expect(x.rule.trim(), x.id).not.toBe("");
      expect(x.why.trim(), x.id).not.toBe("");
      expect(x.controls.length, x.id).toBeGreaterThan(0);
    }
  });

  it("لا اسم قناة أخرى ولا بصمتها في أسطر السبب (الهوية مقفلة)", () => {
    for (const x of CHANNEL_EXCEPTIONS) expect(x.why, x.id).not.toMatch(/بالإسلام|دفاتر الزمن|زبدة الكتب|محراب|الأفق|القلم المميِّز|#[0-9A-F]{6}/i);
  });

  it("الخطوات الأربع وتبويباتها واحدة لكل القنوات", () => {
    expect(STEPS.map((s) => s.tabs)).toEqual([["storyboard", "script", "tashkeel", "research"], ["episode", "voice"], ["review"], ["publish"]]);
    expect(src("app/src/shell/EpisodeSpine.tsx")).not.toMatch(/"(balislam|dafatir-alzaman|zubdat-alkutub)"/);
  });

  it("المصفوفة موثّقة: docs/studio/channel-parity.md تذكر كل استثناء بقاعدته", () => {
    const doc = src("docs/studio/channel-parity.md");
    for (const x of CHANNEL_EXCEPTIONS) expect(doc, x.id).toContain(x.id);
    for (const c of DOCK_CONTROLS) expect(doc, c.id).toContain(c.label);
  });
});
