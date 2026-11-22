/**
 * الفيديو التجميعي (وثيقة الرؤية، قرار المالك ٢١ نوفمبر): أداة مشتركة تجمع حلقات بترتيبها — «دفاتر الزمن» شهريًا،
 * وفي القنوات كلها كل موضوع أُنتج على أكثر من فيديو (كتاب على عدة حلقات، أو سلسلة) داخل قائمة تشغيله.
 * بلا إعادة رسم ولا صوت ولا إعادة ترميز: النسخ النهائية نفسها تُوصل بالبايت (concat، stream copy)، فلا تنزل جودتها.
 *
 * البوابات: لا تدخل حلقة إلا بإذن نشر لبصمة نسختها النهائية نفسها (publishHandoffFacts، D53)، ولا تُوصل ملفات
 * تختلف خصائصها (لا ترميز يخفي الفرق)، والعنوان وعناوين الفصول تمر على فحص الآثار (القاعدة الأولى)، وتُنظَّف
 * البيانات الوصفية (cleanMetadata). الناتج محلي في channels/<القناة>/compilations/<الاسم>/ (لا يُرفع)، والنشر يدوي
 * كباقي النسخ (D53) بعد أن يشاهده المالك كاملًا.
 */
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { findTraces } from "./traces";

const exec = promisify(execFile);

/** خصائص الملف التي يجب أن تتطابق ليوصل بلا ترميز */
export type StreamProfile = { vcodec: string; width: number; height: number; fps: string; pixFmt: string; acodec: string; sampleRate: number; channels: number };
export type CompilationPart = { episode: string; title: string; file: string; sha256: string; seconds: number; profile: StreamProfile };

const clock = (s: number) => {
  const t = Math.floor(s), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
};

/** أسباب رفض التجميع قبل أي ملف يُكتب؛ فارغة = يُجمع */
export const compilationProblems = (title: string, parts: CompilationPart[]): string[] => {
  const p: string[] = [];
  if (parts.length < 2) p.push("التجميع يحتاج حلقتين على الأقل.");
  const seen = new Set<string>();
  for (const x of parts) { if (seen.has(x.episode)) p.push(`الحلقة ${x.episode} مكررة.`); seen.add(x.episode); }
  if (!title.trim()) p.push("اكتب عنوان التجميع.");
  // يوتيوب: كل فصل عشر ثوانٍ على الأقل
  for (const x of parts) if (x.seconds < 10) p.push(`الحلقة ${x.episode} أقصر من ١٠ ث فلا تظهر فصلًا.`);
  const first = parts[0]?.profile;
  if (first) for (const x of parts.slice(1)) {
    const diff = (Object.keys(first) as (keyof StreamProfile)[]).filter((k) => first[k] !== x.profile[k]);
    if (diff.length) p.push(`الحلقة ${x.episode} تختلف عن ${parts[0]!.episode} في ${diff.join("، ")}؛ لا تُوصل بلا إعادة ترميز (أعد صنع نسختها النهائية).`);
  }
  const traces = [title, ...parts.map((x) => x.title)].flatMap(findTraces);
  if (traces.length) p.push(`قاعدة القناة: أثر أدوات في العنوان أو الفصول: ${[...new Set(traces)].join("، ")}`);
  return p;
};

/** فصول الوصف: كل حلقة فصل يبدأ عند مجموع ما قبلها، والأول عند 0:00 */
export const compilationChapters = (parts: Pick<CompilationPart, "title" | "seconds">[]) => {
  let t = 0;
  return parts.map((x) => { const line = `${clock(t)} ${x.title}`; t += x.seconds; return line; }).join("\n");
};

/** ملف قائمة concat demuxer؛ المسار بين علامتي اقتباس مفردة مهرَّبة */
export const concatList = (files: string[]) => files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n";

