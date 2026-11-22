import type { Plan, PlanScene, PlanSfx } from "./types";
import type { EpisodeMedia } from "./media";
import { sceneSeconds } from "./duration";
import { isSacredSentence } from "./sceneCues";
import { sceneSacredSpans, SACRED_TEMPLATES } from "./sfxMix";
import { estimateTimings, splitWords } from "../remotion/scenes/timing";
import { normalizeArabic } from "../script/quranMeta";

/**
 * D158 الخطوة ٣ (قرار المالك ٢٠ نوفمبر): الاستوديو يقترح المؤثرات بالقواعد الست، والمالك يسمع ويعتمد.
 * الاقتراح من كلام الراوي نفسه (القنوات الثلاث) ومن مكان المشهد («بالإسلام»)، موقوتًا بالكلمة التي تُقال؛
 * لا يمس ما وضعه المالك، ولا يقترح في مشهد مقدس ولا داخل نافذة ذكر الله، وله حد في المشهد وفي الدقيقة.
 */
/** perScene وperMinute بلا الانتقال وصوت المكان؛ perEpisode لكل مؤثر (لا تكرار)؛ والانتقال بين ٢٠ و٤٥ ث */
export const SUGGEST = { perScene: 2, perMinute: 8, perEpisode: 3, leadIn: 0.05, transitionGap: 20, transitionEvery: 45 } as const;

/** الانتقال بطابع القناة (القاعدة ١): أول الفصل وعند تغيّر المكان، لا عند كل قطع */
export const TRANSITION: Record<string, string> = { "dafatir-alzaman": "page-turn", "zubdat-alkutub": "page-turn", balislam: "whoosh-soft" };
/** صوت المكان (القاعدة ٢) لقالب «حكايات الحارة» */
export const PLACE_AMBIENCE: Record<string, string> = { market: "market-crowd", alley: "crowd-murmur", home: "clock-tick" };
/** كلمة يقولها الراوي ← صوتها (القاعدتان ٢ و٣)؛ الجذر يُطابَق بعد تطبيع الهمزات والتشكيل */
export const WORD_SFX: [RegExp, string][] = [
  [/(^|[وفبل])(ال)?سوق/, "market-crowd"], [/(^|[وفبل])(ال)?ليل/, "night-crickets"], [/صحراء|رمال|قافل/, "wind"],
  [/(^|[وفبل])(ال)?(بحر|سفين)/, "waves"], [/دجل|فرات|النيل|نهر|انهار/, "water-stream"], [/(^|[وفبل])(ال)?مطر/, "rain"],
  [/ميزان|موازين/, "scale-balance"], [/دراهم|دنانير|دينار|درهم/, "coin-drop"],
  [/(^|[وفبل])(ال)?باب$/, "door-open"], [/طرق(ت)? الباب|يطرق/, "knock"], [/(^|[وفبل])(ال)?قلم|كتب بيده/, "pen-write"],
  [/صفح(ه|ة|ات)/, "page-turn"], [/ختم/, "stamp"], [/خطوات|مشى|يمشي/, "footsteps"], [/(^|[وفبل])(ال)?(ريح|عاصف)/, "wind"],
  [/رعد/, "thunder-far"], [/زحام|حشود|جموع/, "crowd-murmur"],
];

const norm = (w: string) => normalizeArabic(w).replace(/[^\u0621-\u064A]/g, "");

export type Suggestion = { scene: string; sfx: PlanSfx; why: string };

/** كلمات المشهد بتوقيتها: من صوت الراوي إن طابق نصه، وإلا تقدير على مدة المشهد */
const wordTimes = (scene: PlanScene, media: Pick<EpisodeMedia, "voice" | "recitations">) => {
  const clip = media.voice[scene.id];
  if (clip && clip.text === scene.narration.trim() && clip.words.length) return { words: clip.words.map((w) => ({ word: w.word, start: w.start })), real: true };
  const d = sceneSeconds(scene, media), fps = 30;
  const t = estimateTimings(scene.narration, 0, Math.round(d * fps));
  return { words: splitWords(scene.narration).map((w, i) => ({ word: w, start: (t[i]?.start ?? 0) / fps })), real: false };
};

