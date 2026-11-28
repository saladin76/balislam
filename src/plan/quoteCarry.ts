/**
 * D246 (قرار المالك ٢٨ نوفمبر): بطاقة الآية أو الحديث في «خط الأفق» تبقى زمن قراءتها كاملًا على الأقل (verseReadSeconds:
 * ثانيتان + كلمتان في الثانية، ولا تقل عن خمس). فإن قصر كلام مشهدها الحامل عنه **استمرت البطاقة نفسها إلى المشهد التالي**
 * (وما بعده إن لزم) والراوي يكمل، بلا ظهور جديد ولا سكوت يُضاف:
 * - الحامل: `quoteCarried` = معرّف المشهد التالي، ونافذته من ظهور البطاقة إلى آخره؛ وإن اتسعت القراءة في ذيله قبل بداية
 *   التالي فـ`quoteHold` وحده (نافذته [s، s + القراءة]، والخروج بعدها كالمعتاد)؛
 * - التالي: حقول `carry*` (النص والمرجع والراوي والجزء والموضع ومعرّف الحامل) و`carrySeconds` = ما بقي من زمن القراءة منذ
 *   بدايته، بزمن بداية المشهد التالي الفعلي (sceneAdvanceFrames: قد يبدأ تحت ذيل الحامل)؛ وإن جاوز ما بقي كلامه، عُلّم هو أيضًا
 *   `quoteCarried` واستمرت إلى ما بعده.
 * D246 «أ» (قرار المالك ٢٨ نوفمبر): ولا تستمر إلا إلى مشهد معلَّم `carryAllowed: "1"` (يكمل الراوي فيه الاقتباس نفسه؛
 * يضعه placeQuotes في src/plan/quotePlacement.ts أو المحرر/المالك)، وإلا خرجت قبله وبقيت في ذيل حاملها (quoteHold).
 * لا تستمر البطاقة إلى مشهد ليس «خط الأفق» متكلَّمًا، ولا إلى مشهد يحمل اقتباسًا آخر، ولا إلى تمهيد آية أخرى أو مشهد ذكر ساكن (HZ_META.still): ما بقي حينها «نقص» يُذكر في التقرير
 * (وحكمه D222: جزء معلَّم بقرار المتخصص، لا سكوت أطول).
 * التوقيت: كلمات الصوت الحقيقي إن طابق نص المشهد (كما يرسمه HorizonShot)، وإلا التقدير. دالة خالصة محدَّدة: تُعيد الحساب
 * من الصفر كل مرة (تحذف حقول الاستمرار القديمة أولًا)، فيشترك فيها بناء الخطة وتحويلها.
 */
import type { PlanScene } from "./types";
import type { EpisodeMedia } from "./media";
import { emptyMedia } from "./media";
import { sceneAdvanceFrames } from "./seams";
import config from "../../config.json";
import { HZ_LEAD, HZ_META, VERSE_AFTER_SPEECH, hzQuote, hzSentences, quoteStart, verseReadSeconds } from "../remotion/dafatir/horizon/meta";
import { buildTimeline, timelineFromWords, type Timeline } from "../remotion/dafatir/horizon/timeline";

export const CARRY_KEYS = ["quoteCarried", "quoteHold", "carryKind", "carryText", "carryRef", "carryNarrator", "carryPartial", "carrySide", "carryY", "carryFrom", "carrySeconds"] as const;

export type QuoteCarry = {
  host: string; kind: "verse" | "hadith"; ref: string;
  /** زمن القراءة (ث) */
  read: number;
  /** ما تُعرض في مشهدها الحامل وحده (ث) */
  inHost: number;
  /** المشاهد التي استمرت إليها بثوانيها */
  carried: { id: string; seconds: number }[];
  /** ما بقي بلا كلام يحمله (ث): ٠ = قُرئت كاملة */
  shortfall: number;
  /** سبب توقف الاستمرار إن بقي نقص */
  stop?: string;
};

const r2 = (x: number) => Math.round(x * 100) / 100;

/** توقيت المشهد كما يرسمه HorizonShot: كلمات الصوت إن طابق نصه، وإلا التقدير */
export const sceneTimeline = (s: PlanScene, media: Pick<EpisodeMedia, "voice">): Timeline => {
  const sentences = hzSentences(s.narration);
  const clip = media.voice[s.id];
  if (clip && clip.text === s.narration.trim() && clip.words?.length) {
    try { return timelineFromWords(sentences, clip.words.map((w) => ({ word: w.word, start: w.start, end: w.end })), 0); } catch { /* التقدير */ }
  }
  return buildTimeline(sentences, HZ_LEAD);
};
const lastWord = (tl: Timeline) => (tl.words.length ? tl.words[tl.words.length - 1]!.e : 0);

