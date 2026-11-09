import React from "react";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { templateById } from "../src/plan/templates";
import type { Plan, PlanScene } from "../src/plan/types";
import {
  anchorFor, lineValue, parseLines, phraseFrom, phraseSpoken, resolveAnchor, sentenceTokens, setEventLine, setLine, slotRows, slotState, visibleFields, writeSlot,
} from "../src/plan/sceneSlots";
import { makeAt, makeEnd } from "../src/remotion/zubdat/inkKit";
import { parseInkArgs } from "../src/remotion/zubdat/kitShots";
import { at as hzAt, buildTimeline } from "../src/remotion/dafatir/horizon/timeline";
import { HZ_LEAD, hzSentences } from "../src/remotion/dafatir/horizon/meta";
import { cueFrames, parseCues } from "../src/plan/sceneCues";
import { kitPhraseRange } from "../src/remotion/zubdat/kitSlots";

/** «إعدادات المشهد» للمالك (D54): الحقول من تصريحات القالب، والمراسي بالنقر تُكتب بالصيغة التي يقرؤها الرسم. */

const PLANS = readdirSync("channels").flatMap((ch) =>
  existsSync(`channels/${ch}/episodes`) ? readdirSync(`channels/${ch}/episodes`).filter((e) => existsSync(`channels/${ch}/episodes/${e}/plan.json`)).map((e) => `channels/${ch}/episodes/${e}/plan.json`) : [],
);
const load = (p: string) => JSON.parse(readFileSync(p, "utf8")) as Plan;
const scenesOf = (p: Plan) => p.chapters.flatMap((c) => c.scenes);
const keys = (fs: { key: string }[]) => fs.map((f) => f.key);
const vis = (template: string, props: Record<string, string>, closing = false) => visibleFields(templateById(template)!, props, { closing });

describe("ما يظهر: من تصريحات القالب ومشهده", () => {
  it("أداة الاستوديو تعرض عباراتها وتوقيتها، ولا تعرض مهمة الحلقة", () => {
    const { shown, other } = vis("ink-shot", { shot: "kit-meter" });
    expect(keys(shown)).toEqual(["shot", "labels", "cues"]);
    expect(keys(other)).toEqual(["task"]);
  });
  it("مشهد حبر خاص بجملته لا يعرض حقول الأدوات", () => {
    expect(keys(vis("ink-shot", { shot: "habit-heart" }).shown)).toEqual(["shot"]);
  });
  it("مهمة الحلقة تظهر في مشهد الخاتمة وحده (آخر مشهد أو مشهد يعلن أنه خاتمة)", () => {
    expect(keys(vis("ink-shot", { shot: "outro" }).shown)).toContain("task");
    expect(keys(vis("ink-shot", { shot: "habit-heart" }, true).shown)).toContain("task");
    expect(keys(vis("ink-shot", { shot: "habit-heart" }, false).shown)).not.toContain("task");
  });
  it("دفتر الأفق: حقول المشهد العام وحده، والحقول العامة، وما له قيمة مما يقرؤه الرسم", () => {
    const { shown, other } = vis("horizon-shot", { shot: "lib-term" });
    expect(keys(shown)).toEqual(expect.arrayContaining(["shot", "head", "from", "exit", "term", "termWord", "sub", "subWord", "kind", "source", "sourceWord", "note", "noteWord"]));
    expect(keys(other)).toEqual(expect.arrayContaining(["tafsir", "aWord", "items", "idea"]));
    expect(keys(vis("horizon-shot", { shot: "nations", ref: "البقرة ٣٠" }).shown)).toContain("ref");
    expect(keys(vis("horizon-shot", { shot: "nations" }).shown)).not.toContain("ref");
  });
  it("حكايات الحارة: اللقطة المصمَّمة تعرض ما تقرؤه وحده، وبلا لقطة تبقى الحقول كلها", () => {
    expect(keys(vis("alley-tale", { shot: "souq-two-verdicts", place: "market", mood: "night" }).shown)).toEqual(["cameraMode", "shot", "cues"]);
    const all = templateById("alley-tale")!.fields.length;
    expect(vis("alley-tale", { shot: "" }).shown.length).toBe(all);
  });
  it("قالب بلا «مشهد» يعرض حقوله كلها كما كان، ولا يضيع حقل: الظاهر والمخفي معًا هما حقول القالب", () => {
    expect(vis("verse-card", {}).other).toEqual([]);
    for (const [t, shot] of [["ink-shot", "kit-ideas"], ["horizon-shot", "lib-gloss"], ["alley-tale", "cafe-news-agrees"]] as const) {
      const { shown, other } = vis(t, { shot });
      expect([...keys(shown), ...keys(other)].sort()).toEqual(keys(templateById(t)!.fields).sort());
    }
  });
  it("عدد العبارات لكل أداة من مصدر واحد (المحرر والفحص)", () => {
    expect(kitPhraseRange("kit-ideas")).toEqual([2, 5]);
    expect(kitPhraseRange("kit-shift")).toEqual([2, 2]);
    expect(kitPhraseRange("kit-meter")).toEqual([0, 3]);
  });
});

