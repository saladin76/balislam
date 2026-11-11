/**
 * نقل ملفات الصوت المحلية إلى معرّفات المشاهد الجديدة بعد جعل الخطة قسمًا واحدًا (D87).
 *
 * حين تصير خطة حلقة قائمة قسمًا واحدًا تتغير معرّفات مشاهدها (c2-s1 ← c1-s9)، ويُحفظ المقابل في
 * `versions/<…>/id-map.json`. الملفات المتتبَّعة في Git تُنقل في الـcommit نفسه؛ أما ملفات الصوت فمحلية على جهاز
 * المالك (`voice/` في .gitignore) فلا تُرى إلا هناك، وهذا الأمر ينقلها هناك بالخريطة نفسها:
 * - `voice/index.json`: مفتاح كل مقطع مشهد (المحتوى والملف والبصمة كما هي).
 * - `voice/sentences.json`: مفتاح كل مشهد و`sceneId` في جمله (النص والنبرة والتسجيل كما هي).
 * لا يمس سجل الاعتمادات الموقَّع ولا الستوري بورد ولا أي اعتماد (تُعاد فتحها كما يجب)، ولا يحذف ملف صوت.
 * لا يُنقل مدخل إلا إن كان مفتاحه القديم غير موجود في الخطة الحالية والجديد غير مشغول، ونصه يطابق نص المشهد الجديد.
 * التجربة افتراضية؛ الكتابة بـ`apply` وقبلها نسخة `<الملف>.before-remap.json` بجواره، ولا يُكتب ملف يضيع منه مدخل.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { copyFile, readFile } from "node:fs/promises";
import { writeJsonAtomic } from "../io/atomicJson";
import type { Plan } from "./types";

export type IdMap = Record<string, string>;
export type RemapReport = { file: string; moved: [string, string][]; skipped: { id: string; reason: string }[]; written: boolean };

const norm = (s: string) => s.replace(/[ً-ْٰ]/g, "").replace(/\s+/g, " ").trim();

/** يقرأ id-map.json ويتحقق منه: مقابل واحد لكل قديم، ولا جديدان متطابقان */
export const readIdMap = async (file: string): Promise<IdMap> => {
  const doc = JSON.parse(await readFile(file, "utf8")) as { map?: unknown };
  const map = doc?.map;
  if (!map || typeof map !== "object") throw new Error(`${path.basename(file)} بلا خريطة معرّفات (map).`);
  const entries = Object.entries(map as Record<string, unknown>);
  if (!entries.every(([a, b]) => typeof b === "string" && /^c\d+-(s\d+|end)$/.test(a) && /^c\d+-(s\d+|end)$/.test(b)))
    throw new Error("خريطة المعرّفات فيها مدخل غير صالح.");
  if (new Set(entries.map(([, b]) => b)).size !== entries.length) throw new Error("خريطة المعرّفات تجعل مشهدين قديمين مشهدًا واحدًا.");
  return map as IdMap;
};

/**
 * النقل نفسه على كائن مفاتيحه معرّفات مشاهد (دالة نقية، تُختبر وحدها). المفتاح الذي لا يتغير يبقى؛ والذي يتغير
 * يُنقل إلى مقابله فقط إن وُجد المشهد في الخطة، ولم يكن له مدخل باقٍ، ونص المدخل = نص المشهد الجديد (فيصير
 * تكرار الأمر بعد تطبيقه بلا أثر). غير ذلك يبقى بمفتاحه ويُذكر سببه.
 */
export const remapKeys = <T>(entries: Record<string, T>, map: IdMap, plan: Plan, textOf: (v: T) => string | null): { next: Record<string, T>; moved: [string, string][]; skipped: { id: string; reason: string }[]; lost: string[] } => {
  const scenes = new Map(plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s]));
  const moves = (k: string) => Boolean(map[k] && map[k] !== k);
  const next: Record<string, T> = {};
  const moved: [string, string][] = [];
  const skipped: { id: string; reason: string }[] = [];
  const later: [string, T][] = [];
  for (const [k, v] of Object.entries(entries)) {
    if (!moves(k)) { next[k] = v; continue; }
    const to = map[k]!;
    const scene = scenes.get(to);
    const text = textOf(v);
    let reason = "";
    if (!scene) reason = `المشهد ${to} غير موجود في الخطة الحالية`;
    else if (to in entries && !moves(to)) reason = `${to} له مدخل قائم`;
    else if (text === null) reason = "بلا نص يُطابَق";
    else if (norm(text) !== norm(scene.narration)) reason = `نصه لا يطابق نص ${to}`;
    if (reason) { skipped.push({ id: k, reason }); later.push([k, v]); continue; }
    next[to] = v;
    moved.push([k, to]);
  }
  // ما لم يُنقل يبقى بمفتاحه؛ وإن أخذ مفتاحَه مدخلٌ منقول فلا يُكتب الملف أصلًا (لا يضيع مدخل)
  const lost: string[] = [];
  for (const [k, v] of later) {
    if (k in next) lost.push(k);
    else next[k] = v;
  }
  return { next, moved, skipped, lost };
};

export const remapLocalVoice = async (episodeDir: string, plan: Plan, map: IdMap, o: { apply?: boolean } = {}): Promise<RemapReport[]> => {
  const out: RemapReport[] = [];
  const save = async (file: string, value: unknown) => {
    const backup = `${file.replace(/\.json$/, "")}.before-remap.json`;
    if (!existsSync(backup)) await copyFile(file, backup);
    await writeJsonAtomic(file, value);
  };
  const index = path.join(episodeDir, "voice", "index.json");
  if (existsSync(index)) {
    const doc = JSON.parse(await readFile(index, "utf8")) as Record<string, { text?: string }>;
    const r = remapKeys(doc, map, plan, (v) => (typeof v?.text === "string" ? v.text : null));
    const written = Boolean(o.apply && r.moved.length && !r.lost.length);
    if (written) await save(index, r.next);
    out.push({ file: "voice/index.json", moved: r.moved, skipped: r.skipped, written });
  }
  const sentences = path.join(episodeDir, "voice", "sentences.json");
  if (existsSync(sentences)) {
    type Doc = { version: number; scenes: Record<string, { sentences: { sceneId?: string; text: string }[] }> };
    const doc = JSON.parse(await readFile(sentences, "utf8")) as Doc;
    const r = remapKeys(doc.scenes ?? {}, map, plan, (v) => (Array.isArray(v?.sentences) ? v.sentences.map((s) => s.text).join(" ") : null));
    for (const [, to] of r.moved) for (const s of r.next[to]!.sentences) if (s.sceneId !== undefined) s.sceneId = to;
    const written = Boolean(o.apply && r.moved.length && !r.lost.length);
    if (written) await save(sentences, { ...doc, scenes: r.next });
    out.push({ file: "voice/sentences.json", moved: r.moved, skipped: r.skipped, written });
  }
  return out;
};
