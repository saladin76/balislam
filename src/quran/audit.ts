/**
 * تدقيق نص بطاقات الآيات المعروض فعلًا في الحلقة مقابل المرجع المعتمد (مراجعة صاحب القناة).
 *
 * - النص المحلي: quran.json بجوار السكريبت، وهو المصدر الوحيد الذي يدمجه withQuran في بطاقات verse-card عند الرندر.
 * - المقارنة بعد توحيد يونيكود (NFC) وحده؛ لا يُحذف تشكيل ولا علامة قرآنية. وتُصنَّف الفروق:
 *   الحروف، والتشكيل، والرسم العثماني، والعلامات الخاصة (الوقف ونهاية الآية وأرقامها).
 * - نص المرجع لا يُكتب في المستودع (شروط مراجعة صاحب القناة)؛ يُعرض الفرق بموضعه ورموزه فقط.
 */
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, stat, writeFile, rm } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { parseAyahRef, SURAH_NAMES, toLatinDigits } from "../script/quranMeta";
import { resolveScriptPath } from "../script/episodes";
import { quranPathFor, readJson, readPlanFile } from "../plan/io";
import { sceneSeconds } from "../plan/duration";
import type { QuranClient } from "./client";
import { composeVerses } from "./sync";

export type CharClass = "letter" | "haraka" | "uthmani" | "mark" | "space" | "other";
export const CLASS_AR: Record<CharClass, string> = { letter: "الحروف", haraka: "التشكيل", uthmani: "الرسم العثماني", mark: "العلامات الخاصة", space: "المسافات", other: "رموز أخرى" };

/** تصنيف رمز واحد. */
export const classifyChar = (c: string): CharClass => {
  const n = c.codePointAt(0)!;
  if (/\s/.test(c)) return "space";
  if (n >= 0x064b && n <= 0x0652) return "haraka"; // التنوين والحركات والشدة والسكون
  if (n === 0x0670 || n === 0x0671 || (n >= 0x0653 && n <= 0x0655) || (n >= 0x06df && n <= 0x06e8) || (n >= 0x06ea && n <= 0x06ed)) return "uthmani"; // الألف الخنجرية، ألف الوصل، المدة، الصفر المستدير، السكون العثماني، الحروف الصغيرة…
  if ((n >= 0x06d6 && n <= 0x06de) || n === 0x06e9 || (n >= 0x0660 && n <= 0x0669) || (n >= 0x06f0 && n <= 0x06f9)) return "mark"; // علامات الوقف، ونهاية الآية، والسجدة، والأرقام
  if ((n >= 0x0621 && n <= 0x064a) || n === 0x06cc || n === 0x06c1 || n === 0x06d2 || n === 0x0640) return "letter";
  return "other";
};

export const codepoint = (c: string) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;

export type DiffOp = { at: number; op: "sub" | "ins" | "del"; shown: string; ref: string; cls: CharClass };

/** محاذاة رمزًا برمز (أطول تتابع مشترك) بعد NFC، فلا تتسلسل الفروق بعد أول إضافة أو حذف. */
export const alignDiff = (shown: string, ref: string): DiffOp[] => {
  const a = Array.from(shown.normalize("NFC").trim());
  const b = Array.from(ref.normalize("NFC").trim());
  const m = a.length, n = b.length;
  const L: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i]![j] = a[i] === b[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const ops: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) { i++; j++; continue; }
    if (i < m && j < n && L[i + 1]![j + 1]! === L[i]![j]!) { ops.push({ at: i, op: "sub", shown: a[i]!, ref: b[j]!, cls: classifyChar(a[i]!) === "letter" || classifyChar(b[j]!) === "letter" ? "letter" : classifyChar(b[j]!) }); i++; j++; continue; }
    if (j < n && (i >= m || L[i]![j + 1]! >= L[i + 1]![j]!)) { ops.push({ at: i, op: "ins", shown: "", ref: b[j]!, cls: classifyChar(b[j]!) }); j++; continue; }
    ops.push({ at: i, op: "del", shown: a[i]!, ref: "", cls: classifyChar(a[i]!) }); i++;
  }
  return ops;
};

/** أرقام نهايات الآيات (۝ ثم رقم) في نص البطاقة. */
export const ayahEndNumbers = (text: string): number[] => Array.from(text.matchAll(/۝\s*([٠-٩۰-۹\d]+)/g)).map((m) => Number(toLatinDigits(m[1]!.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)))));

