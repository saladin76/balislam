/**
 * توحيد تجربة اعتماد المشاهد (الخطوة ٣) للقنوات الثلاث (قرار صاحب المشروع، ٨ نوفمبر):
 * «دفاتر الزمن» ترى الشاشة نفسها التي تراها «بالإسلام» و«زبدة الكتب»: معاينة المشهد، وتحتها شريط الأفعال
 * الظاهر دائمًا بالترتيب نفسه، وشريط المشاهد، والأسماء نفسها. قواعد الإنتاج (أجزاء خريطة النبرة، الآيات،
 * منع التجسيد) وهوية القناة (لونها من data-channel) تبقى لكل قناة؛ ولا فرع بالقناة في واجهة الاعتماد.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SceneProductionPanel } from "../app/src/workspace/SceneProductionPanel";
import type { SceneProductionRead } from "../app/src/api";
import type { Plan } from "../src/plan/types";
import { channelInfo, type ChannelConfig } from "../src/channel/types";
import { panelSource } from "./helpers/panelSource";

const root = path.join(__dirname, "..");
const src = (rel: string) => panelSource(rel);
const EPISODES = {
  balislam: "001-know-the-truth",
  "zubdat-alkutub": "001-awwal-marra-osalli",
  "dafatir-alzaman": "001-adam-beginning",
} as const;
type Ch = keyof typeof EPISODES;
const CHANNELS = Object.keys(EPISODES) as Ch[];
// funnel v3 (D40): «اعتمد» أولًا (يمين الشاشة) ثم أزرار الحل؛ «جهّز كل المشاهد» خرج من شريط المشهد (يبدأ وحده
// بعد «اعتمد التجهيز» وسطر حالته فوق المعاينة). «ولّد الصوت» لمشهد منطوق، و«أنتج هذا المشهد» قبل التجهيز فقط.
const ACTIONS = ["اعتمد المشهد", "الحركة غير مناسبة", "النبرة غير مناسبة", "ولّد الصوت"];

const planOf = (ch: Ch) => JSON.parse(src(`channels/${ch}/episodes/${EPISODES[ch]}/plan.json`)) as Plan;
const channelOf = (ch: Ch) => channelInfo(JSON.parse(src(`channels/${ch}/channel.json`)) as ChannelConfig);

type State = "gated" | "render" | "review";
/** نموذج قراءة السجل كما يرسله الخادم، على خطة الحلقة الحقيقية لكل قناة. */
const readFor = (ch: Ch, plan: Plan, state: State): SceneProductionRead => {
  const ids = plan.chapters.flatMap((c) => c.scenes.map((s) => s.id));
  // الحالة نفسها في كل قناة: أول مشهد منطوق (غير آية) هو الحالي وما قبله معتمد، فلا يختلف إلا ما تمليه
  // خطة الحلقة نفسها (في «دفاتر الزمن» تسبقه بطاقة بلا تعليق)
  const current = plan.chapters.flatMap((c) => c.scenes).find((s) => s.narration.trim() && s.template !== "verse-card")!.id;
  const approved = ids.slice(0, ids.indexOf(current));
  const open = state !== "gated";
  return {
    schemaVersion: 1, channel: ch, episode: EPISODES[ch], revision: 3,
    progress: { currentScene: current, approvedScenes: open ? approved.length : 0, totalScenes: ids.length, recitationPending: [],
      canAssemble: false, assemblyApproved: false, masterApproved: false, publishAllowed: false },
    script: { sha256: "a".repeat(64), approved: open },
    storyboard: { sha256: "b".repeat(64), approved: open },
    scenes: ids.map((id) => ({
      id, sourceSha256: "c".repeat(64), readyForAv: true,
      approved: open && approved.includes(id),
      status: open && approved.includes(id) ? "approved" as const : id === current && state === "review" ? "in_review" as const : "queued" as const,
      ...(id === current && state === "review" ? { previewSha256: "d".repeat(64) } : {}),
    })),
    prepared: { ready: 0, total: ids.length },
    assembly: null, seams: [], master: null,
    candidates: { scenes: state === "review" ? { [current]: "d".repeat(64) } : {}, assemblySha256: null, masterSha256: null },
  };
};

const render = (ch: Ch, state: State) => {
  const plan = planOf(ch);
  const noop = () => {};
  return renderToStaticMarkup(
    <SceneProductionPanel episodeId="001" channelId={ch} plan={plan} channel={channelOf(ch)} initialRead={readFor(ch, plan, state)}
      media={{ voice: {} } as never} hasVoiceKeys={false}
      editor={() => <div>editor</div>} livePreview={() => <div>live</div>}
      onOpenScene={noop} onOpenStoryboard={noop} onOpenScript={noop} onOpenPublish={noop} onOpenFinal={noop} onOpenSettings={noop} />,
  );
};

