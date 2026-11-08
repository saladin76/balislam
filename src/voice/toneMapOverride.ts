/**
 * «النبرة غير مناسبة» في حلقة لها خريطة نبرة («دفاتر الزمن»، قرار صاحب المشروع ٩ نوفمبر، الخيار أ في D39).
 *
 * النبرة التي يختارها المالك لمشهد في الخطوة ٣ تعلو على الخريطة لأجزاء ذلك المشهد وحده، وتُسجَّل في الخريطة
 * نفسها إصدارًا جديدًا (v1.2 ← v1.3 …) مع سطر في changelog: المشهد، النبرة القديمة ← الجديدة، ملاحظة المالك، التاريخ.
 * الإصدار السابق يبقى على القرص باسمه (tone-map.v1.2.json) كما بقي v1 وv1.1، ولا يُكتب فوق نسخة محفوظة مختلفة.
 * بقية المشاهد تبقى بنبرة الخريطة. والقنوات التي لا خريطة لها (بالإسلام وزبدة الكتب) لا تمر من هنا.
 */
import path from "node:path";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { open, readFile, rename, rm } from "node:fs/promises";
import { isTone, type Tone } from "./tones";

type Part = { id: string; scene: string; tone: string; [k: string]: unknown };
type Segment = { scene: string; tone: string; [k: string]: unknown };
/** ما يكتبه المالك فوق الخريطة لمشهد بعينه؛ مسار الأجزاء يطبّقه عند التوليد (dafatirParts.applySceneOverrides). */
export type SceneToneOverride = { tone: Tone; version: string; at: string; note: string; by: "owner" };
export type ToneMapDoc = {
  version: string;
  segments: Segment[];
  audioParts: Part[];
  sceneTones?: Record<string, string>;
  stats?: { sceneTones?: Record<string, number>; segmentTones?: Record<string, number>; [k: string]: unknown };
  previous?: { version: string; path: string }[];
  changelog?: unknown[];
  sceneOverrides?: Record<string, SceneToneOverride>;
  [k: string]: unknown;
};
export type ToneOverrideChange = {
  from: string; to: string; date: string; at: string; by: "owner"; source: "step3-tone";
  scene: string; before: { part: string; tone: string }[]; after: Tone; note: string; summary: string;
};

/** الإصدار التالي: v1.2 ← v1.3، وv1 ← v1.1 */
export const nextToneMapVersion = (v: string): string => {
  const m = /^v(\d+)(?:\.(\d+))?$/.exec(v.trim());
  if (!m) throw new Error(`إصدار خريطة النبرة غير مفهوم: ${v || "بلا إصدار"}`);
  return `v${m[1]}.${Number(m[2] ?? 0) + 1}`;
};
export const archiveNameFor = (version: string) => `tone-map.${version}.json`;

const countBy = (xs: string[]) => xs.reduce<Record<string, number>>((n, x) => ((n[x] = (n[x] ?? 0) + 1), n), {});

/**
 * يحسب الإصدار الجديد من نص الخريطة الحالي (دالة صافية). null إن لم يتغير شيء: المشهد بلا جزء صوتي
 * (بطاقة أو آية)، أو كل أجزائه بالنبرة المختارة أصلًا.
 */