export type CategoryResult = "match" | "differs" | "pending";
export type VerseAudit = {
  key: string; surah: number; surahName: string; from: number; to: number;
  sceneId?: string; label?: string; shown?: string; shownSha256?: string;
  numbers: { ok: boolean; notes: string[] };
  reference?: { source: string; field: string; env: string; fetchedAt: string; returned: { key: string; number: number }[]; sha256: string };
  categories: Record<"letter" | "haraka" | "uthmani" | "mark", CategoryResult>;
  ops: DiffOp[]; status: "match" | "differs" | "pending" | "missing" | "failed"; reason?: string;
  frame?: string; frameAt?: number;
};

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const AR_DIGITS = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);

/** يجمع لكل مرجع في السكريبت: النص المعروض ومصدره وبطاقته ورقمها، ثم يقابله بالمرجع إن أُعطي عميل. */
export const auditEpisodeQuran = async (episode: string, opts: { client?: Pick<QuranClient, "verse"> & { env?: string } | null; frames?: boolean } = {}): Promise<{ audits: VerseAudit[]; store: { file: string; sha256: string; mtime: string } | null; preview: { file: string; sha256: string; mtime: string } | null }> => {
  const scriptPath = await resolveScriptPath(episode);
  const dir = path.dirname(scriptPath);
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const qfile = quranPathFor(scriptPath);
  // النص المعروض فعلًا في البطاقة: نص السكريبت أولًا ([آية: … | النص])، ثم quran.json للعلامات القديمة
  const { effectiveAyahTexts } = await import("./scriptText");
  const store: Record<string, string> = Object.fromEntries((await effectiveAyahTexts(scriptPath)).ayahs.map((a) => [a.key, a.text]));
  const plan = await readPlanFile(scriptPath);
  const refs = parsed.chapters.flatMap((c) => c.blocks).filter((b) => b.kind === "ayah") as { ref: string }[];
  const storeInfo = existsSync(qfile) ? { file: path.basename(qfile), sha256: createHash("sha256").update(await readFile(qfile)).digest("hex"), mtime: (await stat(qfile)).mtime.toISOString() } : null;
  const previewFile = path.join(dir, "previews", "episode.mp4");
  const previewInfo = existsSync(previewFile) ? { file: "previews/episode.mp4", sha256: createHash("sha256").update(await readFile(previewFile)).digest("hex"), mtime: (await stat(previewFile)).mtime.toISOString() } : null;
  // مواضع البطاقات في المعاينة النشطة (من الخطة الحالية؛ تُعرض الصورة ليُتحقق منها بالعين)
  const starts = new Map<string, { at: number; dur: number; id: string; label: string }>();
  if (plan) {
    let t = 0;
    try {
      const { introFramesFor } = await import("../remotion/scenes/ChannelIntro");
      const { channelInfo, loadChannel } = await import("../channel/index");
      t = introFramesFor(channelInfo(loadChannel()), plan) / 30;
    } catch { t = 0; }
    for (const c of plan.chapters) for (const s of c.scenes) {
      const d = sceneSeconds(s);
      if (s.template === "verse-card" && s.ayahKey) starts.set(s.ayahKey, { at: t, dur: d, id: s.id, label: String(s.props?.reference ?? "") });
      t += d;
    }
  }
  const audits: VerseAudit[] = [];
  for (const { ref } of refs) {
    const r = parseAyahRef(ref);
    if (!r.ok) { audits.push({ key: ref, surah: 0, surahName: "", from: 0, to: 0, numbers: { ok: false, notes: [r.reason] }, categories: { letter: "pending", haraka: "pending", uthmani: "pending", mark: "pending" }, ops: [], status: "failed", reason: r.reason }); continue; }
    const { key, surah, surahName, from, to } = r.ref;
    const card = starts.get(key);
    const shown = store[key];
    const notes: string[] = [];
    let numbersOk = true;
    // رقم السورة والآية: اسم السورة في السكريبت، ومفتاح البطاقة في الخطة، والتسمية المعروضة، وأرقام نهايات الآيات في النص
    if (!card) { numbersOk = false; notes.push("لا بطاقة verse-card بهذا المفتاح في الخطة"); }
    else {
      const label = toLatinDigits(card.label);
      const nameOk = label.includes(SURAH_NAMES[surah - 1] ?? "\u0000");
      const nums = Array.from(label.matchAll(/\d+/g)).map((m) => Number(m[0]));
      const numOk = from === to ? nums.length === 1 && nums[0] === from : nums[0] === from && nums[nums.length - 1] === to;
      notes.push(`التسمية على البطاقة «${card.label}»: السورة ${nameOk ? "صحيحة" : "لا تطابق"} (${surah} ${surahName})، والآية ${numOk ? "صحيحة" : "لا تطابق"} (${from === to ? from : `${from}–${to}`})`);
      if (!nameOk || !numOk) numbersOk = false;
    }
    if (shown) {
      const ends = ayahEndNumbers(shown);
      const expected = from === to ? [] : Array.from({ length: to - from + 1 }, (_, k) => from + k);
      const endsOk = ends.length === expected.length && ends.every((v, k) => v === expected[k]);
      notes.push(from === to ? (ends.length ? `في النص علامة نهاية آية (${ends.map(AR_DIGITS).join("، ")}) لآية واحدة` : "آية واحدة بلا علامة نهاية داخل النص (كما في طريقة البطاقة)") : `علامات نهاية الآيات في النص: ${ends.map(AR_DIGITS).join("، ") || "لا شيء"} (المتوقع ${expected.map(AR_DIGITS).join("، ")})`);
      if (!endsOk) numbersOk = false;
    }
    const base: VerseAudit = { key, surah, surahName, from, to, sceneId: card?.id, label: card?.label, shown, shownSha256: shown ? sha(shown) : undefined, numbers: { ok: numbersOk, notes }, categories: { letter: "pending", haraka: "pending", uthmani: "pending", mark: "pending" }, ops: [], status: shown ? "pending" : "missing", reason: shown ? undefined : "لا نص معروض لهذه الآية في quran.json" };
    if (card && opts.frames !== false && previewInfo) {
      const at = card.at + Math.max(0, card.dur - 0.7);
      base.frameAt = at;
      base.frame = await grabFrame(previewFile, at).catch(() => undefined);
    }
    if (shown && opts.client) {
      try {
        const verses = [];
        for (let n = from; n <= to; n++) verses.push(await opts.client.verse(`${surah}:${n}`));
        const refText = composeVerses(verses);
        const returnedOk = verses.every((v, k) => v.number === from + k);
        if (!returnedOk) { base.numbers.ok = false; base.numbers.notes.push("رقم الآية الذي أعاده المرجع لا يطابق المطلوب"); }
        const ops = alignDiff(shown, refText);
        const cat = (c: string): CategoryResult => (ops.some((o) => o.cls === c || (c === "mark" && o.cls === "other")) ? "differs" : "match");
        base.ops = ops;
        base.categories = { letter: cat("letter"), haraka: cat("haraka"), uthmani: cat("uthmani"), mark: cat("mark") };
        base.reference = { source: "مرجع مراجعة يدوي مُقدَّم من صاحب القناة", field: "text_uthmani", env: opts.client.env ?? "؟", fetchedAt: new Date().toISOString(), returned: verses.map((v) => ({ key: v.key, number: v.number })), sha256: sha(refText) };
        base.status = ops.length || !base.numbers.ok ? "differs" : "match";
      } catch (err) {
        base.status = "failed";
        base.reason = `تعذّر جلب المرجع: ${(err as Error).message}`;
      }
    }
    audits.push(base);
  }
  return { audits, store: storeInfo, preview: previewInfo };
};