/** يحسب الاستمرار لكل بطاقة في مشاهد فصل واحد بالترتيب، ويكتبه في props (يغيّر المصفوفة الممرَّرة نسخةً) */
export const computeQuoteCarries = (input: PlanScene[], media: Pick<EpisodeMedia, "voice" | "recitations"> = emptyMedia, o: { channelId?: string; fps?: number } = {}) => {
  const fps = o.fps ?? config.video.fps;
  const scenes = input.map((s) => {
    const props = { ...s.props };
    for (const k of CARRY_KEYS) delete props[k];
    return { ...s, props };
  });
  type Need = { i: number; s: number; read: number; kind: "verse" | "hadith"; text: string };
  const needs: Need[] = [];
  const carries: QuoteCarry[] = [];
  scenes.forEach((sc, i) => {
    if (sc.template !== "horizon-shot" || !sc.narration.trim()) return;
    const q = hzQuote(sc.props);
    if (!q || q.carried) return;
    const tl = sceneTimeline(sc, media);
    const s = quoteStart(q.from, q.text, tl, sc.props.quoteFirm === "1");
    const read = verseReadSeconds(q.text);
    if (s + read <= lastWord(tl) + VERSE_AFTER_SPEECH + 1e-6) return;
    sc.props.quoteCarried = scenes[i + 1]?.id ?? "";
    needs.push({ i, s, read, kind: q.kind, text: q.text });
  });
  if (!needs.length) return { scenes, carries };
  // بدايات المشاهد الفعلية (الحامل لا يطول ببطاقته، والتالي قد يبدأ تحت ذيله)
  const adv = sceneAdvanceFrames(scenes, media, { channelId: o.channelId, fps }).map((f) => f / fps);
  for (const n of needs) {
    const host = scenes[n.i]!;
    const p = host.props;
    const ref = n.kind === "verse" ? p.verseKey! : p.hadithRef!;
    const rec: QuoteCarry = { host: host.id, kind: n.kind, ref, read: r2(n.read), inHost: r2(adv[n.i]! - n.s), carried: [], shortfall: 0 };
    let r = n.s + n.read - adv[n.i]!;
    let prev = host;
    for (let k = n.i + 1; r > 0.05; k++) {
      const sc = scenes[k];
      const why = !sc ? "آخر الحلقة" : sc.template !== "horizon-shot" || !sc.narration.trim() ? `${sc.id} ليس لقطة متكلَّمة`
        : hzQuote(sc.props) ? `${sc.id} يحمل اقتباسًا آخر`
        // تمهيد آية أخرى («كما جاء في سورة …») أو مشهد ذكر ساكن: بطاقة آية غيرها فوقه لا تطابق كلامه (القاعدة الثالثة)
        : HZ_META[sc.props.shot ?? ""]?.still ? `${sc.id} تمهيد آية أو ذكر`
        // D246 «أ»: لا تستمر إلا في الموضوع نفسه — المشهد التالي معلَّم carryAllowed «1» (المحوّل حيث يكمل الراوي الاقتباس بوضوح، أو المحرر/المالك)
        : sc.props.carryAllowed !== "1" ? `${sc.id} موضوع آخر (بلا carryAllowed)` : "";
      if (why) { rec.stop = why; break; }
      prev.props.quoteCarried = sc!.id;
      Object.assign(sc!.props, {
        carryKind: n.kind, carryText: n.text, carryRef: ref, carryFrom: host.id,
        ...(n.kind === "hadith" && p.hadithNarrator ? { carryNarrator: p.hadithNarrator } : {}),
        ...(n.kind === "verse" && p.versePartial === "1" ? { carryPartial: "1" } : {}),
        ...((n.kind === "hadith" ? p.hadithSide ?? p.verseSide : p.verseSide) ? { carrySide: (n.kind === "hadith" ? p.hadithSide ?? p.verseSide : p.verseSide)! } : {}),
        ...((n.kind === "hadith" ? p.hadithY ?? p.verseY : p.verseY) ? { carryY: (n.kind === "hadith" ? p.hadithY ?? p.verseY : p.verseY)! } : {}),
      });
      const avail = lastWord(sceneTimeline(sc!, media)) + VERSE_AFTER_SPEECH;
      if (r <= avail) { sc!.props.carrySeconds = String(r2(r)); rec.carried.push({ id: sc!.id, seconds: r2(r) }); r = 0; break; }
      sc!.props.carrySeconds = String(r2(adv[k]!));
      rec.carried.push({ id: sc!.id, seconds: r2(adv[k]!) });
      r -= adv[k]!;
      prev = sc!;
    }
    // تتسع القراءة في ذيل الحامل نفسه قبل بداية التالي: تبقى البطاقة إلى s + القراءة (quoteHold) بلا استمرار
    if (!rec.carried.length) { delete p.quoteCarried; p.quoteHold = "1"; rec.inHost = r2(Math.min(n.read, adv[n.i]! - n.s)); }
    rec.shortfall = r2(Math.max(0, r));
    carries.push(rec);
  }
  return { scenes, carries };
};