export const suggestSfx = (plan: Plan, media: Pick<EpisodeMedia, "voice" | "recitations">, library: ReadonlySet<string>): Suggestion[] => {
  const out: Suggestion[] = [];
  const all = plan.chapters.flatMap((c) => c.scenes.map((s, i) => ({ s, first: i === 0 })));
  let lastPlace: unknown;
  let lastTransition = -Infinity;
  const used = new Map<string, number>();
  let clock = 0; const perMinute = new Map<number, number>();
  const room = (at: number) => { const m = Math.floor(at / 60); return (perMinute.get(m) ?? 0) < SUGGEST.perMinute ? (perMinute.set(m, (perMinute.get(m) ?? 0) + 1), true) : false; };
  all.forEach(({ s, first }, idx) => {
    const d = sceneSeconds(s, media);
    const start = clock; clock += d;
    const place = (s.props as Record<string, unknown>).place;
    // بطاقة الآية ولوح الدعاء بلا مؤثر؛ وما وضعه المالك لا يُمس
    if (SACRED_TEMPLATES.has(s.template) || s.sfx.length) { lastPlace = place ?? lastPlace; return; }
    // قاعدة التوقير جملةً جملة: لا مؤثر في جملة فيها ذكر الله أو دعاء أو آية
    const sentences = (s.narration.match(/[^.؟!:]+[.؟!:]?/g) ?? []).map((x) => x.trim()).filter(Boolean);
    const sacredWord = new Set<number>(); let k = 0;
    for (const sen of sentences) { const n = splitWords(sen).length; if (isSacredSentence(sen)) for (let j = k; j < k + n; j++) sacredWord.add(j); k += n; }
    const openingSacred = sacredWord.has(0);
    const spans = sceneSacredSpans(s, all[idx + 1]?.s, media, plan.channel);
    const free = (t: number) => !spans.some((w) => t >= w.from - 0.25 && t <= w.to + 0.25);
    const picked: Suggestion[] = [];
    const add = (id: string, at: number, why: string, counts = true) => {
      if (!library.has(id) || picked.some((p) => p.sfx.id === id) || !free(at)) return;
      if (why.startsWith("«") && (used.get(id) ?? 0) >= SUGGEST.perEpisode) return;
      if (counts && (picked.filter((p) => p.why.startsWith("«")).length >= SUGGEST.perScene || !room(start + at))) return;
      picked.push({ scene: s.id, sfx: { id, at: Math.max(0, Math.round(at * 100) / 100) }, why });
      used.set(id, (used.get(id) ?? 0) + 1);
    };
    const tr = TRANSITION[plan.channel ?? ""];
    const since = start - lastTransition;
    const placeChanged = place !== undefined && place !== lastPlace;
    if (tr && !openingSacred && (first || (placeChanged && since >= SUGGEST.transitionGap) || since >= SUGGEST.transitionEvery)) {
      const n = picked.length; add(tr, 0, first ? "أول الفصل" : placeChanged ? "تغيّر المكان" : "فاصل خفيف", false);
      if (picked.length > n) lastTransition = start;
    }
    if (!openingSacred && typeof place === "string" && placeChanged && PLACE_AMBIENCE[place]) add(PLACE_AMBIENCE[place]!, 0, "مكان", false);
    lastPlace = place ?? lastPlace;
    for (const [wi, w] of wordTimes(s, media).words.entries()) {
      if (sacredWord.has(wi)) continue;
      const n = norm(w.word);
      const hit = WORD_SFX.find(([re]) => re.test(n));
      if (hit) add(hit[1], Math.max(0, w.start - SUGGEST.leadIn), `«${w.word}»`);
    }
    out.push(...picked);
  });
  return out;
};

/** ما في الخطة من مؤثرات لا ملف لها في المكتبة (تُتجاهل في الرندر بصمت) */
export const missingSfx = (plan: Plan, library: ReadonlySet<string>) =>
  plan.chapters.flatMap((c) => c.scenes).flatMap((s) => s.sfx.filter((x) => !library.has(x.id)).map((x) => ({ scene: s.id, id: x.id })));