describe("النقر على كلمة يكتب ما يقرؤه الرسم نفسه", () => {
  const narr = "هَذَا نَصٌّ لِلِاخْتِبَارِ: كُلَّمَا أَعَدْنَا الْفِكْرَةَ وَكَتَبْنَاهَا، ارْتَفَعَ حُضُورُهَا فِي الذِّهْنِ. وَإِذَا تَرَكْنَاهَا طَوِيلًا، انْخَفَضَ حُضُورُهَا.";
  it("الكلمة المكررة تأخذ «#٢» تلقائيًا، والأولى بلا رقم", () => {
    const t = sentenceTokens(narr);
    const idx = t.map((x, i) => (x.raw.startsWith("حُضُورُهَا") ? i : -1)).filter((i) => i >= 0);
    expect(idx.length).toBe(2);
    expect(anchorFor(t, idx[0]!, "ink")).toBe("حضورها");
    expect(anchorFor(t, idx[1]!, "ink")).toBe("حضورها#2");
    expect(resolveAnchor(t, "حضورها#2", "ink")).toBe(idx[1]);
  });
  it("أسطر التوقيت: سطر المفتاح وحده يتغير، والصيغة «المفتاح | الكلمة»", () => {
    const text = "rise | ارتفع\nfall | انخفض\nsubject | حضورها";
    expect(setLine(text, "fall", "انخفض#2")).toBe("rise | ارتفع\nfall | انخفض#2\nsubject | حضورها");
    expect(setLine(text, "cross", "ليس")).toBe(`${text}\ncross | ليس`);
    expect(setLine(text, "fall", "")).toBe("rise | ارتفع\nsubject | حضورها");
    expect(setLine("", "to", "قراءة")).toBe("to | قراءة");
    expect(parseInkArgs("", setLine(text, "rise.end", "حضورها")).cues["rise.end"]).toBe("حضورها");
  });
  it("أحداث «المعنى | الكلمة»: إضافة سطر وحذفه دون لمس غيره", () => {
    const t = "memory | بتجاربنا\npeople | والأشخاص";
    expect(setEventLine(t, null, "memory", "والأفكار")).toBe(`${t}\nmemory | والأفكار`);
    expect(setEventLine(t, 0, "memory", "")).toBe("people | والأشخاص");
  });

  /** كل كلمة في كل جملة حقيقية في القنوات الثلاث: المرسى يقع عند الكلمة نفسها في الرسم */
  const all = PLANS.flatMap((p) => scenesOf(load(p)).filter((s) => s.narration?.trim()).map((s) => ({ p, s })));
  it("مشاهد الحبر (makeAt/makeEnd): كل كلمة", () => {
    let n = 0;
    for (const { s } of all) {
      const t = sentenceTokens(s.narration);
      const timings = t.map((x, i) => ({ word: x.raw, start: i * 10, end: i * 10 + 5 }));
      const at = makeAt(timings, 9999);
      const end = makeEnd(timings, 9999);
      t.forEach((_, i) => {
        const [w, k] = anchorFor(t, i, "ink").split("#");
        expect(at(w!, -1, Number(k) || 1), `${s.id} ${i}`).toBe(i * 10);
        const [we, ke] = anchorFor(t, i, "ink", true).split("#");
        expect(end(we!, -1, Number(ke) || 1), `${s.id} end ${i}`).toBe(i * 10 + 5);
        n++;
      });
    }
    expect(n).toBeGreaterThan(500);
  });
  it("دفتر الأفق (at بالبادئة): كل كلمة", () => {
    let n = 0;
    for (const { s } of all) {
      const t = sentenceTokens(s.narration);
      const tl = buildTimeline(hzSentences(s.narration), HZ_LEAD);
      if (tl.words.length !== t.length) continue;
      t.forEach((_, i) => {
        const [w, k] = anchorFor(t, i, "prefix").split("#");
        expect(hzAt(tl, w!, Number(k) || 1), `${s.id} ${i}`).toBe(tl.words[i]!.s);
        n++;
      });
    }
    expect(n).toBeGreaterThan(500);
  });
  it("أحداث الحارة (أول نطق): المرسى يقع عند أول نطق للكلمة المنقورة", () => {
    for (const { s } of all.slice(0, 60)) {
      const t = sentenceTokens(s.narration);
      const timings = t.map((x, i) => ({ word: x.raw, start: i * 10 }));
      t.forEach((_, i) => {
        const w = anchorFor(t, i, "first");
        const hit = cueFrames(parseCues(`truth | ${w}`), timings)[0];
        expect(hit?.at, `${s.id} ${i}`).toBe(resolveAnchor(t, w, "first") * 10);
      });
    }
  });
});

