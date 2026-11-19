import { createHash } from "node:crypto";
import { normWord, stripTashkeel } from "./tashkeel";
import { archiveNameFor, nextToneMapVersion } from "./toneMapOverride";

/**
 * KI-088 (١٨ نوفمبر، «دفاتر الزمن 001»): مزامنة خريطة النبرة مع التشكيل الحالي بلا إعادة بنائها.
 *
 * كل مقطع يُطابَق بسطره في التشكيل **بالنص** (بلا تشكيل، وبالترتيب)، لا برقم السطر. ثم يُصنَّف الفرق:
 * - same: النص المشكول نفسه؛
 * - ortho: كتابة فقط (سكون لام التعريف): لا يتغير النطق، فيبقى نص المقطع كما هو، لأن بصمة كل تسجيل محسوبة
 *   من نصه المشكول (src/voice/generate.ts partsJobsFor) — نقله كان يُبطل التسجيلات كلها بلا سبب؛
 * - pronunciation: نطق تغيّر: يأخذ المقطع نص التشكيل الجديد (والكلمات المؤكدة فيه)، فيظهر جزؤه «يحتاج صوتًا»
 *   ويولّده المالك بضغطته وحده. لا يُحذف ولا يُولَّد شيء هنا.
 * نبرة كل مقطع ووقفاته وانتقالاته وكل قرار في الخريطة تبقى كما هي؛ يتغير رقم السطر، والبصمات، والإصدار.
 */

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
/** النص بلا تشكيل للمطابقة؛ «ءا» و«آ» حرف واحد (سَوْءَاتِهِمَا = سَوْآتِهِمَا) */
const plain = (s: string) => stripTashkeel(s.normalize("NFC")).replace(/ءا/g, "آ").split(/\s+/).map(normWord).filter(Boolean).join(" ");
/**
 * الكتابة وحدها لا النطق: (١) ترتيب الحركات على الحرف (الفتحة قبل الشدة أو بعدها: «اللَّهُ» بايتان مختلفان والنطق
 * واحد) يُوحَّد بالصيغة القانونية NFD؛ (٢) سكون لام التعريف «الْأَرْضُ» = «الأَرْضُ»، و«لِلْإِنْسَانِ» = «لِلإِنْسَانِ»؛
 * (٣) «ءا» = «آ».
 */
export const orthoForm = (s: string) =>
  s.normalize("NFD").split(/(\s+)/).map((w) => w
    .replace(/^([وفبك]?[\u064B-\u0650]*ا[\u064B-\u0650]*ل)\u0652/u, "$1")
    .replace(/^(ل[\u064B-\u0650]*ل)\u0652/u, "$1")
    .replace(/ء[\u064B-\u0652]*ا/gu, "آ")).join("").normalize("NFC");

export type SyncSegment = { n: number; id: string; scene: string; text: string; tashkeelLine?: number; marked?: string; emphasis?: string[] };
export type SyncRow = { id: string; scene: string; fromLine?: number; toLine: number; kind: "same" | "ortho" | "pronunciation"; changed: { from: string; to: string }[] };
export type SyncReport = { ok: boolean; rows: SyncRow[]; unmatched: { id: string; scene: string; text: string }[]; tashkeelSha256: string };