export const overrideSceneTone = (raw: string, o: { scene: string; tone: Tone; note: string; at: string }):
  { map: ToneMapDoc; change: ToneOverrideChange } | null => {
  const cur = JSON.parse(raw) as ToneMapDoc;
  if (!Array.isArray(cur.audioParts) || !Array.isArray(cur.segments)) throw new Error("خريطة النبرة بلا أجزاء صوتية أو مقاطع.");
  const mine = cur.audioParts.filter((p) => p.scene === o.scene);
  if (!mine.length || mine.every((p) => p.tone === o.tone)) return null;
  const to = nextToneMapVersion(cur.version);
  const date = o.at.slice(0, 10);
  const before = mine.map((p) => ({ part: p.id, tone: p.tone }));
  const note = o.note.trim();
  const change: ToneOverrideChange = {
    from: cur.version, to, date, at: o.at, by: "owner", source: "step3-tone", scene: o.scene, before, after: o.tone, note,
    summary: `نبرة ${o.scene}: ${[...new Set(before.map((b) => b.tone))].join(" + ")} ← ${o.tone} بقرار صاحب المشروع («النبرة غير مناسبة» في الخطوة ٣)؛ بقية المشاهد كما هي`,
  };
  const segments = cur.segments.map((s) => (s.scene === o.scene ? { ...s, tone: o.tone } : s));
  const audioParts = cur.audioParts.map((p) => (p.scene === o.scene ? { ...p, tone: o.tone } : p));
  const sceneTones = cur.sceneTones ? { ...cur.sceneTones, [o.scene]: o.tone } : undefined;
  const stats = cur.stats
    ? {
        ...cur.stats,
        ...(cur.stats.sceneTones && sceneTones ? { sceneTones: countBy(Object.values(sceneTones)) } : {}),
        ...(cur.stats.segmentTones ? { segmentTones: countBy(segments.map((s) => s.tone)) } : {}),
      }
    : undefined;
  const map: ToneMapDoc = {
    ...cur,
    version: to,
    status: `${to} — ${cur.version} مع نبرة ${o.scene} بقرار صاحب المشروع («النبرة غير مناسبة»، ${date})`,
    date,
    ...(stats ? { stats } : {}),
    ...(sceneTones ? { sceneTones } : {}),
    segments,
    audioParts,
    previous: [...(cur.previous ?? []), { version: cur.version, path: archiveNameFor(cur.version) }],
    sceneOverrides: { ...(cur.sceneOverrides ?? {}), [o.scene]: { tone: o.tone, version: to, at: o.at, note, by: "owner" } },
    changelog: [...(cur.changelog ?? []), change],
  };
  return { map, change };
};

const writeAtomic = async (file: string, text: string) => {
  const temp = `${file}.${randomUUID()}.tmp`;
  const fd = await open(temp, "wx", 0o644);
  try {
    try { await fd.writeFile(text); await fd.sync(); } finally { await fd.close(); }
    await rename(temp, file);
  } finally { await rm(temp, { force: true }); }
};

export type PreparedToneOverride = { version: string; change: ToneOverrideChange; commit: () => Promise<void> };

/**
 * يجهّز الإصدار الجديد ويتحقق منه كاملًا قبل أي كتابة (يُستدعى قبل حفظ قرار التصحيح في السجل)، ثم commit
 * يحفظ الإصدار السابق باسمه ويكتب الخريطة الجديدة. null: الحلقة بلا خريطة نبرة، أو لا تغيير.
 */
export const prepareSceneToneOverride = async (
  scriptPath: string, o: { scene: string; tone: unknown; note: string; at: string },
): Promise<PreparedToneOverride | null> => {
  const { isPartsChannel, toneMapFileFor } = await import("./dafatirParts");
  if (!isPartsChannel(scriptPath)) return null;
  const file = toneMapFileFor(scriptPath);
  if (!existsSync(file)) return null;
  if (!isTone(o.tone)) throw new Error("النبرة المختارة غير معروفة.");
  const raw = await readFile(file, "utf8");
  const r = overrideSceneTone(raw, { scene: o.scene, tone: o.tone, note: o.note, at: o.at });
  if (!r) return null;
  const archive = path.join(path.dirname(file), archiveNameFor(r.change.from));
  if (existsSync(archive) && (await readFile(archive, "utf8")) !== raw)
    throw new Error(`${path.basename(archive)} محفوظ بمحتوى آخر؛ لا يُكتب فوق إصدار سابق من خريطة النبرة.`);
  const next = JSON.stringify(r.map, null, 1) + "\n";
  return {
    version: r.change.to,
    change: r.change,
    commit: async () => {
      if ((await readFile(file, "utf8")) !== raw) throw new Error("تغيّرت خريطة النبرة أثناء التصحيح؛ أعد المحاولة.");
      if (!existsSync(archive)) await writeAtomic(archive, raw);
      await writeAtomic(file, next);
    },
  };
};

/** للعرض في الخطوة ٣: إصدار الخريطة ونبرة أجزاء كل مشهد (بلا تحقق ثقيل؛ null لحلقة بلا خريطة). */
export const toneMapSummary = async (scriptPath: string): Promise<{ version: string; tones: Record<string, string> } | null> => {
  const { isPartsChannel, toneMapFileFor } = await import("./dafatirParts");
  if (!isPartsChannel(scriptPath)) return null;
  const file = toneMapFileFor(scriptPath);
  if (!existsSync(file)) return null;
  try {
    const map = JSON.parse(await readFile(file, "utf8")) as ToneMapDoc;
    const tones: Record<string, string> = {};
    for (const p of map.audioParts ?? []) tones[p.scene] = tones[p.scene] && tones[p.scene] !== p.tone ? "" : p.tone;
    return { version: String(map.version ?? ""), tones };
  } catch {
    return null;
  }
};