describe("العبارات من الجملة نفسها", () => {
  const narr = "يَبْدَأُ الْكِتَابُ مِنْ ثَلَاثِ فِكَرٍ: الْخَاطِرُ يَمُرُّ سَرِيعًا، وَمَا لَا يُكْتَبُ يَضِيعُ، وَالْكِتَابَةُ تَحْفَظُهُ.";
  it("عبارة مختارة من كلمات متتالية تُكتب بلا حركات ولا ترقيم، وهي منطوقة حرفيًا", () => {
    const t = sentenceTokens(narr);
    const ph = phraseFrom(t, 5, 7);
    expect(ph).toBe("الخاطر يمر سريعا");
    expect(phraseSpoken(narr, ph)).toBe(true);
    expect(phraseFrom(t, 7, 5)).toBe(ph);
  });
  it("عبارة غير منطوقة أو غير متتالية مرفوضة", () => {
    expect(phraseSpoken(narr, "الخاطر سريعا")).toBe(false);
    expect(phraseSpoken(narr, "الفكرة تهرب")).toBe(false);
  });
  it("كل عبارة في خطط القناة الحالية منطوقة حرفيًا في جملتها", () => {
    for (const p of PLANS) for (const s of scenesOf(load(p))) if (s.template === "ink-shot" && s.props.labels) for (const l of s.props.labels.split("|").map((x) => x.trim()).filter(Boolean)) expect(phraseSpoken(s.narration, l), `${s.id} «${l}»`).toBe(true);
  });
});

