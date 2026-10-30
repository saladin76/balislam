import { beatsFor, beatsToText } from "./beats";
import { normalizeArabic, parseAyahRef, surahNameFor, toLatinDigits } from "../script/quranMeta";
import type { ParsedScript } from "../script/types";
import type { Domain } from "../../brand/themes";
import { defaultChannel, themeIdForDomainIn, type ChannelConfig } from "../channel/types";
import { langPack, localDigits } from "../i18n/packs";
import type { Plan, PlanChapter, PlanScene, PlanSfx } from "./types";
import { templateById } from "./templates";


const firstSentence = (text: string, maxWords = 8) => {
  const s = text.split(/(?<=[.؟?!…])\s+/)[0] ?? text;
  const w = s.split(/\s+/).filter(Boolean);
  return w.length > maxWords ? `${w.slice(0, maxWords).join(" ")}…` : s;
};

const questionIn = (text: string) => text.split(/(?<=[.؟?!…])\s+/).find((s) => /[؟?]\s*$/.test(s));

const MULTILINE = new Set(["items", "rightItems", "leftItems", "events", "data"]);

/** خيارات العلامة: [مشهد: character-talk | pose=think | element=bell] */
const parseOptions = (options: string[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const o of options) {
    const [k, ...v] = o.split("=");
    // الحقول متعددة الأسطر تُكتب في سطر العلامة مفصولة بـ «؛»
    if (k && v.length) out[k.trim()] = MULTILINE.has(k.trim()) ? v.join("=").split("؛").map((x) => (k.trim() === "events" ? x.replace(/\s*—\s*/, " | ") : x).trim()).filter(Boolean).join("\n") : v.join("=").trim();
  }
  return out;
};