/** سطور السرد في التشكيل: لا العنوان (#) ولا علامات الاستشهاد ([…]) ولا الفراغ؛ ورقم كل سطر (يبدأ من ١) */
export const narrationLines = (tashkeel: string) =>
  tashkeel.split(/\r?\n/).map((text, i) => ({ line: i + 1, text: text.trim() })).filter((l) => l.text && !/^[#[]/.test(l.text));

const wordDiff = (a: string, b: string) => {
  const x = a.split(/\s+/), y = b.split(/\s+/);
  return x.length === y.length ? x.flatMap((w, i) => (w !== y[i] ? [{ from: w, to: y[i]! }] : [])) : [{ from: a, to: b }];
};

export const analyzeToneMapSync = (segments: SyncSegment[], tashkeel: string): SyncReport => {
  const lines = narrationLines(tashkeel);
  const rows: SyncRow[] = [];
  const unmatched: SyncReport["unmatched"] = [];
  let from = 0;
  for (const s of [...segments].sort((a, b) => a.n - b.n)) {
    // بلا مسافات: «وَ مَعَايِشهُمْ» (مسافة يضعها المالك ليضبط النطق) هي «وَمَعَايِشُهُمْ» نصًّا
    const bare = (t: string) => plain(t).replace(/\s+/g, "");
    const want = bare(s.text);
    const k = lines.findIndex((l, i) => i >= from && bare(l.text) === want);
    if (k < 0) { unmatched.push({ id: s.id, scene: s.scene, text: s.text }); continue; }
    from = k + 1;
    const now = lines[k]!.text;
    const kind = now === s.text ? "same" : orthoForm(now) === orthoForm(s.text) ? "ortho" : "pronunciation";
    rows.push({ id: s.id, scene: s.scene, fromLine: s.tashkeelLine, toLine: lines[k]!.line, kind, changed: kind === "pronunciation" ? wordDiff(orthoForm(s.text), orthoForm(now)) : [] });
  }
  return { ok: unmatched.length === 0 && rows.length === segments.length, rows, unmatched, tashkeelSha256: sha256(tashkeel) };
};

export type SyncResult = { raw: string; report: SyncReport; from: string; to: string; changedScenes: string[] };

/**
 * الخريطة الجديدة: الإصدار التالي، والسابق محفوظ باسمه (previous)، وبصمات المصادر الحالية، ورقم سطر كل مقطع؛
 * ومقاطع «النطق تغيّر» وحدها تأخذ نص التشكيل وكلماته المؤكدة. يرفض إن لم يُطابَق كل مقطع بسطره.
 */
export const syncToneMap = (raw: string, tashkeel: string, o: {
  at: string; script?: string; plan?: string;
  /** قرار المالك (١٨ نوفمبر): «لا تغيّر شيئًا في النطق الحالي» — مقاطع النطق المختلف تبقى بنصها المسجَّل، وتُكتب استثناءً صريحًا */
  keepRecorded?: boolean;
  /** مشاهد ليست في الخطة: تُرفع مقاطعها وأجزاؤها من الخريطة (لا يُحذف تسجيل) */
  dropScenes?: string[];
}): SyncResult => {
  const parsed = JSON.parse(raw) as Record<string, unknown> & { version: string; segments: (SyncSegment & Record<string, unknown>)[]; audioParts?: { scene: string }[]; previous?: { version: string; path: string }[]; source?: Record<string, { path: string; sha256: string }>; tashkeelSyncs?: unknown[] };
  const drop = new Set(o.dropScenes ?? []);
  const dropped = parsed.segments.filter((s: SyncSegment) => drop.has(s.scene)).map((s: SyncSegment) => ({ id: s.id, scene: s.scene, text: s.text }));
  const cur = { ...parsed, segments: parsed.segments.filter((s: SyncSegment) => !drop.has(s.scene)),
    ...(Array.isArray(parsed.audioParts) ? { audioParts: parsed.audioParts.filter((p: { scene: string }) => !drop.has(p.scene)) } : {}) } as typeof parsed;
  const report = analyzeToneMapSync(cur.segments, tashkeel);
  if (!report.ok) throw new Error(`لا تُزامَن الخريطة: مقاطع بلا سطر في التشكيل الحالي: ${report.unmatched.map((u) => `${u.id} (${u.scene})`).join("، ")}`);
  const lines = new Map(narrationLines(tashkeel).map((l) => [l.line, l.text]));
  const byId = new Map(report.rows.map((r) => [r.id, r]));
  const segments = cur.segments.map((s) => {
    const r = byId.get(s.id)!;
    if (r.kind !== "pronunciation" || o.keepRecorded) return { ...s, tashkeelLine: r.toLine };
    const now = lines.get(r.toLine)!;
    const a = s.text.split(/\s+/), b = now.split(/\s+/);
    const swap = new Map(a.length === b.length ? a.flatMap((w, i) => (orthoForm(w) !== orthoForm(b[i]!) ? [[w, b[i]!] as const] : [])) : []);
    const fix = (t: string) => [...swap].reduce((x, [from, to]) => x.split(from).join(to), t);
    return { ...s, tashkeelLine: r.toLine, text: now, ...(typeof s.marked === "string" ? { marked: fix(s.marked) } : {}), ...(Array.isArray(s.emphasis) ? { emphasis: s.emphasis.map(fix) } : {}) };
  });
  const to = nextToneMapVersion(cur.version);
  const changed = report.rows.filter((r) => r.kind === "pronunciation");
  const date = o.at.slice(0, 10);
  const source = { ...(cur.source ?? {}), tashkeel: { path: "tashkeel.md", sha256: report.tashkeelSha256 },
    ...(o.script !== undefined ? { script: { path: "script.md", sha256: sha256(o.script) } } : {}),
    ...(o.plan !== undefined ? { plan: { path: "plan.json", sha256: sha256(o.plan) } } : {}) };
  const next = {
    ...cur, version: to, date, segments, source,
    status: o.keepRecorded
      ? `${to} — ${cur.version} مُزامَنة مع التشكيل الحالي (${date}) بقرار المالك «لا تغيّر شيئًا في النطق الحالي»: كل مقطع بنصه المسجَّل، و${changed.length} مواضع مختلفة عن التشكيل مكتوبة استثناءً`
      : `${to} — ${cur.version} مُزامَنة مع التشكيل الحالي (${date})؛ النبرات والوقفات كما هي، ونطق ${changed.length} مقطع من التشكيل`,
    previous: [...(cur.previous ?? []), { version: cur.version, path: archiveNameFor(cur.version) }],
    tashkeelSyncs: [...(cur.tashkeelSyncs ?? []), { from: cur.version, to, at: o.at, tashkeelSha256: report.tashkeelSha256,
      counts: { same: report.rows.filter((r) => r.kind === "same").length, ortho: report.rows.filter((r) => r.kind === "ortho").length, pronunciation: changed.length },
      ...(o.keepRecorded ? { keptRecorded: { by: "owner", note: "لا تغيّر شيئًا في النطق الحالي", segments: changed.map((r) => ({ id: r.id, scene: r.scene, words: r.changed })) } }
        : { pronunciation: changed.map((r) => ({ id: r.id, scene: r.scene, words: r.changed })) }),
      ...(dropped.length ? { droppedNotInPlan: dropped } : {}) }],
  };
  return { raw: JSON.stringify(next, null, 2) + "\n", report, from: cur.version, to, changedScenes: o.keepRecorded ? [] : [...new Set(changed.map((r) => r.scene))] };
};