describe("التوافق مع الخطط القائمة (القنوات الثلاث)", () => {
  it("فتح كل مشهد وكتابة كل مرسى بقيمته نفسها لا يغير الخطة بايتًا واحدًا", () => {
    let rows = 0;
    for (const p of PLANS) {
      const raw = readFileSync(p, "utf8");
      const plan = JSON.parse(raw) as Plan;
      for (const s of scenesOf(plan)) {
        const def = templateById(s.template);
        if (!def) continue;
        const shown = visibleFields(def, s.props, { closing: false }).shown;
        let props = { ...s.props } as Record<string, string | undefined>;
        for (const r of slotRows(def, s.props, shown)) {
          if (!r.value) continue;
          props = writeSlot(props, r, r.value);
          rows++;
        }
        (s as PlanScene).props = props as Record<string, string>;
        for (const l of parseLines(s.props.cues)) expect(setLine(s.props.cues, l.key, lineValue(s.props.cues, l.key))).toBe(s.props.cues);
      }
      // الكائن نفسه يُكتب بالبايتات نفسها مهما كان التنسيق الذي يحفظ به الخادم
      expect(JSON.stringify(plan)).toBe(JSON.stringify(JSON.parse(raw)));
    }
    expect(rows).toBeGreaterThan(5);
  });
  it("المراسي المكتوبة في الخطط تقع على كلمات من جملتها (أو تظهر تنبيهًا لا تُخفى)", () => {
    for (const p of PLANS)
      for (const s of scenesOf(load(p))) {
        const def = templateById(s.template);
        if (!def || !s.narration) continue;
        const t = sentenceTokens(s.narration);
        for (const r of slotRows(def, s.props, visibleFields(def, s.props, { closing: false }).shown)) {
          const st = slotState(t, r);
          if (r.value) expect(st.at >= 0 || st.stray, `${s.id} ${r.key}`).toBe(true);
        }
      }
  });
});

vi.mock("@remotion/player", async (orig) => ({ ...((await orig()) as object), Player: () => null, Thumbnail: () => null }));
const { SceneSettings } = await import("../app/src/workspace/SceneSettings");

describe("المحرر نفسه", () => {
  const ink = load("channels/zubdat-alkutub/episodes/980-kit-lab/plan.json");
  const meter = scenesOf(ink).find((s) => s.props.shot === "kit-meter")!;
  const render = (scene: PlanScene, plan: Plan, closing = false) => {
    const onProps = vi.fn();
    const html = renderToStaticMarkup(
      <SceneSettings def={templateById(scene.template)!} scene={scene} plan={plan} identity={{} as never} channel={{ id: plan.channel ?? "x" } as never} media={{ voice: {} } as never} eyebrow="" closing={closing} onProps={onProps} onConfirm={() => {}} renderField={(f) => <label data-field={f.key}>{f.label}</label>} />,
    );
    return { html, onProps };
  };
  it("يعرض الجملة كلمات تُنقر، وأسماء اللحظات بالعربية، بلا مفاتيح داخلية في النص", () => {
    const { html, onProps } = render(meter, ink);
    expect(html).toContain("متى يظهر كل عنصر");
    expect(html).toContain("الارتفاع");
    expect(html).toContain("العبارات على الشاشة");
    expect(html).toContain('class="ss-word');
    const text = html.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/\b(rise|fall|subject|idea\d|kit-\w+)\b/);
    // مهمة الحلقة ليست ظاهرة: هي تحت «المزيد · حقول لا يستعملها هذا المشهد» وحدها
    const [main, more] = html.split('class="ss-more"');
    expect(main).not.toContain('data-field="task"');
    expect(more).toContain('data-field="task"');
    expect(onProps).not.toHaveBeenCalled();
  });
  it("الخاتمة تعرض مهمة الحلقة", () => {
    const z = load("channels/zubdat-alkutub/episodes/001-awwal-marra-osalli/plan.json");
    const outro = scenesOf(z).find((s) => s.props.shot === "outro")!;
    expect(render(outro, z, true).html).toContain('data-field="task"');
  });
  it("المشهد المختار آليًا عليه علامة «اختير آليًا»، والمعدَّل يدويًا بلا علامة", () => {
    expect(render({ ...meter, edited: undefined }, ink).html).toContain("اختير آليًا");
    expect(render({ ...meter, edited: true }, ink).html).not.toContain("اختير آليًا");
  });
  it("لا فرع بالقناة في المحرر ومنطقه", () => {
    for (const f of ["app/src/workspace/SceneSettings.tsx", "src/plan/sceneSlots.ts", "src/plan/wordClock.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/["'`](balislam|dafatir-alzaman|zubdat-alkutub)["'`]|channel\.id|channelId/);
    }
  });
});