export const defaultsFor = (template: string, narration: string, ctx: { title: string; chapterTitle: string }): Record<string, string> => {
  switch (template) {
    case "big-question":
      return { question: questionIn(narration) ?? (ctx.chapterTitle.endsWith("؟") ? ctx.chapterTitle : ctx.title), highlight: "", element: "question-mark" };
    case "character-talk":
      return { line: firstSentence(narration), variant: "narrator-m", pose: "stand", element: "", side: "" };
    case "summary":
      return { text: firstSentence(narration, 14) };
    case "board-story":
      return { beats: beatsToText(beatsFor(narration)), board: "white" };
    case "glow-story":
      return { quote: firstSentence(narration, 8), highlight: "", wish: "sports-car", subjectElement: "", variant: "narrator-m", pose: "think", sideElement: "", sideGlow: "none", connector: "dotted" };
    case "sketch-board":
      return { title: ctx.chapterTitle, keyword: "", element: "lightbulb", items: "", board: "white" };
    case "kinetic-text":
      return { emphasis: "", element: "", stage: "theme" };
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
export const generatePlan = (parsed: ParsedScript, previous?: Plan | null, quran: QuranTexts = {}, channel: ChannelConfig = defaultChannel): Plan => {
  const fm = (parsed.frontmatter ?? {}) as { title?: string; domain?: Domain; episode?: string; lang?: string; style?: string };
  // أسلوب الحلقة: المشاهد التي بلا علامة تُعرض بالسبورة المتصلة أو بالشخصية المتكلمة
  const defaultTemplate = fm.style === "board" ? "board-story" : "character-talk";
  const domain: Domain = fm.domain ?? Object.keys(channel.domains)[0] ?? "general";
  const title = String(fm.title ?? "");
  // اسم القارئ من الاستشهادات: «- آية | النجم 39 | القارئ: فلان»
  const reciterFor = (key: string | undefined) => {
    if (!key) return "";
    for (const c of parsed.citations) {
      if (c.kind !== "ayah") continue;
      const r = parseAyahRef(c.fields[0] ?? "");
      const name = (c.fields.find((f) => f.startsWith("القارئ")) ?? "").replace(/^القارئ\s*:\s*/, "").trim();
      if (r.ok && r.ref.key === key && name && name !== "…" && name !== "...") return name;
    }
    return "";
  };
  const L = langPack(fm.lang ?? channel.language);
  const digits = (x: number | string) => localDigits(x, L);
  const prevList = (previous?.chapters ?? []).flatMap((c) => c.scenes);
  const prevScenes = new Map(prevList.map((s) => [s.id, s]));
  /**
   * بصمة المشهد من محتواه لا من ترتيبه: إن أُضيفت فقرة في منتصف الفصل تتغير أرقام المشاهد،
   * لكن تعديلات كل مشهد تبقى معه.
   */
  const fingerprint = (s: Pick<PlanScene, "template" | "narration" | "ayahKey" | "props">) =>
    s.narration.trim() ? `n:${s.narration.trim()}` : s.ayahKey ? `a:${s.ayahKey}` : s.template === "hadith-card" ? `h:${s.props.reference ?? ""}` : `t:${s.template}:${s.props.title ?? s.props.question ?? ""}`;
  const usedOld = new Set<string>();
  const byPrint = new Map<string, PlanScene[]>();
  for (const s of prevList) byPrint.set(fingerprint(s), [...(byPrint.get(fingerprint(s)) ?? []), s]);
  const scenesAll: PlanScene[] = [];

  const chapters: PlanChapter[] = parsed.chapters.map((ch) => {
    const scenes: PlanScene[] = [];
    let pending: { template: string; options: Record<string, string>; line: number } | null = null;
    let pendingSfx: PlanSfx[] = [];
    const push = (scene: Omit<PlanScene, "id" | "sfx">) => {
      const id = `c${ch.number}-s${scenes.length + 1}`;
      const made = { ...scene, id, sfx: pendingSfx };
      scenes.push(made);
      scenesAll.push(made);
      pendingSfx = [];
    };

    for (const b of ch.blocks) {
      if (b.kind === "scene") {
        if (pending) push({ template: pending.template, narration: "", line: pending.line, props: { ...defaultsFor(pending.template, "", { title, chapterTitle: ch.title }), ...pending.options } });
        pending = { template: b.template, options: parseOptions(b.options), line: b.line };
      } else if (b.kind === "narration") {
        const template = pending?.template ?? defaultTemplate;
        const options = pending?.options ?? {};
        push({ template, narration: b.text, line: pending?.line ?? b.line, props: { ...defaultsFor(template, b.text, { title, chapterTitle: ch.title }), ...options } });
        pending = null;
      } else if (b.kind === "bridge") {
        // جملة الربط تُضم لآخر مشهد متكلَّم؛ وإن كان آخر مشهد بطاقة آية أو حديث فلها مشهد قصير خاص
        const last = scenes[scenes.length - 1];
        if (last && last.narration) last.narration = `${last.narration} ${b.text}`.trim();
        else push({ template: defaultTemplate, narration: b.text, line: b.line, props: { ...defaultsFor(defaultTemplate, b.text, { title, chapterTitle: ch.title }), ...(defaultTemplate === "character-talk" ? { pose: "point" } : {}) } });
      } else if (b.kind === "sfx") {
        pendingSfx.push({ id: b.id, at: 0 });
      } else if (b.kind === "ayah") {
        const r = parseAyahRef(b.ref);
        const key = r.ok ? r.ref.key : undefined;
        const surah = r.ok ? surahNameFor(r.ref.surah, L.code) : "";
        const ayahs = r.ok ? `${digits(r.ref.from)}${r.ref.to !== r.ref.from ? `–${digits(r.ref.to)}` : ""}` : "";
        // العربية: «النجم · ٣٩»، وغيرها: «An-Najm · 53:39»
        const reference = !r.ok ? b.ref : L.code === "ar" ? `${surah} · ${ayahs}` : `${surah} · ${r.ref.surah}:${ayahs}`;
        push({
          template: "verse-card",
          narration: "",
          line: b.line,
          ayahKey: key,
          props: {
            text: (key && quran[key]) || "‹نص الآية يُجلب من Quran Foundation›",
            reference,
            reciter: reciterFor(key),
            ...(key && quran[`${key}#meaning`] ? { meaning: quran[`${key}#meaning`], meaningSource: channel.quranTranslation?.name ?? "" } : {}),
          },
        });
      } else if (b.kind === "hadith") {
        const norm = (x: string) => normalizeArabic(toLatinDigits(x)).replace(/\s+/g, " ").trim();
        const cite = parsed.citations.find((c) => c.kind === "hadith" && norm(c.fields[0] ?? "") === norm(b.ref));
        // «حسن لغيره» و«حسن صحيح»… كلها حسن؛ والبطاقة لا تعرض «صحيح» إلا لما نُص عليه صحيحًا
        const gradeText = normalizeArabic(cite?.fields[1] ?? "");
        const grade = gradeText.includes("حسن") ? "حسن" : "صحيح";
        push({
          template: "hadith-card",
          narration: "",
          line: b.line,
          props: { text: b.text ?? "", narrator: b.narrator ?? "", reference: digits(b.ref), grade },
        });
      }
    }
    if (pending) push({ template: pending.template, narration: "", line: pending.line, props: { ...defaultsFor(pending.template, "", { title, chapterTitle: ch.title }), ...pending.options } });
    const last = scenes[scenes.length - 1];
    if (last && pendingSfx.length) last.sfx.push(...pendingSfx);

    for (const s of scenes) if (!templateById(s.template)) s.props.unknownTemplate = "1";
    return { number: ch.number, title: ch.title, scenes };
  });

  // دمج تعديلات المستخدم السابقة: أولًا بالمحتوى المطابق، ثم بالموضع لمشهد عُدّل نصه
  const matches = new Map<PlanScene, PlanScene>();
  for (const s of scenesAll) {
    const same = (byPrint.get(fingerprint(s)) ?? []).filter((o) => !usedOld.has(o.id));
    const hit = same.find((o) => o.id === s.id) ?? same[0];
    if (hit) {
      usedOld.add(hit.id);
      matches.set(s, hit);
    }
  }
  const newPrints = new Set(scenesAll.map(fingerprint));
  for (const s of scenesAll) {
    if (matches.has(s)) continue;
    const pos = prevScenes.get(s.id);
    // لا نأخذ مشهدًا قديمًا ما زال محتواه موجودًا في مكان آخر (أي أنه انزاح ولم يُعدَّل)
    if (pos && !usedOld.has(pos.id) && pos.template === s.template && !newPrints.has(fingerprint(pos))) {
      usedOld.add(pos.id);
      matches.set(s, pos);
    }
  }
  for (const s of scenesAll) {
    const old = matches.get(s);
    if (!old) continue;
    if (old.edited && old.template === s.template) {
      const fresh = s.props;
      s.props = { ...fresh, ...old.props };
      // نصوص الآية والحديث ومراجعها من المصدر دائمًا، لا من تعديل قديم
      for (const k of ["text", "reference", "meaning", "meaningSource", "narrator", "grade"])
        if (s.template === "verse-card" || s.template === "hadith-card") {
          if (k in fresh) s.props[k] = fresh[k]!;
          else delete s.props[k];
        }
      s.durationSec = old.durationSec;
      s.backdrop = old.backdrop;
      s.captions = old.captions;
      s.edited = true;
    }
    // إظهار/إخفاء عناصر الشاشة يبقى حتى لو تغيّر القالب
    if (old.overlays && Object.keys(old.overlays).length) s.overlays = { ...old.overlays };
  }

  // شاشة النهاية: آخر مشهد في الحلقة، من «الخطوة العملية»
  const lastChapter = chapters[chapters.length - 1];
  if (lastChapter) {
    const id = `c${lastChapter.number}-end`;
    const old = prevScenes.get(id);
    const step = parsed.practicalStep?.text ?? "";
    const questionLine = step.split(/(?<=[.؟?!])\s+/).find((x) => /[؟?]\s*$/.test(x)) ?? "";
    const scene: PlanScene = {
      id,
      template: "end-screen",
      narration: "",
      line: parsed.practicalStep?.line ?? 1,
      props: { step: step.replace(questionLine, "").trim() || step, prompt: questionLine ? `${L.strings.commentPrompt} ${questionLine}` : L.strings.shareOpinion },
      captions: false,
      sfx: [],
    };
    if (old?.edited && old.template === "end-screen") {
      scene.props = { ...scene.props, ...old.props };
      scene.durationSec = old.durationSec;
      scene.backdrop = old.backdrop;
      scene.edited = true;
    }
    if (old?.overlays && Object.keys(old.overlays).length) scene.overlays = { ...old.overlays };
    lastChapter.scenes.push(scene);
  }

  return {
    version: 1,
    episode: String(fm.episode ?? previous?.episode ?? ""),
    title,
    domain,
    themeId: themeIdForDomainIn(channel, domain),
    channel: channel.id,
    lang: fm.lang ?? channel.language,
    updatedAt: new Date().toISOString(),
    ...(previous?.overlays && Object.keys(previous.overlays).length ? { overlays: { ...previous.overlays } } : {}),
    chapters,
  };
};
