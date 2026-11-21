import { seriesPublish } from "../channel/series";
import { parseScript } from "../script/parse";
import { parseAyahRef, surahNameFor } from "../script/quranMeta";
import { langPack } from "../i18n/packs";
import { chapterTimeline, type RealTimings } from "./chapterTimes";
import { resolveChapters, sceneStartsFor, type ChapterMark } from "./chapters";
import { shortSegments } from "../plan/shorts";
import type { EpisodeMedia } from "../plan/media";
import type { Plan } from "../plan/types";
import { channelInfo, defaultChannel, type ChannelConfig } from "../channel/types";

const clock = (sec: number) => {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};


/**
 * «المصادر» with the recitation attribution, exactly as the YouTube description shows them. Shared with the
 * Drive handoff's نشر.txt (QA minor, 10 Nov), so the two never differ.
 */
export const sourceLines = (plan: Plan, parsed: ReturnType<typeof parseScript>, media: EpisodeMedia, channel: ChannelConfig = defaultChannel): string[] => {
  const L = langPack(plan.lang ?? channel.language);
  const fill = (tpl: string, v: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");
  const sources: string[] = [];
  for (const c of parsed.citations) {
    if (c.kind === "ayah") {
      const r = parseAyahRef(c.fields[0] ?? "");
      const name = r.ok ? fill(L.strings.descVerse, { name: surahNameFor(r.ref.surah, L.code), ayah: `${r.ref.from}${r.ref.to !== r.ref.from ? `–${r.ref.to}` : ""}` }) : c.fields[0];
      const reciter = (c.fields.find((f) => f.startsWith("القارئ")) ?? "").replace(/^القارئ\s*:\s*/, "").trim();
      const rec = r.ok ? media.recitations[r.ref.key] : undefined;
      // Never invent a Quran text provider attribution. Text originates in the
      // reviewed script, and audio comes only from the owner's recording.
      const recitationLine = rec?.source === "manual" && rec.reciter
        ? fill(rec.own ? L.strings.descRecitationOwn : L.strings.descRecitation, { name: rec.reciter })
        : reciter && reciter !== "…" && rec
          ? fill(L.strings.descRecitation, { name: reciter })
          : "";
      // Translation attribution comes from the reviewed scene's actual meaning
      // source, not an obsolete channel/provider preference.
      const meaningSource = r.ok
        ? plan.chapters.flatMap(chapter => chapter.scenes)
            .find(scene => scene.ayahKey === r.ref.key)?.props?.meaningSource?.trim()
        : undefined;
      const extras = [L.code !== "ar" ? meaningSource ?? "" : "", recitationLine].filter(Boolean);
      sources.push(`- ${name} (${extras.join(L.code === "ar" ? "، " : ", ")})`);
    } else if (c.kind === "hadith") {
      sources.push(`- ${c.fields[0] ?? ""}${c.fields[1] ? ` — ${c.fields[1]}` : ""}${c.fields[2] ? ` (${c.fields[2]})` : ""}`);
    } else sources.push(`- ${c.fields.join(" — ")}`);
  }
  return sources;
};
/** The «المصادر:» block (heading + lines), or "" when the script has no citations. */
export const sourcesBlock = (plan: Plan, script: string, media: EpisodeMedia, channel: ChannelConfig = defaultChannel): string => {
  const lines = sourceLines(plan, parseScript(script), media, channel);
  return lines.length ? [langPack(plan.lang ?? channel.language).strings.descSources, ...lines].join("\n") : "";
};

/** نص الوصف والعناوين لليوتيوب: الحلقة والشورتس، بالفصول والمصادر والإفصاح. */
export const buildYoutubeText = (plan: Plan, script: string, media: EpisodeMedia, channel: ChannelConfig = defaultChannel, real?: RealTimings, marks?: ChapterMark[]): string => {
  const parsed = parseScript(script);
  const fm = (parsed.frontmatter ?? {}) as { title?: string; alt_titles?: string[] };
  // فصول اختارها المالك (ولو لنص متصل) من حدود المشاهد الحقيقية؛ وإلا الأقسام المعنونة وحدها، ولا فصول لنص متصل
  // أو قسم بلا عنوان (لا سطر «0:00» فارغ)، ولا فصول لن يعرضها يوتيوب
  const chosen = marks?.length ? resolveChapters(marks, sceneStartsFor(plan, media, channelInfo(channel), real)) : null;
  const starts = chosen
    ? (chosen.issues.some((i) => i.level === "error") ? [] : chosen.times.map((x, i) => ({ number: i + 1, title: x.mark.title.trim(), start: x.start })))
    : chapterTimeline(plan, media, channelInfo(channel), real).starts;
  const titled = starts.every((s) => s.title.trim()) ? starts : [];
  const hook = plan.chapters[0]?.scenes.find((s) => s.narration)?.narration ?? "";
  const step = parsed.practicalStep?.text ?? "";
  const L = langPack(plan.lang ?? channel.language);
  const fill = (tpl: string, v: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");

  const sources = sourceLines(plan, parsed, media, channel);

  const sp = seriesPublish(plan);
  const tags = [...new Set([...sp.tags, ...channel.youtube.tags, ...(channel.domains[plan.domain]?.tags ?? [])])];
  const description = [
    hook,
    "",
    ...(titled.length ? [L.strings.descChapters, ...titled.map((s) => `${clock(s.start)} ${s.title}`)] : []),
    "",
    step ? `${L.strings.practicalStep}: ${step}` : "",
    "",
    sources.length ? L.strings.descSources : "",
    ...sources,
    "",
    channel.youtube.footer,
    "",
    tags.map((t) => `#${t}`).join(" "),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  // مقاطع الشورتس من الخطة (plan.shorts) لا من عدد الأقسام (src/plan/shorts.ts)
  const byId = new Map(plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s]));
  const shorts = shortSegments(plan).segments.map((seg) => {
    const line = seg.sceneIds.map((id) => byId.get(id)?.narration ?? "").find(Boolean) ?? "";
    const title = seg.title || line;
    return [
      `### الشورت ${seg.n}${seg.chapter !== undefined ? ` · الفصل ${seg.chapter}` : ` · ${seg.sceneIds[0]} – ${seg.sceneIds.at(-1)}`}`,
      "",
      `**العنوان:** ${title} | ${channel.name}`,
      "",
      "**الوصف:**",
      "",
      "```",
      `${line}`,
      "",
      L.strings.fullEpisode,
      `${channel.youtube.tags.map((t) => `#${t}`).join(" ")} #shorts`,
      "```",
    ].join("\n");
  });

  return [
    `# ${plan.episode} · ${plan.title}`,
    "",
    "## عنوان الحلقة",
    "",
    `- ${sp.title}`,
    ...(fm.alt_titles ?? []).map((t) => `- ${t} (بديل لاختبار A/B)`),
    "",
    "## وصف الحلقة",
    "",
    "```",
    description,
    "```",
    "",
    "## الوسوم",
    "",
    tags.join("، "),
    "",
    ...(sp.playlist ? ["## قائمة التشغيل", "", sp.playlist, ""] : []),
    "## الشورتس",
    "",
    ...shorts,
    "",
  ].join("\n");
};

export const publishChecklist = (plan: Plan, hasVoice: boolean, channel: ChannelConfig = defaultChannel) => `# قائمة النشر · ${channel.name} · ${plan.episode} · ${plan.title}

لا يُنشر شيء لم تشاهده كاملًا بنفسك.

## قبل الرفع
- [ ] شاهدت الحلقة كاملة وكل شورت إلى آخر ثانية
- [ ] كل آية وحديث وافق عليهما المراجع الشرعي
- [ ] لا أخطاء نطق (إن وُجد خطأ: أضف الكلمة لقاموس النطق وأعد توليد المشهد فقط)
${hasVoice ? "" : "- [ ] ⚠️ الصوت غير مكتمل (مشاهد بلا صوت أو بصوت قديم): هذه نسخة معاينة لا تُنشر\n"}
## في يوتيوب ستوديو
- [ ] رفع الفيديو والصورة المصغّرة (اختر من الثلاث، وفعّل اختبار العناوين إن توفر)
- [ ] لصق الوصف والوسوم من youtube.md
- [ ] رفع ملف الترجمة العربية (.srt)
- [ ] خيار «المحتوى المعدّل» في يوتيوب ستوديو: لا (الصوت صوتك أنت، والرسوم متحركة غير واقعية؛ سياسة يوتيوب لا تطلب الإفصاح في الحالتين)
- [ ] لا شيء في العنوان أو الوصف أو الوسوم أو الصورة المصغّرة يشير إلى أدوات الإنتاج (تفحصه الحزمة تلقائيًا)
- [ ] عناصر شاشة النهاية: فيديوان + زر الاشتراك في أماكنها المحددة في آخر 20 ثانية
- [ ] التوقيت: ${channel.youtube.postingTime}

## الشورتس
- [ ] شورت يوميًا بنفس التوقيت حتى آخر شورت (أو كما في التقويم)
- [ ] رابط الحلقة الكاملة في وصف كل شورت، وربط الشورت بالحلقة من خيار «الفيديو المرتبط»
`;
