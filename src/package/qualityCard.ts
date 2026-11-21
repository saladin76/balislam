/**
 * بندا «التغليف» و«الشورتس» في بطاقة الجودة (قرار المالك ١ في الخطة المشتركة: لا يُنشر فيديو إلا ببطاقة كلها ✓؛
 * المرحلة ٢ البند ٦: يسلّمها B إلى A). دالة صافية بلا قرص: A يقرأ `publish.json` والخطة وتوقيت المشاهد ويستدعيها.
 *
 * لكل بند `ok` و`items` بأسماء ثابتة (`id`) يعرضها A سطرًا سطرًا، و`missing` بما ينقص بالعربية. لا تكرر قواعد:
 * كل سطر يقرأ الفحص نفسه الذي يمنع الحزمة أو ينبّه في «حزمة الانتشار» (kitIssues وما يستدعيه).
 */
import { kitIssues, TITLE_MAX } from "./quality";
import { thumbnailIssues, type ThumbScene } from "./thumbnails";
import { resolveChapters, type SceneStarts } from "./chapters";
import { isEpisodeUrl, isQuestionTitle } from "./shortsLink";
import type { PublishKit } from "./social";

export type CardItem = { id: string; label: string; ok: boolean; detail?: string };
export type CardSection = { ok: boolean; items: CardItem[]; missing: string[] };

const section = (items: CardItem[]): CardSection => ({
  ok: items.every((i) => i.ok), items, missing: items.filter((i) => !i.ok).map((i) => `${i.label}${i.detail ? `: ${i.detail}` : ""}`),
});

/**
 * ctx.title عنوان الحلقة، وctx.scenes مشاهدها (للأغلفة)، وctx.starts بداية كل مشهد في الملف (للفصول).
 * الفصول اختيار المالك: بلاها لا بند ناقص (السرد الواحد D87)، ومعها يلزم أن يعرضها يوتيوب.
 */
export const packagingCard = (kit: PublishKit, ctx: { title: string; scenes?: ThumbScene[]; starts?: SceneStarts }): CardSection => {
  const L = kit.long;
  const titles = [ctx.title, ...L.titles.map((t) => t.text)];
  const thumbs = thumbnailIssues(L.thumbnails, { titles, scenes: ctx.scenes });
  const long = L.titles.filter((t) => Array.from(t.text.trim()).length > TITLE_MAX);
  const ch = L.chapters?.length && ctx.starts ? resolveChapters(L.chapters, ctx.starts) : null;
  const kitErrors = kitIssues(kit, { title: ctx.title, scenes: ctx.scenes, starts: ctx.starts }).filter((i) => i.level === "error");
  return section([
    { id: "thumbnails", label: "الأغلفة الثلاثة (عنوان، مشهد، سؤال)", ok: Boolean(L.thumbnails) && !thumbs.some((i) => i.level === "error"),
      detail: !L.thumbnails ? "لم تُكتب" : thumbs.find((i) => i.level === "error")?.message },
    { id: "titles", label: `العناوين ≤ ${TITLE_MAX} حرفًا`, ok: L.titles.length > 0 && long.length === 0, detail: long[0] ? `«${long[0].text}»` : L.titles.length ? undefined : "بلا عنوان" },
    { id: "chapters", label: "فصول يوتيوب من حدود المشاهد", ok: !L.chapters?.length || Boolean(ch && !ch.issues.some((i) => i.level === "error")),
      detail: L.chapters?.length && !ctx.starts ? "توقيت المشاهد غير معروف" : ch?.issues.find((i) => i.level === "error")?.message },
    { id: "kit", label: "نصوص النشر بلا خطأ يمنع الحزمة", ok: kitErrors.length === 0, detail: kitErrors[0] ? `${kitErrors[0].where}: ${kitErrors[0].message}` : undefined },
  ]);
};

/** الشورتس: لكل شورت عنوان سؤال، ورابط الحلقة في الحزمة (يدخل وصف كل شورت). لا شورتس = بند ناقص. */
export const shortsCard = (kit: PublishKit): CardSection => {
  const notQ = kit.shorts.filter((s) => !isQuestionTitle(s.youtube.title));
  return section([
    { id: "shorts-exist", label: "شورتس من الحلقة", ok: kit.shorts.length > 0, detail: kit.shorts.length ? undefined : "لا شورتس في الحزمة" },
    { id: "shorts-question", label: "كل شورت بعنوان سؤال", ok: kit.shorts.length > 0 && notQ.length === 0,
      detail: notQ.length ? `الشورت ${notQ.map((s) => s.chapter).join("، ")}` : undefined },
    { id: "shorts-link", label: "رابط الحلقة في وصف كل شورت", ok: isEpisodeUrl(kit.long.episodeUrl),
      detail: kit.long.episodeUrl?.trim() ? (isEpisodeUrl(kit.long.episodeUrl) ? undefined : "الرابط ليس فيديو يوتيوب") : "يُكتب بعد نشر الحلقة" },
  ]);
};
