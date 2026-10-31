import { parseScript } from "../script/parse";
import { parseAyahRef, surahNameFor } from "../script/quranMeta";
import { langPack } from "../i18n/packs";
import { QF_ATTRIBUTION } from "../quran/attribution";
import { chapterStarts } from "../remotion/scenes/Episode";
import type { EpisodeMedia } from "../plan/media";
import type { Plan } from "../plan/types";
import { defaultChannel, type ChannelConfig } from "../channel/types";

const clock = (sec: number) => {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};


/** نص الوصف والعناوين لليوتيوب: الحلقة والشورتس، بالفصول والمصادر والإفصاح. */
export const buildYoutubeText = (plan: Plan, script: string, media: EpisodeMedia, shortsCount: number, channel: ChannelConfig = defaultChannel): string => {
  const parsed = parseScript(script);
  const fm = (parsed.frontmatter ?? {}) as { title?: string; alt_titles?: string[] };
  const starts = chapterStarts(plan, media);
  const hook = plan.chapters[0]?.scenes.find((s) => s.narration)?.narration ?? "";
  const step = parsed.practicalStep?.text ?? "";
  const L = langPack(plan.lang ?? channel.language);
  const fill = (tpl: string, v: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "");
  const translation = channel.quranTranslation?.name;

  const sources: string[] = [];
  for (const c of parsed.citations) {
    if (c.kind === "ayah") {
      const r = parseAyahRef(c.fields[0] ?? "");
      const name = r.ok ? fill(L.strings.descVerse, { name: surahNameFor(r.ref.surah, L.code), ayah: `${r.ref.from}${r.ref.to !== r.ref.from ? `–${r.ref.to}` : ""}` }) : c.fields[0];
      const reciter = (c.fields.find((f) => f.startsWith("القارئ")) ?? "").replace(/^القارئ\s*:\s*/, "").trim();
      const rec = r.ok ? media.recitations[r.ref.key] : undefined;
      // المرخّصة: اسم القارئ من الاستشهادات «بإذن مكتوب»؛ وتلاوة Quran Foundation: اسم القارئ مع نسبتها
      const recitationLine = !rec
        ? ""
        : rec.source === "quran-foundation"
          ? `${L.code === "ar" ? "التلاوة" : "Recitation"}: ${rec.reciter ?? ""} (Quran.Foundation)`
          : reciter && reciter !== "…"
            ? fill(L.strings.descRecitation, { name: reciter })
            : "";
      const extras = [L.code === "ar" ? QF_ATTRIBUTION : L.strings.quranAttribution, translation && L.code !== "ar" ? translation : "", recitationLine].filter(Boolean);
      sources.push(`- ${name} (${extras.join(L.code === "ar" ? "، " : ", ")})`);
    } else if (c.kind === "hadith") {
      sources.push(`- ${c.fields[0] ?? ""}${c.fields[1] ? ` — ${c.fields[1]}` : ""}${c.fields[2] ? ` (${c.fields[2]})` : ""}`);
    } else sources.push(`- ${c.fields.join(" — ")}`);
  }

  const tags = [...channel.youtube.tags, ...(channel.domains[plan.domain]?.tags ?? [])];
  const description = [
    hook,
    "",
    L.strings.descChapters,
    ...starts.map((s) => `${clock(s.start)} ${s.title}`),
    "",
    step ? `${L.strings.practicalStep}: ${step}` : "",
    "",
    sources.length ? L.strings.descSources : "",
    ...sources,
    "",
    channel.youtube.voiceDisclosure,
    "",
    tags.map((t) => `#${t}`).join(" "),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  const shorts = plan.chapters.slice(0, shortsCount).map((c, i) => {
    const line = c.scenes.find((s) => s.narration)?.narration ?? "";
    return [
      `### الشورت ${i + 1} · الفصل ${c.number}`,
      "",
      `**العنوان:** ${c.title} | ${channel.name}`,
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
    `- ${plan.title}`,
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
    "## الشورتس",
    "",
    ...shorts,
    "",
  ].join("\n");
};

export const publishChecklist = (plan: Plan, hasVoice: boolean, channel: ChannelConfig = defaultChannel) => `# قائمة النشر · ${channel.name} · ${plan.episode} · ${plan.title}

لا يُنشر شيء لم تشاهده كاملًا بنفسك.

## قبل الرفع
- [ ] شاهدت الحلقة كاملة والشورتس الستة إلى آخر ثانية
- [ ] كل آية وحديث وافق عليهما المراجع الشرعي
- [ ] لا أخطاء نطق (إن وُجد خطأ: أضف الكلمة لقاموس النطق وأعد توليد المشهد فقط)
${hasVoice ? "" : "- [ ] ⚠️ الصوت غير مكتمل (مشاهد بلا صوت أو بصوت قديم): هذه نسخة معاينة لا تُنشر\n"}
## في يوتيوب ستوديو
- [ ] رفع الفيديو والصورة المصغّرة (اختر من الثلاث، وفعّل اختبار العناوين إن توفر)
- [ ] لصق الوصف والوسوم من youtube.md
- [ ] رفع ملف الترجمة العربية (.srt)
- [ ] «المحتوى المعدّل أو الاصطناعي»: نعم (الصوت مستنسخ بالذكاء الاصطناعي)
- [ ] عناصر شاشة النهاية: فيديوان + زر الاشتراك في أماكنها المحددة في آخر 20 ثانية
- [ ] التوقيت: ${channel.youtube.postingTime}

## الشورتس
- [ ] شورت يوميًا لستة أيام، بنفس التوقيت
- [ ] رابط الحلقة الكاملة في وصف كل شورت، وربط الشورت بالحلقة من خيار «الفيديو المرتبط»
`;
