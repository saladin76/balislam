/**
 * خطة «خط الأفق» المصمَّمة من خطة المشاهد المكتوبة (`scenes.md`) والسكريبت، لحلقات «البدايات» في «دفاتر الزمن»
 * (002–008)، بالبنية نفسها التي عليها خطة 001 المتتبَّعة في Git: كل مشهد متكلَّم `horizon-shot` بلقطته في
 * `props.shot` (لقطة `bdNN-…` المبنية، أو مشهد مكتبة `lib-*`/`verse-tag` بحقوله)، وبلا افتتاحية (`intro: false`)
 * ولا شاشة نهاية عامة (الختام لقطة من الحلقة نفسها كما في 001).
 *
 * محدَّد تمامًا (deterministic): المدخلات `script.md` و`scenes.md` وحدهما (وملف انتماء السلسلة إن وُجد)، فيُعاد
 * بناؤها بالنتيجة نفسها. لا يكتب شيئًا؛ الكتابة في الأمر `bal plan-from-scenes` (نسخة احتياطية أولًا، ورفض الكتابة
 * فوق خطة مصمَّمة إلا بتأكيد صريح).
 *
 * القواعد:
 * - نص المشهد من السكريبت حرفيًا (لا من `scenes.md`): صف الجدول يحدد المشهد ومعرّفه ولقطته وحقوله فقط. فقرة السكريبت
 *   تُنسب إلى أول صف (بالترتيب) يحتوي نصها؛ والفقرات المتتالية في الصف نفسه مشهد واحد (كما يضم صف «… » «…» فقرتين).
 * - بطاقات الآية والحديث كما يولّدها المحرك من السكريبت (`verse-card` بنصه من السكريبت، و`hadith-card`)، بمعرّف صفها
 *   في الجدول بالترتيب. نص الآية لا يُكتب في plan.json (يُدمج من السكريبت عند القراءة، `stripQuran`).
 * - تعليقات HTML في السكريبت ملاحظات إنتاج لا تُنطق ولا تصير مشاهد (يحذفها المحلل).
 * - حقول مشهد المكتبة من وصف الصف بصيغة «`الحقل` «القيمة»» (أو «`الحقل`: «القيمة»»)، وللحقول المعلنة لذلك المشهد
 *   وحدها (`LIB_UI`). `verse-tag` بلا مرجع يأخذ مرجع بطاقة الآية التي تليه، وكلمة ختمه اسم السورة إن نُطق.
 * - صف «بالكلمات وحدها» يصير `horizon-shot` بلقطة `pending` (قيد التصميم: لا يدخل نسخة نهائية) ويُذكر في التقرير.
 */
import type { ParsedScript } from "../script/types";
import type { Plan, PlanScene, PlanShort } from "./types";
import { generatePlan, type QuranTexts } from "./generate";
import { normalizeArabic } from "../script/quranMeta";
import { HZ_META } from "../remotion/dafatir/horizon/meta";
import { LIB_UI } from "../remotion/dafatir/lib/meta";
import type { ChannelConfig } from "../channel/types";
import type { SeriesStamp } from "../channel/series";

export type ScenesRow = {
  id: string;
  /** نص الخلية (الجملة كما نقلها الجدول) */
  cell: string;
  shotCell: string;
  desc: string;
  struck: boolean;
};

/** صفوف جدول «خطة المشاهد بشكل…» كلها (الأجزاء كلها)، بترتيبها */
export const parseScenesTable = (md: string): ScenesRow[] => {
  const start = md.indexOf("## خطة المشاهد بشكل");
  if (start < 0) return [];
  const rest = md.slice(start + 5);
  const stop = rest.search(/\n## /);
  const body = stop < 0 ? rest : rest.slice(0, stop);
  const rows: ScenesRow[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\|\s*(~~)?(c\d+-s\d+[a-z]?)(~~)?\s*\|(.*?)\|(.*?)\|(.*)\|\s*$/);
    if (!m) continue;
    const cell = m[4]!.trim();
    rows.push({ id: m[2]!, cell, shotCell: m[5]!.trim(), desc: m[6]!.trim(), struck: Boolean(m[1]) || /\*\*محذوف/.test(cell) });
  }
  return rows;
};