/** One element by its class, through its matching closing tag (the decision bar now holds icons). */
const elementOf = (html: string, cls: string) => {
  const start = html.indexOf(`class="${cls}"`);
  if (start < 0) return "";
  const open = html.lastIndexOf("<", start);
  const tag = /^<(\w+)/.exec(html.slice(open))![1]!;
  const re = new RegExp(`<${tag}[\\s>]|</${tag}>`, "g");
  re.lastIndex = open;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (!depth) return html.slice(open, m.index + m[0].length);
  }
  return html.slice(open);
};
/** شريط الأفعال وحده: مجموعة القرار في الشريط العائم (بلا السابق والتالي والعدّ، وهي خارجها). */
const barOf = (html: string) => elementOf(html, "s3-actbar");
const label = (inner: string) => inner.replace(/<svg[\s\S]*?<\/svg>|<kbd[\s\S]*?<\/kbd>/g, "").replace(/<[^>]+>/g, "").trim();
const actbar = (html: string) => [...barOf(html).matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => label(m[1]!));
/**
 * هيكل الشاشة بلا نصوص المحتوى ولا الأعداد: أسماء الأصناف بترتيبها. يُستثنى ما تمليه بيانات الحلقة وحدها (ومنها رقم كل مشهد في الشريط وصفر الأعداد الأكبر قليلًا):
 * أسطر الأسباب (مثل «أضف مفتاح الصوت» لمشهد منطوق فقط) وعناصر قائمة التنبيهات.
 */
// «s3-issues» وقائمته يظهران حين يكون للحلقة تنبيه فقط (حلقة 001 من «دفاتر الزمن» بعد V8 بلا بطاقات آيات فلا تنبيه لها)
const DATA_ROWS = new Set(["sp-hint", "prep-link", "s3-lv", "s3-id", "s3-dot-n", "s3-dot-ph", "z", "s3-issues", "s3-issue-list"]);
const skeleton = (html: string) =>
  [...html.matchAll(/class="([^"]+)"/g)].map((m) => m[1]!.split(" ").filter((c) => !/^is-|^s3-ch$/.test(c)).join(".")).filter((c) => c && !DATA_ROWS.has(c))
    // شريط المشاهد وقائمة التنبيهات تطول بعدد مشاهد الحلقة وملاحظاتها؛ يكفي وجود كل صنف بترتيبه
    .filter((c, i, all) => c !== all[i - 1]);

