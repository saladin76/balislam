/**
 * بوابة المحتوى (D101): فحوص البيانات لدفعٍ كل ملفاته «محتوى مالك» (scripts/contentPaths.mjs).
 * يشغّلها scripts/gate.mjs داخل نسخة الـcommit المدفوع نفسه، ولا تُطلب يدويًا.
 *
 *   npx tsx scripts/contentGate.mts --base <sha> <file>...
 *
 * لكل ملف متغيّر (مقارنةً بآخر ما على GitHub، --base):
 *   - JSON صالح (كل ملف .json).
 *   - plan.json: لا خطأ جديد في فحص الخطة (planIssues) لم يكن في النسخة السابقة.
 *   - script.md: لا خطأ جديد في فحص السكريبت (checkForChannel).
 *   - publish.json: لا أثر جديد لأدوات الإنتاج في أي نص (findTraces، القاعدة الأولى).
 *   - sentence-pronunciations.json (D131): لا قرآن ولا بسملة في أي نطق، وتشكيله ≥ ٩٨٪.
 *   - pace.json («سرعة الإلقاء»): سرعات وفاصل معروفة وحدها (checkPaceDoc).
 *   - tashkeel.md (D132): نص صالح غير فارغ (لا رموز تحكم ولا حروف تالفة، وفي حد الحجم)، بجوار سكريبت الحلقة.
 * «جديد» تعني: غير موجود في نسخة --base. الأخطاء القديمة لا تمنع حفظ تعديل لا يمسّها، ولا تُخفى:
 * يعرضها الاستوديو في مكانها. الخروج 0 فقط إذا لم يظهر شيء جديد.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isOwnerContentPath } from "./contentPaths.mjs";

const args = process.argv.slice(2);
const base = args.includes("--base") ? args[args.indexOf("--base") + 1]! : "";
const files = args.filter((a, i) => a !== "--base" && args[i - 1] !== "--base");
const root = process.cwd();

const showBase = (file: string): string | null => {
  if (!base) return null;
  try { return execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }); }
  catch { return null; }
};
const failures: string[] = [];
const fresh = (now: string[], before: string[]) => { const b = new Set(before); return now.filter((x) => !b.has(x)); };
const strings = (v: unknown, out: string[] = []): string[] => {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
  return out;
};

const { runWithChannel, loadChannel } = await import("../src/channel/index.ts");
const { planIssues } = await import("../src/plan/validate.ts");
const { parseScript } = await import("../src/script/parse.ts");
const { checkForChannel } = await import("../src/script/checkChannel.ts");
const { findTraces } = await import("../src/package/traces.ts");

for (const file of files) {
  if (!isOwnerContentPath(file)) { failures.push(`${file}: ليس من ملفات محتوى المالك؛ يمر على البوابة الكاملة.`); continue; }
  const abs = path.join(root, file);
  if (!existsSync(abs)) continue; // حذف: لا محتوى يُفحص
  const text = readFileSync(abs, "utf8");
  const before = showBase(file);
  const channel = /^channels\/([^/]+)\//.exec(file)?.[1];
  try {
    if (file.endsWith(".json")) {
      let data: unknown;
      try { data = JSON.parse(text); } catch (e) { failures.push(`${file}: JSON غير صالح (${(e as Error).message}).`); continue; }
      const old = (() => { try { return before === null ? null : JSON.parse(before); } catch { return null; } })();
      if (file.endsWith("/plan.json") && channel) {
        const issues = (p: any) => runWithChannel(channel, () => planIssues(p, loadChannel(p?.channel ?? channel)))
          .filter((i) => i.level === "error").map((i) => `${i.sceneId}: ${i.message}`);
        const added = fresh(issues(data), old ? issues(old) : []);
        for (const a of added) failures.push(`${file}: خطأ جديد في الخطة — ${a}`);
      }
      if (file.endsWith("/sentence-pronunciations.json")) {
        // D131: a written pronunciation is sent to the voice: never Quran or the basmala, tashkeel ≥ 98%
        const { checkSentenceSay } = await import("../src/voice/sentencePronunciation.ts");
        const entries = Array.isArray((data as { entries?: unknown })?.entries) ? (data as { entries: { scene?: string; say?: unknown }[] }).entries : [];
        for (const e of entries) {
          const bad = typeof e?.say === "string" ? checkSentenceSay(e.say) : "النطق ليس نصًا.";
          if (bad) failures.push(`${file}: نطق مرفوض في ${e?.scene ?? "؟"} — ${bad}`);
        }
      }
      if (file.endsWith("/pace.json")) {
        // «سرعة الإلقاء»: only the known speeds and gaps reach main (the Studio reads nothing else from it)
        const { checkPaceDoc } = await import("../src/voice/pace.ts");
        for (const e of checkPaceDoc(data)) failures.push(`${file}: ${e}`);
      }
      // D206: سجل العلماء وسجل الكتب بصيغتهما وبوابة الاختيار (لا اعتماد لعالم عليه خلاف بلا تقرير متخصص) وبلا آثار
      if (/\/library\/(scholars|books)\.json$/.test(file)) {
        const { registryIssues } = await import("../src/library/registry.ts");
        const isScholars = file.endsWith("/scholars.json");
        const sibling = (name: string) => { try { return JSON.parse(readFileSync(path.join(path.dirname(abs), name), "utf8")); } catch { return null; } };
        const errs = (x: unknown) => registryIssues(isScholars ? x as never : sibling("scholars.json"), isScholars ? sibling("books.json") : x as never);
        const added = fresh(errs(data), old ? errs(old) : []);
        for (const a of added) failures.push(`${file}: ${a}`);
      }
      if (file.endsWith("/publish.json") || file.endsWith("/publish.draft.json")) {
        const hits = (v: unknown) => strings(v).flatMap((s) => findTraces(s));
        const added = fresh([...new Set(hits(data))], old ? [...new Set(hits(old))] : []);
        for (const a of added) failures.push(`${file}: أثر لأدوات الإنتاج في نص النشر — «${a}» (القاعدة الأولى).`);
      }
      // «راجعها علميًا»: الإذن المسجّل مكتمل (الاسم، والتاريخ، والنطاق، وتأكيد الإذن المكتوب)
      if (file.endsWith("/publish.json")) {
        const { reviewerIssues } = await import("../src/package/reviewer.ts");
        const errs = (x: any) => reviewerIssues(x?.long?.reviewer);
        for (const a of fresh(errs(data), old ? errs(old) : [])) failures.push(`${file}: ${a}`);
      }
      // مواسم السنة الهجرية (عمود «بالإسلام»، عاشرًا/٦): المواسم المتفق عليها وحدها، وتواريخ سليمة، وبلا آثار
      if (/^channels\/[^/]+\/seasons\.json$/.test(file)) {
        const { seasonsIssues } = await import("../src/studio/seasons.ts");
        for (const a of fresh(seasonsIssues(data as never), old ? seasonsIssues(old) : [])) failures.push(`${file}: ${a}`);
      }
      // ترتيب النشر وبناء المخزون (D213): أسابيع ودفعات صحيحة، ولا تواريخ (ترتيب لا مواعيد)
      if (/^channels\/[^/]+\/stock\.json$/.test(file)) {
        const { stockIssues } = await import("../src/studio/stock.ts");
        for (const a of fresh(stockIssues(data as never), old ? stockIssues(old) : [])) failures.push(`${file}: ${a}`);
      }
    } else if (file.endsWith("/tashkeel.md")) {
      // D132: the voweled copy is sent to the voice only; a broken or empty file never reaches main
      const { checkTashkeelText } = await import("../src/voice/tashkeelFile.ts");
      const errs = (src: string) => checkTashkeelText(src);
      const added = fresh(errs(text), before === null ? [] : errs(before));
      for (const a of added) failures.push(`${file}: ${a}`);
      if (!existsSync(path.join(path.dirname(abs), "script.md"))) failures.push(`${file}: لا سكريبت بجوار النسخة المشكولة؛ مكانها مجلد الحلقة نفسها.`);
    } else if (file.endsWith("/script.md") && channel) {
      const errs = (src: string) => runWithChannel(channel, () => {
        const r = checkForChannel(parseScript(src, file));
        // بلا رقم السطر: إضافة سطر فوق خطأ قديم لا تجعله «جديدًا»
        return r.issues.filter((i) => i.level === "error").map((i) => `${i.code}: ${i.message}`);
      });
      const added = fresh(errs(text), before === null ? [] : errs(before));
      for (const a of added) failures.push(`${file}: خطأ جديد في السكريبت — ${a}`);
    }
  } catch (e) {
    failures.push(`${file}: تعذّر فحصه (${(e as Error).message}).`);
  }
}

if (failures.length) {
  console.error("✗ بوابة المحتوى رفضت الدفع:");
  for (const f of failures) console.error(`  • ${f}`);
  process.exit(1);
}
console.log(`✓ بوابة المحتوى: ${files.length} ملف محتوى بلا خطأ جديد.`);