const flat = (s: string) =>
  normalizeArabic(s.replace(/<!--[\s\S]*?-->/g, " ").replace(/[«»"“”]/g, " ").replace(/[.،,:؛?؟!…()\-–—]/g, " ")).replace(/\s+/g, " ").trim();

const quoted = (cell: string) => {
  const a = cell.indexOf("«"), b = cell.lastIndexOf("»");
  return a < 0 || b <= a ? "" : cell.slice(a + 1, b);
};

type RowKind = { kind: "verse" | "hadith" } | { kind: "shot"; shot: string } | { kind: "words" };
export const rowKind = (r: ScenesRow): RowKind => {
  if (/`verse-card`/.test(r.shotCell) || /^بطاقة الآية/.test(r.cell)) return { kind: "verse" };
  if (/`hadith-card`/.test(r.shotCell) || /^نص الحديث/.test(r.cell)) return { kind: "hadith" };
  const shot = r.shotCell.match(/`((?:bd\d\d-[a-z0-9-]+)|(?:lib-[a-z]+)|verse-tag|verse-intro)`/)?.[1];
  if (shot) return { kind: "shot", shot };
  return { kind: "words" };
};

/** حقول مشهد المكتبة من الصف: «`key` «value»» أو «`key`: «value»» أو «key «value»» في خلية اللقطة أو الوصف */
export const rowFields = (r: ScenesRow, shot: string): Record<string, string> => {
  const allowed = new Set([...(LIB_UI[shot]?.fields ?? []), "head"]);
  const out: Record<string, string> = {};
  // تُحذف الحواشي التاريخية بين قوسين أولًا (فيها اقتباسات قديمة لا حقول)
  const text = `${r.shotCell} | ${r.desc}`.replace(/\((?:المراجعة|دفعة|تجهيز|التحرير|قرار|تحرير)[^()]*(?:\([^()]*\)[^()]*)*\)/g, " ");
  for (const m of text.matchAll(/`?([a-z][A-Za-z]+)`?\s*:?\s*«((?:[^«»]|«[^«»]*»)*)»/g)) {
    const k = m[1]!, v = m[2]!.trim();
    if (!allowed.has(k) || k in out || !v) continue;
    out[k] = v;
  }
  return out;
};

export type FromScenesReport = {
  /** فقرات السكريبت التي لا صف لها في الجدول */
  unplaced: { line: number; text: string }[];
  /** صفوف في الجدول لا يقابلها نص في السكريبت (متأخرة عن السكريبت) */
  unusedRows: string[];
  /** صفوف بالكلمات وحدها (لقطة pending) */
  wordsOnly: string[];
  /** لقطة يسمّيها الجدول وليست في مكتبة «خط الأفق» */
  unknownShots: string[];
  /** بطاقات آية/حديث لا يقابلها صف بالترتيب */
  cardMismatch: string[];
};

export type FromScenesInput = {
  parsed: ParsedScript;
  scenesMd: string;
  channel: ChannelConfig;
  quran?: QuranTexts;
  series?: SeriesStamp;
  shorts?: PlanShort[];
  /** ثابت للاختبار وإعادة البناء؛ الافتراضي الآن */
  now?: string;
};

/** يبني الخطة المصمَّمة ويعيدها مع تقرير ما لم يُطابَق. لا يكتب شيئًا. */
export const planFromScenes = (input: FromScenesInput): { plan: Plan; report: FromScenesReport } => {
  const base = generatePlan(input.parsed, null, input.quran ?? {}, input.channel);
  const rows = parseScenesTable(input.scenesMd).filter((r) => !r.struck);
  const report: FromScenesReport = { unplaced: [], unusedRows: [], wordsOnly: [], unknownShots: [], cardMismatch: [] };
  const used = new Set<string>();
  const textRows = rows.map((r) => ({ r, k: rowKind(r), t: flat(quoted(r.cell)) }));
  const cardRows = textRows.filter((x) => x.k.kind === "verse" || x.k.kind === "hadith");
  let cardCursor = 0;
  let rowCursor = 0;

  const scenes: PlanScene[] = [];
  type Open = { row: ScenesRow; scene: PlanScene };
  // حامل لا متغير: start() يغيّره داخل دالة، وTypeScript لا يتتبع ذلك في تضييق المتغير
  const st: { open: Open | null } = { open: null };
  const generated = base.chapters.flatMap((c) => c.scenes).filter((s) => !/^c\d+-end$/.test(s.id));
  for (const g of generated) {
    if (g.template === "verse-card" || g.template === "hadith-card") {
      st.open = null;
      const want = g.template === "verse-card" ? "verse" : "hadith";
      const hit = cardRows.slice(cardCursor).find((x) => x.k.kind === want);
      if (!hit) { report.cardMismatch.push(`${g.template} ${g.props.reference ?? ""} (السطر ${g.line})`); continue; }
      cardCursor = cardRows.indexOf(hit) + 1;
      used.add(hit.r.id);
      const s: PlanScene = { id: hit.r.id, template: g.template, narration: "", line: g.line, props: { ...g.props }, sfx: [] };
      if (g.ayahKey) s.ayahKey = g.ayahKey;
      scenes.push(s);
      continue;
    }
    const f = flat(g.narration);
    if (!f) continue;
    // الصف الحالي يضم الفقرة التالية أيضًا (صف بفقرتين)
    if (st.open && flat(quoted(st.open.row.cell)).includes(f)) {
      st.open.scene.narration = `${st.open.scene.narration} ${g.narration}`.trim();
      continue;
    }
    const findRow = (needle: string) => {
      const pool = textRows.slice(rowCursor).concat(textRows.slice(0, rowCursor));
      return pool.find((x) => x.k.kind !== "verse" && x.k.kind !== "hadith" && !used.has(x.r.id) && x.t.includes(needle));
    };
    const start = (hit: (typeof textRows)[number], narration: string) => {
      rowCursor = textRows.indexOf(hit) + 1;
      used.add(hit.r.id);
      let props: Record<string, string>;
      if (hit.k.kind === "shot") {
        const shot = hit.k.shot;
        if (!HZ_META[shot]) report.unknownShots.push(`${hit.r.id}: ${shot}`);
        props = { shot, ...(shot.startsWith("bd") ? {} : rowFields(hit.r, shot)) };
      } else {
        report.wordsOnly.push(hit.r.id);
        props = { shot: "pending", idea: "بالكلمات وحدها حتى تُصمَّم لقطتها (scenes.md)" };
      }
      const scene: PlanScene = { id: hit.r.id, template: "horizon-shot", narration, line: g.line, props, sfx: [] };
      scenes.push(scene);
      st.open = { row: hit.r, scene };
    };
    const whole = findRow(f);
    if (whole) { start(whole, g.narration); continue; }
    // فقرة واحدة في السكريبت يقسمها الجدول على صفوف متتالية (دمج المحرر جملتين كانتا صفين): جملةً جملة
    const parts = g.narration.split(/(?<=[.؟?!…])\s+/).filter(Boolean);
    const placed = parts.every((p) => {
      const fp = flat(p);
      const cur = st.open;
      if (cur && flat(quoted(cur.row.cell)).includes(fp)) { cur.scene.narration = `${cur.scene.narration} ${p}`.trim(); return true; }
      const hit = findRow(fp);
      if (!hit) return false;
      start(hit, p);
      return true;
    });
    if (!placed) { st.open = null; report.unplaced.push({ line: g.line, text: g.narration }); }
  }

  // تمهيد الآية: مرجع البطاقة التي تليه، وكلمة الختم اسم السورة إن نُطق
  scenes.forEach((s, i) => {
    if (s.template !== "horizon-shot" || s.props.shot !== "verse-tag") return;
    const next = scenes.slice(i + 1).find((x) => x.template === "verse-card");
    if (!s.props.ref && next?.props.reference) s.props.ref = next.props.reference;
    if (!s.props.tagWord && s.props.ref) {
      const surah = s.props.ref.split("·")[0]!.trim();
      const word = s.narration.split(/\s+/).find((w) => flat(w) === flat(surah));
      if (word) s.props.tagWord = word.replace(/[.،,:؛?؟!«»]/g, "");
    }
  });

  for (const x of textRows) if (!used.has(x.r.id)) report.unusedRows.push(x.r.id);

  const ids = new Set<string>();
  for (const s of scenes) {
    if (ids.has(s.id)) throw new Error(`معرّف مكرر في الخطة: ${s.id}`);
    ids.add(s.id);
  }
  const plan: Plan = {
    version: 1,
    episode: base.episode,
    title: base.title,
    domain: base.domain,
    themeId: base.themeId,
    channel: base.channel,
    lang: base.lang,
    overlays: { captions: true, motif: true, watermark: true, chapterLabel: false },
    updatedAt: input.now ?? new Date().toISOString(),
    intro: false,
    ...(input.shorts?.length ? { shorts: input.shorts.map((x) => ({ ...x })) } : {}),
    chapters: [{ number: 1, title: "", scenes }],
    ...(input.series ? { series: input.series } : {}),
  };
  return { plan, report };
};

export const fromScenesProblems = (r: FromScenesReport): string[] => [
  ...r.unplaced.map((u) => `نص في السكريبت بلا صف في scenes.md (السطر ${u.line}): «${u.text.slice(0, 60)}»`),
  ...r.unknownShots.map((u) => `لقطة غير موجودة في مكتبة «خط الأفق»: ${u}`),
  ...r.cardMismatch.map((u) => `بطاقة بلا صف مقابل في scenes.md: ${u}`),
];