describe("الخطوة ٢ «المشاهد» واحدة للقنوات الثلاث", () => {
  it("قبل اعتماد التجهيز: سطر واحد وزر واحد إلى الخطوة ١، بالبنية نفسها لكل قناة، بلا شريط معطّل", () => {
    const out = Object.fromEntries(CHANNELS.map((ch) => [ch, render(ch, "gated")])) as Record<Ch, string>;
    for (const ch of CHANNELS) {
      const html = out[ch];
      expect(html, ch).toContain('class="stage s3 s3-gated"');
      expect(html, ch).not.toContain("s3-actbar");
      expect(html.match(/<button/g), ch).toHaveLength(1);
      expect(html, ch).toMatch(/btn primary[^"]*"[^>]*>إلى التجهيز/);
    }
    expect(skeleton(out["dafatir-alzaman"])).toEqual(skeleton(out.balislam));
    expect(skeleton(out["zubdat-alkutub"])).toEqual(skeleton(out.balislam));
  });
  for (const state of ["render", "review"] as const) {
    it(`حالة «${state}»: البنية نفسها والأفعال نفسها بالترتيب نفسه`, () => {
      const out = Object.fromEntries(CHANNELS.map((ch) => [ch, render(ch, state)])) as Record<Ch, string>;
      for (const ch of CHANNELS) {
        const html = out[ch];
        expect(html, ch).toContain('class="stage s3"');
        expect(html, ch).toContain('class="s3-strip"');
        expect(html, ch).not.toContain("scene-first-panel");
        const buttons = actbar(html);
        // «أنتج هذا المشهد» يظهر قبل التجهيز فقط، ومكانه ثابت آخر الشريط
        expect(buttons.filter((b) => b !== "أنتج هذا المشهد"), ch).toEqual(ACTIONS);
        expect(buttons[0], ch).toBe("اعتمد المشهد");
        expect(buttons, ch).toEqual(actbar(out.balislam));
        expect(barOf(html).match(/btn primary/g), ch).toHaveLength(1);
      }
      expect(skeleton(out["dafatir-alzaman"])).toEqual(skeleton(out.balislam));
      expect(skeleton(out["zubdat-alkutub"])).toEqual(skeleton(out.balislam));
    });
  }

  it("في المراجعة «اعتمد» هو الزر الممتلئ الوحيد في شريط الأفعال لكل قناة", () => {
    for (const ch of CHANNELS) {
      const html = render(ch, "review");
      const bar = barOf(html);
      expect(bar.match(/btn primary/g), ch).toHaveLength(1);
      expect(actbar(bar)[0], ch).toBe("اعتمد المشهد");
      expect(bar, ch).toMatch(/<button[^>]*btn primary[^"]*"[^>]*>/);
    }
  });
});

describe("لا فرع بالقناة في واجهة الاعتماد", () => {
  // كل ما يرسم الخطوة ٣ وقراراتها، وسجل الاعتماد الوحيد في الخادم
  const approvalUi = [
    "app/src/workspace/SceneProductionPanel.tsx",
    "app/src/workspace/PrepareAll.tsx",
    "app/src/workspace/VoiceWorkspaceTab.tsx",
    "app/src/workspace/MakeMaster.tsx",
    "app/src/workspace/PreFinal.tsx",
    "app/src/workspace/sceneNames.ts",
    "app/src/shell/EpisodeSpine.tsx",
    "src/studio/preparation.ts",
    "app/src/shell/screens-s3.css",
    "app/src/workspace/scene-production.css",
    "src/studio/sceneProduction.ts",
    "src/studio/sceneService.ts",
    "src/studio/sceneLedgerStore.ts",
    "src/studio/sceneInputs.ts",
    "src/studio/sceneLedgerState.ts",
    "src/studio/sceneGates.ts",
    "src/studio/sceneDecisions.ts",
    "src/studio/prepareAll.ts",
  ];
  const channelLiteral = /["'`](balislam|dafatir-alzaman|zubdat-alkutub)["'`]/;
  // الهوية وحدها مسموحة في التنسيق: لون القناة عبر data-channel، بلا تغيير في التخطيط أو الظهور
  const COLOR_ONLY = /^(color|background|background-color|border-color|box-shadow|outline-color|--[\w-]+)$/;
  // مقارنة القناة بقيمة ثابتة (فرع)؛ أما مطابقة السجل لقناته («stored.channel !== current.channel») فحماية لا فرع
  const channelCompare = /\b(channelId|channel(\??\.id)?)\s*[!=]==\s*["'`]|["'`]\s*[!=]==\s*(channelId|channel(\??\.id)?)\b/;

  it("لا اسم قناة ولا مقارنة بالقناة في ملفات الخطوة ٣ وسجلها", () => {
    for (const file of approvalUi) {
      let text = src(file);
      if (file.endsWith(".css")) {
        for (const m of text.matchAll(/\[data-channel="[^"]+"\][^{]*\{([^}]*)\}/g))
          for (const decl of m[1]!.split(";").map((d) => d.trim()).filter(Boolean))
            expect(decl.split(":")[0]!.trim(), `${file}: ${m[0]}`).toMatch(COLOR_ONLY);
        text = text.replace(/[^{}]*\[data-channel="[^"]+"\][^{]*\{[^}]*\}/g, "");
      }
      expect(text, file).not.toMatch(channelLiteral);
      expect(text, file).not.toMatch(channelCompare);
    }
  });

  it("الاستوديو يرسم الخطوة ٣ بلوحة واحدة دون شرط قناة، والقناة تأتي بلونها من data-channel فقط", () => {
    const app = src("app/src/App.tsx");
    const step3 = app.slice(app.indexOf(') : tab === "episode" ? ('), app.indexOf("editor={(sceneId, onSelect)"));
    expect(step3).toContain("<SceneProductionPanel");
    expect(step3).not.toMatch(channelLiteral);
    expect(step3).not.toMatch(channelCompare);
    // ما يخص القناة في الخطوة ٣ محتوى معايير المراجعة من قواعد إنتاجها، لا شكل الشاشة
    expect(src("app/src/workspace/SceneProductionPanel.tsx")).toContain("channelProductionProfile({ id: channelId }).reviewFocus");
    // The channel lends its tokens (band, paper, accent, title face) through data-channel, never a layout
    const shell = src("app/src/shell/shell.css");
    for (const ch of CHANNELS) expect(shell, ch).toMatch(new RegExp(`\\[data-channel="${ch}"\\] \\{\\s*--band:`));
  });

  it("إعدادات القنوات لا تحمل مفتاحًا يبدّل شاشة الاعتماد أو وضع الإنتاج", () => {
    for (const ch of CHANNELS) {
      const cfg = JSON.parse(src(`channels/${ch}/channel.json`)) as Record<string, unknown>;
      for (const key of ["review", "reviewMode", "approval", "approvalMode", "studio", "productionMode", "legacyReview"])
        expect(cfg[key], `${ch}.${key}`).toBeUndefined();
    }
  });
});
