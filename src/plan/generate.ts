import { parseAyahRef, SURAH_NAMES } from "../script/quranMeta";
import type { ParsedScript } from "../script/types";
import { themeIdForDomain, type Domain } from "../../brand/themes";
import type { Plan, PlanChapter, PlanScene, PlanSfx } from "./types";
import { templateById } from "./templates";

const toArabicDigits = (n: number | string) => String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)] ?? d);

const firstSentence = (text: string, maxWords = 8) => {
  const s = text.split(/(?<=[.؟?!…])\s+/)[0] ?? text;
  const w = s.split(/\s+/).filter(Boolean);
  return w.length > maxWords ? `${w.slice(0, maxWords).join(" ")}…` : s;
};

const questionIn = (text: string) => text.split(/(?<=[.؟?!…])\s+/).find((s) => /[؟?]\s*$/.test(s));

/** خيارات العلامة: [مشهد: character-talk | pose=think | element=bell] */
const parseOptions = (options: string[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const o of options) {
    const [k, ...v] = o.split("=");
    if (k && v.length) out[k.trim()] = v.join("=").trim();
  }
  return out;
};

export const defaultsFor = (template: string, narration: string, ctx: { title: string; chapterTitle: string }): Record<string, string> => {
  switch (template) {
    case "big-question":
      return { question: questionIn(narration) ?? (ctx.chapterTitle.endsWith("؟") ? ctx.chapterTitle : ctx.title), highlight: "", element: "question-mark" };
    case "character-talk":
      return { line: firstSentence(narration), variant: "narrator-m", pose: "stand", element: "", side: "right" };
    case "summary":
      return { text: firstSentence(narration, 14) };
    default:
      return {};
  }
};

export type QuranTexts = Record<string, string>;

/**
 * يولّد خطة الحلقة من السكريبت:
 * - كل فقرة تعليق = مشهد. علامة [مشهد: …] تحدد قالب الفقرة التي تليها.
 * - [آية: …] مشهد بطاقة آية، [حديث: …] مشهد بطاقة حديث.
 * - bridge تُضم لتعليق المشهد السابق. [صوت: …] يُلحق بالمشهد التالي.
 * - إن مُررت خطة سابقة تُحفظ تعديلات المستخدم للمشاهد التي لم يتغير قالبها.
 */
export const generatePlan = (parsed: ParsedScript, previous?: Plan | null, quran: QuranTexts = {}): Plan => {
  const fm = (parsed.frontmatter ?? {}) as { title?: string; domain?: Domain; episode?: string };
  const domain: Domain = fm.domain ?? "psychology";
  const title = String(fm.title ?? "");
  const prevScenes = new Map((previous?.chapters ?? []).flatMap((c) => c.scenes).map((s) => [s.id, s]));

  const chapters: PlanChapter[] = parsed.chapters.map((ch) => {
    const scenes: PlanScene[] = [];
    let pending: { template: string; options: Record<string, string>; line: number } | null = null;
    let pendingSfx: PlanSfx[] = [];
    const push = (scene: Omit<PlanScene, "id" | "sfx">) => {
      const id = `c${ch.number}-s${scenes.length + 1}`;
      scenes.push({ ...scene, id, sfx: pendingSfx });
      pendingSfx = [];
    };

    for (const b of ch.blocks) {
      if (b.kind === "scene") {
        if (pending) push({ template: pending.template, narration: "", line: pending.line, props: { ...defaultsFor(pending.template, "", { title, chapterTitle: ch.title }), ...pending.options } });
        pending = { template: b.template, options: parseOptions(b.options), line: b.line };
      } else if (b.kind === "narration") {
        const template = pending?.template ?? "character-talk";
        const options = pending?.options ?? {};
        push({ template, narration: b.text, line: pending?.line ?? b.line, props: { ...defaultsFor(template, b.text, { title, chapterTitle: ch.title }), ...options } });
        pending = null;
      } else if (b.kind === "bridge") {
        const last = scenes[scenes.length - 1];
        if (last) last.narration = `${last.narration} ${b.text}`.trim();
      } else if (b.kind === "sfx") {
        pendingSfx.push({ id: b.id, at: 0 });
      } else if (b.kind === "ayah") {
        const r = parseAyahRef(b.ref);
        const key = r.ok ? r.ref.key : undefined;
        const surah = r.ok ? SURAH_NAMES[r.ref.surah - 1] : "";
        const reference = r.ok ? `${surah} · ${toArabicDigits(r.ref.from)}${r.ref.to !== r.ref.from ? `–${toArabicDigits(r.ref.to)}` : ""}` : b.ref;
        push({
          template: "verse-card",
          narration: "",
          line: b.line,
          ayahKey: key,
          props: { text: (key && quran[key]) || "‹نص الآية يُجلب من Quran Foundation›", reference, reciter: "" },
        });
      } else if (b.kind === "hadith") {
        push({ template: "hadith-card", narration: "", line: b.line, props: { text: "", reference: b.ref } });
      }
    }
    if (pending) push({ template: pending.template, narration: "", line: pending.line, props: { ...defaultsFor(pending.template, "", { title, chapterTitle: ch.title }), ...pending.options } });
    const last = scenes[scenes.length - 1];
    if (last && pendingSfx.length) last.sfx.push(...pendingSfx);

    // دمج تعديلات المستخدم السابقة
    for (const s of scenes) {
      const old = prevScenes.get(s.id);
      if (old && old.edited && old.template === s.template) {
        s.props = { ...s.props, ...old.props };
        if (s.template === "verse-card" && s.ayahKey && quran[s.ayahKey]) s.props.text = quran[s.ayahKey]!;
        s.durationSec = old.durationSec;
        s.backdrop = old.backdrop;
        s.captions = old.captions;
        s.edited = true;
      }
      if (!templateById(s.template)) s.props.unknownTemplate = "1";
    }
    return { number: ch.number, title: ch.title, scenes };
  });

  return {
    version: 1,
    episode: String(fm.episode ?? previous?.episode ?? ""),
    title,
    domain,
    themeId: themeIdForDomain(domain),
    updatedAt: new Date().toISOString(),
    chapters,
  };
};