export const probeProfile = async (file: string): Promise<{ seconds: number; profile: StreamProfile }> => {
  const r = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels", "-of", "json", file]);
  const j = JSON.parse(String(r.stdout)) as { format: { duration: string }; streams: Record<string, string | number>[] };
  const v = j.streams.find((s) => s.codec_type === "video"), a = j.streams.find((s) => s.codec_type === "audio");
  if (!v || !a) throw Error(`${path.basename(file)}: ليس فيه صورة وصوت.`);
  return { seconds: Number(j.format.duration), profile: { vcodec: String(v.codec_name), width: Number(v.width), height: Number(v.height), fps: String(v.r_frame_rate),
    pixFmt: String(v.pix_fmt), acodec: String(a.codec_name), sampleRate: Number(a.sample_rate), channels: Number(a.channels) } };
};

/** يوصل الأجزاء بلا ترميز إلى out (في مجلد مؤقت ثم نقل)، ثم ينظف البيانات الوصفية */
export const joinParts = async (parts: CompilationPart[], out: string, meta: { title: string; artist: string },
  clean: (file: string, meta: { title: string; artist: string }) => Promise<void>) => {
  await mkdir(path.dirname(out), { recursive: true });
  const list = `${out}.list.txt`, tmp = out.replace(/\.mp4$/, ".part.mp4");
  await writeFile(list, concatList(parts.map((x) => x.file)));
  try {
    await exec("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-map", "0:v:0", "-map", "0:a:0", "-c", "copy", "-movflags", "+faststart", tmp],
      { maxBuffer: 16 * 1024 * 1024, timeout: 3_600_000 });
    await clean(tmp, meta);
    await rename(tmp, out);
  } finally {
    await rm(list, { force: true });
    await rm(tmp, { force: true });
  }
};

/** مجلد التجميع: channels/<القناة>/compilations/<الاسم>/ (محلي، .gitignore) */
export const compilationDir = (channelDir: string, name: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw Error("اسم التجميع حروف لاتينية صغيرة وأرقام وشرطات (مثل 2026-11 أو adam-series).");
  return path.join(channelDir, "compilations", name);
};

/**
 * يصنع التجميع من حلقات بترتيبها. كل حلقة: نسختها النهائية المعتمدة بإذن نشر لبصمتها نفسها، وعنوانها من خطتها.
 * يكتب compilation.mp4 وchapters.txt (فصول الوصف) وmanifest.json (البصمات والمدد)، ولا يرفع شيئًا.
 */
export const makeCompilation = async (input: { name: string; title: string; episodes: string[] }, onProgress?: (m: string) => void) => {
  const { publishHandoffFacts } = await import("../studio/sceneService");
  const { loadPlan } = await import("../plan/io");
  const { channelPaths, loadChannel } = await import("../channel");
  const { cleanMetadata } = await import("../render/episode");
  const dir = compilationDir(channelPaths().dir, input.name);
  const parts: CompilationPart[] = [];
  for (const ep of input.episodes) {
    let facts;
    try { facts = await publishHandoffFacts(ep); }
    catch (e) { throw Error(`الحلقة ${ep}: لا إذن نشر لنسختها النهائية الحالية، فلا تدخل التجميع (${(e as Error).message})`); }
    const plan = await loadPlan(ep);
    onProgress?.(`فحص ${ep}…`);
    const { seconds, profile } = await probeProfile(facts.masterFile);
    parts.push({ episode: ep, title: plan?.title?.trim() || ep, file: facts.masterFile, sha256: facts.masterSha256, seconds, profile });
  }
  const problems = compilationProblems(input.title, parts);
  if (problems.length) throw Error(`لا يُصنع التجميع:\n${problems.map((x) => `- ${x}`).join("\n")}`);
  const out = path.join(dir, "compilation.mp4");
  onProgress?.(`وصل ${parts.length} حلقات بلا إعادة ترميز…`);
  await joinParts(parts, out, { title: input.title, artist: loadChannel().name }, cleanMetadata);
  const chapters = compilationChapters(parts);
  await writeFile(path.join(dir, "chapters.txt"), `${chapters}\n`);
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify({ title: input.title, madeAt: new Date().toISOString(),
    parts: parts.map(({ episode, title, sha256, seconds }) => ({ episode, title, masterSha256: sha256, seconds })) }, null, 1) + "\n");
  return { out, chapters, seconds: parts.reduce((a, x) => a + x.seconds, 0) };
};
