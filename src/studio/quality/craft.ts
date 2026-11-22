/**
 * بنود «الحِرفة» في بطاقة الجودة (قرار المالك ٢٢ نوفمبر: «كل قالب يجب أن يبدو شغلًا متعوبًا عليه»): ما يُقاس منها
 * من الخطة نفسها، بلا رندر. كلها «للعلم» حتى يحدد المالك حدودها (لا تمنع شيئًا الآن)، وقيمتها ظاهرة في البطاقة.
 * - المشاهد التي فيها حركة كاميرا: كاميرا معلنة متحركة (camera/cameraMode غير ساكنة) أو لقطة مصمَّمة (shot).
 * - أحجام اللقطات في الدقيقة: من props.shotSize (wide | medium | close | detail)؛ قالب لا يعلنه لا يُعد.
 * - المؤثرات المتزامنة مع الحركة: مؤثرات غير الجو في مشهد فيه حركة (D158، القاعدة ٣: صوت مع كل حركة في الرسم).
 * - عدم تكرار اللقطة: اللقطة نفسها (القالب واللقطة والتكوين) مرتين في الحلقة.
 * مشاهد التوقير (الآية والحديث ولوح الدعاء) وشاشة الختام لا تُحاسب: سكونها مقصود.
 */
import type { Plan } from "../../plan/types";
import type { EpisodeMedia } from "../../plan/media";
import { sceneSeconds } from "../../plan/duration";
import { isAmbience } from "../../plan/sfxMix";
import { CLOSING_TEMPLATES, SACRED_TEMPLATES, sceneComposition } from "./diversity";

export const SHOT_SIZES = ["wide", "medium", "close", "detail"] as const;
const STILL_CAMERA = /^(|none|static|still|fixed|ثابت)$/i;

export type CraftReport = {
  scenes: number;
  /** مشاهد فيها حركة كاميرا / المشاهد المحسوبة */
  cameraMoving: number;
  /** أحجام اللقطات المختلفة المعلنة في كل دقيقة (متوسط)، وnull إن لم يعلن قالب حجمه */
  sizesPerMinute: number | null;
  sizesDeclared: number;
  /** مؤثرات غير الجو في مشاهد متحركة */
  syncedSfx: number;
  /** لقطات تكررت في الحلقة (مفتاح اللقطة مع مشاهدها) */
  repeatedShots: { key: string; scenes: string[] }[];
};

export const measureCraft = (plan: Plan, media?: Pick<EpisodeMedia, "voice" | "recitations">): CraftReport => {
  const all = plan.chapters.flatMap((c) => c.scenes).filter((s) => !SACRED_TEMPLATES.has(s.template) && !CLOSING_TEMPLATES.has(s.template));
  const moving = (s: (typeof all)[number]) => {
    const cam = String(s.props?.camera ?? s.props?.cameraMode ?? "").trim();
    return Boolean(String(s.props?.shot ?? "").trim()) || !STILL_CAMERA.test(cam);
  };
  const byMinute = new Map<number, Set<string>>();
  let t = 0, declared = 0;
  for (const s of all) {
    const size = String(s.props?.shotSize ?? "").trim();
    if ((SHOT_SIZES as readonly string[]).includes(size)) {
      declared++;
      const m = Math.floor(t / 60);
      byMinute.set(m, (byMinute.get(m) ?? new Set()).add(size));
    }
    t += sceneSeconds(s, media);
  }
  const minutes = Math.max(1, Math.ceil(t / 60));
  const seen = new Map<string, string[]>();
  for (const s of all) {
    const c = sceneComposition(s);
    const key = `${c.shot}#${c.composition}`;
    if (c.shot || c.composition) seen.set(key, [...(seen.get(key) ?? []), s.id]);
  }
  return {
    scenes: all.length,
    cameraMoving: all.filter(moving).length,
    sizesPerMinute: declared ? Math.round(([...byMinute.values()].reduce((a, x) => a + x.size, 0) / minutes) * 10) / 10 : null,
    sizesDeclared: declared,
    syncedSfx: all.filter(moving).reduce((n, s) => n + s.sfx.filter((x) => !isAmbience(x.id)).length, 0),
    repeatedShots: [...seen.entries()].filter(([, ids]) => ids.length > 1).map(([key, scenes]) => ({ key, scenes })),
  };
};
