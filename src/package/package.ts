import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { parseScript } from "../script/parse";
import { loadPlan, regeneratePlan } from "../plan/io";
import { prepareRenderMedia } from "../plan/collect";
import { scenesOf } from "../remotion/scenes/Episode";
import { renderEpisode, renderThumbnail, outDirFor } from "../render/episode";
import { getServeUrl } from "../render/bundle";
import { buildSrt } from "./captions";
import { buildYoutubeText, publishChecklist } from "./youtube";
import { loadChannel, loadChannelIdentity } from "../channel";

export type PackageOptions = {
  episode: string;
  /** بلا رندر فيديو (الوصف والترجمة والصور فقط) */
  skipVideo?: boolean;
  /** عدد الشورتس (فصل لكل شورت) */
  shorts?: number;
  onProgress?: (msg: string) => void;
};

/**
 * يجهّز كل ما يُرفع إلى يوتيوب في out/package:
 * الحلقة 16:9، وشورت 9:16 لكل فصل، و3 صور مصغّرة، وملفات ترجمة SRT، والوصف، وقائمة النشر.
 */
export const packageEpisode = async (opts: PackageOptions) => {
  const log = opts.onProgress ?? (() => {});
  const ep = opts.episode;
  const scriptPath = await resolveScriptPath(ep);
  const script = await readFile(scriptPath, "utf8");
  const plan = (await loadPlan(ep)) ?? (await regeneratePlan(ep));
  const dir = path.join(await outDirFor(ep), "package");
  await mkdir(dir, { recursive: true });
  const id = plan.episode || ep;
  const shorts = Math.min(opts.shorts ?? 6, plan.chapters.length);

  log("تجهيز الوسائط…");
  const media = await prepareRenderMedia(ep, plan);
  // الصوت «كامل» فقط إن كان لكل مشهد متكلَّم مقطع يطابق نصه الحالي
  const narrated = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration.trim());
  const voicedOk = narrated.filter((s) => media.voice[s.id]?.text === s.narration.trim()).length;
  const hasVoice = narrated.length > 0 && voicedOk === narrated.length;
  if (narrated.length && !hasVoice) log(`⚠️ الصوت ناقص: ${voicedOk} من ${narrated.length} مشهدًا فقط لها صوت مطابق لنصها؛ الباقي صامت بتوقيت تقديري.`);
  const files: string[] = [];

  // النصوص أولًا: سريعة ولا تحتاج رندر
  const channel = loadChannel();
  const identity = loadChannelIdentity();
  const lang = plan.lang ?? channel.language;
  await writeFile(path.join(dir, "youtube.md"), buildYoutubeText(plan, script, media, shorts, channel));
  await writeFile(path.join(dir, "publish-checklist.md"), publishChecklist(plan, hasVoice, channel));
  await writeFile(path.join(dir, `${id}-episode.${lang}.srt`), buildSrt(plan, scenesOf({ plan }).map((x) => x.scene), media, identity));
  for (let n = 1; n <= shorts; n++) {
    const ch = plan.chapters[n - 1]!;
    await writeFile(path.join(dir, `${id}-short-${n}.${lang}.srt`), buildSrt(plan, scenesOf({ plan, chapter: ch.number }).map((x) => x.scene), media, identity));
  }
  files.push("youtube.md", "publish-checklist.md", `${id}-episode.${lang}.srt`);

  log("تجميع المشروع…");
  await getServeUrl(true);

  // الصور المصغّرة: العنوان والعنوانان البديلان
  const fm = (parseScript(script).frontmatter ?? {}) as { alt_titles?: string[]; thumbnail_element?: string };
  const element = fm.thumbnail_element ?? plan.chapters.flatMap((c) => c.scenes).find((s) => s.props.element)?.props.element;
  const titles = [plan.title, ...(fm.alt_titles ?? [])].slice(0, 3);
  for (const [i, title] of titles.entries()) {
    log(`الصورة المصغّرة ${i + 1}…`);
    files.push(path.basename(await renderThumbnail({ themeId: plan.themeId, title, element, lang }, path.join(dir, `${id}-thumbnail-${i + 1}.png`))));
  }

  if (!opts.skipVideo) {
    let last = -1;
    const progress = (label: string) => (pct: number) => {
      const step = Math.floor(pct / 20) * 20;
      if (step !== last) {
        last = step;
        log(`${label}: ${pct}%`);
      }
    };
    files.push(path.basename(await renderEpisode({ episode: ep, orientation: "landscape", plan, media, outFile: path.join(dir, `${id}-episode.mp4`), onProgress: progress("الحلقة") })));
    for (let n = 1; n <= shorts; n++) {
      last = -1;
      const ch = plan.chapters[n - 1]!;
      files.push(path.basename(await renderEpisode({ episode: ep, orientation: "portrait", chapter: ch.number, plan, media, outFile: path.join(dir, `${id}-short-${n}.mp4`), onProgress: progress(`الشورت ${n}`) })));
    }
  }
  return { dir, files, hasVoice };
};