const run = promisify(execFile);
/** لقطة البطاقة من المعاينة النشطة (تُضمَّن في التقرير صورةً، لا نصًّا). */
const grabFrame = async (video: string, at: number): Promise<string> => {
  const tmp = path.join(path.dirname(video), `.frame-${process.pid}-${Math.round(at * 1000)}.jpg`);
  try {
    await run("ffmpeg", ["-nostdin", "-v", "error", "-y", "-ss", at.toFixed(3), "-i", video, "-frames:v", "1", "-vf", "crop=iw*0.56:ih*0.62:iw*0.22:ih*0.17,scale=1200:-1", "-q:v", "3", tmp]);
    return `data:image/jpeg;base64,${(await readFile(tmp)).toString("base64")}`;
  } finally {
    await rm(tmp, { force: true });
  }
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const CAT: Record<CategoryResult, string> = { match: "<span class=ok>مطابق</span>", differs: "<span class=no>فيه فروق</span>", pending: "<span class=hold>لم يُقابَل بعد</span>" };
const STATUS: Record<VerseAudit["status"], string> = { match: "<span class=ok>مطابق للمرجع</span>", differs: "<span class=no>فيه فروق</span>", pending: "<span class=hold>تحتاج المرجع المعتمد</span>", missing: "<span class=no>لا نص معروض</span>", failed: "<span class=no>تعذّر التحقق</span>" };
const OP: Record<DiffOp["op"], string> = { sub: "استبدال", ins: "ناقص في المعروض", del: "زائد في المعروض" };

/** يكتب reviews/quran-check.html: الأدلة والنتائج لكل مرجع. لا يكتب نص المرجع ولا يغيّر أي اعتماد. */
export const writeQuranAuditReport = async (episode: string, result: Awaited<ReturnType<typeof auditEpisodeQuran>>, meta: { provenance?: string; environment?: string } = {}): Promise<string> => {
  const dir = path.join(path.dirname(await resolveScriptPath(episode)), "reviews");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "quran-check.html");
  const when = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const cards = result.audits.map((a) => {
    const chars = a.shown ? Array.from(a.shown.normalize("NFC")) : [];
    const counts = chars.reduce<Record<string, number>>((m, c) => ((m[classifyChar(c)] = (m[classifyChar(c)] ?? 0) + 1), m), {});
    const ops = a.ops.length
      ? `<table><thead><tr><th>الموضع</th><th>النوع</th><th>الفئة</th><th>في المعروض</th><th>في المرجع</th><th>سياق المعروض</th></tr></thead><tbody>${a.ops.slice(0, 40).map((o) => `<tr><td>${o.at}</td><td>${OP[o.op]}</td><td>${CLASS_AR[o.cls]}</td><td>${o.shown ? codepoint(o.shown) : "—"}</td><td>${o.ref ? codepoint(o.ref) : "—"}</td><td class=ar>${esc(chars.slice(Math.max(0, o.at - 4), o.at + 4).join(""))}</td></tr>`).join("")}</tbody></table>`
      : a.reference ? "<p>لا فرق في أي رمز بعد توحيد يونيكود (NFC).</p>" : "";
    return `<article><header><b>${esc(a.surahName)} ${a.from === a.to ? a.from : `${a.from}–${a.to}`}</b><code>${esc(a.key)}</code><span>${a.sceneId ? `بطاقة ${esc(a.sceneId)}` : ""}</span>${STATUS[a.status]}</header>
<dl>
<div><dt>النص المعروض (المحلي)</dt><dd class="ar q">${a.shown ? esc(a.shown) : "—"}</dd></div>
<div><dt>مصدره الإنتاجي</dt><dd><code>quran.json</code> ← المفتاح <code>${esc(a.key)}</code> ← تدمجه <code>withQuran</code> في <code>props.text</code> لبطاقة ${esc(a.sceneId ?? "—")} (المفتاح <code>ayahKey</code> في plan.json)، ويرسمه VerseCard نصًّا بخط Amiri. بصمة النص: <code>${a.shownSha256?.slice(0, 16) ?? "—"}</code> · ${chars.length} رمزًا (حروف ${counts.letter ?? 0}، تشكيل ${counts.haraka ?? 0}، رسم عثماني ${counts.uthmani ?? 0}، علامات ${counts.mark ?? 0}).</dd></div>
<div><dt>البطاقة في المعاينة النشطة</dt><dd>${a.frame ? `<img src="${a.frame}" alt="بطاقة ${esc(a.key)}"><br>` : "—"}${a.frameAt ? `previews/episode.mp4 عند ${a.frameAt.toFixed(1)} ث` : ""}</dd></div>
<div><dt>النص المرجعي ومصدره</dt><dd>${a.reference ? `${esc(a.reference.source)}، الحقل <code>${a.reference.field}</code>، البيئة <code>${esc(a.reference.env)}</code>${a.reference.env !== "production" ? " <span class=no>ليست بيئة الإنتاج</span>" : ""}، جُلب ${esc(a.reference.fetchedAt)}. أعاد: ${a.reference.returned.map((v) => `${v.key} (الآية ${v.number})`).join("، ")}. بصمته <code>${a.reference.sha256.slice(0, 16)}</code>. نصه لا يُحفظ في المستودع.` : `<span class=hold>لم يُجلب</span>${a.reason ? ` · ${esc(a.reason)}` : ""}`}</dd></div>
<div><dt>رقم السورة والآية</dt><dd>${a.numbers.ok ? "<span class=ok>سليم</span>" : "<span class=no>يحتاج مراجعة</span>"}<ul>${a.numbers.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></dd></div>
<div><dt>المقارنة التفصيلية</dt><dd>الحروف ${CAT[a.categories.letter]} · التشكيل ${CAT[a.categories.haraka]} · الرسم العثماني ${CAT[a.categories.uthmani]} · العلامات الخاصة ${CAT[a.categories.mark]}${ops}</dd></div>
</dl></article>`;
  }).join("");
  const pending = result.audits.some((a) => a.status !== "match");
  // خط Amiri نفسه الذي يرسم به VerseCard، مضمَّنًا حتى يُقرأ الرسم العثماني في التقرير كما في البطاقة
  const fontFile = fileURLToPath(new URL("../../public/fonts/Amiri-Regular.ttf", import.meta.url));
  const fontFace = existsSync(fontFile) ? `@font-face{font-family:AmiriReport;src:url(data:font/ttf;base64,${(await readFile(fontFile)).toString("base64")}) format("truetype")}` : "";
  await writeFile(file, `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مطابقة الآيات — الحلقة ${esc(episode)}</title>
<style>${fontFace}:root{--ink:#111;--rule:#ddd;--hl:#E8F542}*{box-sizing:border-box}body{margin:0;background:#f6f6f3;color:var(--ink);font:16px/1.8 "IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif}.wrap{max-width:1100px;margin:0 auto;padding:24px 16px 64px}h1{font-size:26px;margin:0 0 6px}article{background:#fff;border:1px solid var(--rule);border-radius:12px;padding:14px 16px;margin:16px 0;overflow-wrap:anywhere}article header{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:8px}dl{margin:0;display:grid;gap:8px}dl div{display:grid;grid-template-columns:170px 1fr;gap:12px;min-width:0}dt{color:#555;font-weight:700}dd{margin:0;min-width:0}.q{font-family:AmiriReport,Amiri,serif;font-size:24px;line-height:2.2;background:#fafaf6;border-inline-start:4px solid var(--hl);padding:6px 12px}img{max-width:100%;border:1px solid var(--rule);border-radius:8px}table{border-collapse:collapse;width:100%;font-size:14px;margin-top:8px}th,td{border:1px solid var(--rule);padding:4px 6px;text-align:start}td.ar{font-family:AmiriReport,Amiri,serif;font-size:20px}code{background:#f0f0ea;padding:0 4px;border-radius:4px;direction:ltr;unicode-bidi:isolate}.ok{background:#e5f3ea;color:#1f6f43;padding:0 5px;font-weight:700}.no{background:#fbe6e1;color:#C2412D;padding:0 5px;font-weight:700}.hold{background:#e8eef7;color:#24467a;padding:0 5px;font-weight:700}.note{background:#fff;border:1px solid var(--rule);border-radius:10px;padding:12px 16px}@media (max-width:640px){dl div{grid-template-columns:1fr;gap:0}}</style></head><body><div class="wrap">
<h1>مطابقة الآيات — الحلقة ${esc(episode)}</h1>
<p>${when} · ${pending ? "<span class=hold>لم تكتمل المطابقة بالمرجع المعتمد</span>" : "<span class=ok>كل المراجع مطابقة</span>"} · هذا التقرير دليل للمراجعة، ولا يغيّر أي اعتماد. القرار في «سجل التوثيق».</p>
<div class="note"><p><b>ملف النص المحلي:</b> ${result.store ? `<code>${esc(result.store.file)}</code> · بصمته <code>${result.store.sha256.slice(0, 16)}</code> · آخر تعديل ${esc(result.store.mtime)}` : "غير موجود"}</p>
<p><b>المعاينة النشطة:</b> ${result.preview ? `<code>${esc(result.preview.file)}</code> · بصمتها <code>${result.preview.sha256.slice(0, 16)}</code> · ${esc(result.preview.mtime)}` : "غير موجودة"}</p>
${meta.provenance ? `<p>${meta.provenance}</p>` : ""}${meta.environment ? `<p>${meta.environment}</p>` : ""}
<p><b>طريقة المقارنة:</b> توحيد يونيكود NFC وحده، دون حذف تشكيل ولا علامة. ثم محاذاة رمزًا برمز، وتصنيف كل فرق: حروف، أو تشكيل، أو رسم عثماني (الألف الخنجرية، وألف الوصل، والمدة، والسكون العثماني، والصفر المستدير، والحروف الصغيرة)، أو علامات خاصة (الوقف، ونهاية الآية، وأرقامها).</p></div>
${cards}
</div></body></html>\n`, "utf8");
  return file;
};
