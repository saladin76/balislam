/**
 * سجل العلماء وسجل الكتب (D206، عمود رفوف «زبدة الكتب»): بيانات مشتركة بين «زبدة الكتب» و«دفاتر الزمن».
 *
 * - المكان: `channels/zubdat-alkutub/library/scholars.json` و`books.json` (محتوى مالك يحفظه الاستوديو في main، D101).
 *   «زبدة الكتب» صاحبة السجلين لأن سلسلة العالِم وكتبه فيها؛ و«دفاتر الزمن» تقرؤهما لحلقة التعريف بالعالِم.
 * - بوابة الاختيار (المرجع «اختيار العلماء»): عالم عليه خلاف عقدي لا يُعلَّم «اعتمده المالك» إلا بمسار تقرير المتخصص.
 * - النصوص التي قد تُنشر (الاسم والعنوان والمجال) تمر على فحص الآثار (القاعدة الأولى).
 */
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { channelsDir } from "../channel";
import { findTraces } from "../package/traces";
import { ID_RE, REVIEW_STATES, type Book, type Books, type ReviewState, type Scholar, type Scholars } from "./shared";
export * from "./shared";

export const LIBRARY_CHANNEL = "zubdat-alkutub";
export const LIBRARY_DIR = "library";
export const SCHOLARS_FILE = "scholars.json";
export const BOOKS_FILE = "books.json";

export const libraryPath = (file: string, root = channelsDir()) => path.join(root, LIBRARY_CHANNEL, LIBRARY_DIR, file);

const traceIssues = (where: string, ...texts: (string | undefined)[]) =>
  texts.flatMap((t) => (t ? findTraces(t).map((h) => `${where}: أثر لأدوات الإنتاج «${h}» (القاعدة الأولى).`) : []));

export const scholarIssues = (s: Scholar): string[] => {
  const out: string[] = [];
  const w = `العالِم ${s?.id ?? "؟"}`;
  if (!s || typeof s !== "object") return ["سجل عالم غير صالح."];
  if (!ID_RE.test(s.id ?? "")) out.push(`${w}: المعرّف غير صالح.`);
  if (!s.name?.trim()) out.push(`${w}: الاسم مطلوب.`);
  if (!Number.isInteger(s.died?.hijri) || !Number.isInteger(s.died?.gregorian) || s.died.hijri < 1 || s.died.gregorian < 570)
    out.push(`${w}: سنة الوفاة (هجري وميلادي) مطلوبة.`);
  if (!s.place?.trim() || !s.field?.trim()) out.push(`${w}: المكان والمجال مطلوبان.`);
  if (!REVIEW_STATES.includes(s.review?.state as ReviewState)) out.push(`${w}: حالة المراجعة غير معروفة.`);
  if (typeof s.review?.doctrinalDispute !== "boolean") out.push(`${w}: «عليه خلاف عقدي» نعم أو لا.`);
  if (s.review?.state === "owner-approved" && s.review.doctrinalDispute && !s.review.report?.trim())
    out.push(`${w}: عليه خلاف عقدي؛ لا يُعتمد إلا بتقرير متخصص مكتوب (اذكر مساره).`);
  if (s.review?.state === "report-written" && !s.review.report?.trim()) out.push(`${w}: «كُتب تقرير المتخصص» يحتاج مسار التقرير.`);
  if (s.intro && (!ID_RE.test(s.intro.channel ?? "") || !/^\d{3}$/.test(s.intro.episode ?? ""))) out.push(`${w}: حلقة التعريف = قناة ورقم حلقة من ثلاث خانات.`);
  if (!ID_RE.test(s.series ?? "")) out.push(`${w}: سلسلة العالِم مطلوبة.`);
  return [...out, ...traceIssues(w, s.name, s.field, s.place)];
};

export const bookIssues = (b: Book, scholars: Scholar[] = []): string[] => {
  const out: string[] = [];
  const w = `الكتاب ${b?.id ?? "؟"}`;
  if (!b || typeof b !== "object") return ["سجل كتاب غير صالح."];
  if (!ID_RE.test(b.id ?? "")) out.push(`${w}: المعرّف غير صالح.`);
  if (!b.title?.trim() || !b.author?.trim()) out.push(`${w}: العنوان والمؤلف مطلوبان.`);
  if (b.scholar !== undefined && !scholars.some((s) => s.id === b.scholar)) out.push(`${w}: العالِم «${b.scholar}» ليس في السجل.`);
  if (!b.edition || typeof b.edition !== "object") out.push(`${w}: بيانات الطبعة مطلوبة (ولو فارغة حتى تُختار).`);
  if (b.parts !== null && !(Number.isInteger(b.parts) && b.parts >= 1 && b.parts <= 40)) out.push(`${w}: عدد الأجزاء بين ١ و٤٠ أو «لم يُحدد».`);
  if (!ID_RE.test(b.series ?? "")) out.push(`${w}: سلسلة الكتاب مطلوبة.`);
  return [...out, ...traceIssues(w, b.title, b.author)];
};

export const registryIssues = (scholars: Scholars | null, books: Books | null): string[] => {
  const out: string[] = [];
  const ss = scholars?.scholars ?? [];
  if (scholars && (scholars.version !== 1 || !Array.isArray(scholars.scholars))) out.push("سجل العلماء: الصيغة غير صالحة.");
  if (books && (books.version !== 1 || !Array.isArray(books.books))) out.push("سجل الكتب: الصيغة غير صالحة.");
  const dup = (ids: string[], what: string) => ids.filter((x, i) => ids.indexOf(x) !== i).forEach((x) => out.push(`${what}: المعرّف «${x}» مكرر.`));
  dup(ss.map((s) => s.id), "سجل العلماء");
  dup((books?.books ?? []).map((b) => b.id), "سجل الكتب");
  for (const s of ss) out.push(...scholarIssues(s));
  for (const b of books?.books ?? []) out.push(...bookIssues(b, ss));
  return out;
};

const readJson = <T>(f: string): T | null => {
  if (!existsSync(f)) return null;
  return JSON.parse(readFileSync(f, "utf8")) as T;
};
export const readScholars = (root?: string): Scholars => readJson<Scholars>(libraryPath(SCHOLARS_FILE, root)) ?? { version: 1, scholars: [] };
export const readBooks = (root?: string): Books => readJson<Books>(libraryPath(BOOKS_FILE, root)) ?? { version: 1, books: [] };

export class LibraryError extends Error {
  constructor(public issues: string[]) { super(issues.join(" ")); }
}

const writeAtomic = async (f: string, data: unknown) => {
  await mkdir(path.dirname(f), { recursive: true });
  const tmp = `${f}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2) + "\n");
  await rename(tmp, f);
};

/** يحفظ عالمًا (جديدًا أو معدّلًا) بعد فحص السجل كله */
export const saveScholar = async (s: Scholar, root?: string): Promise<Scholar> => {
  const cur = readScholars(root);
  const next: Scholars = { version: 1, scholars: [...cur.scholars.filter((x) => x.id !== s.id), s].sort((a, b) => a.died.hijri - b.died.hijri) };
  const issues = registryIssues(next, readBooks(root));
  if (issues.length) throw new LibraryError(issues);
  await writeAtomic(libraryPath(SCHOLARS_FILE, root), next);
  return s;
};

/** يحفظ كتابًا (جديدًا أو معدّلًا) بعد فحص السجل كله */
export const saveBook = async (b: Book, root?: string): Promise<Book> => {
  const cur = readBooks(root);
  const next: Books = { version: 1, books: [...cur.books.filter((x) => x.id !== b.id), b] };
  const issues = registryIssues(readScholars(root), next);
  if (issues.length) throw new LibraryError(issues);
  await writeAtomic(libraryPath(BOOKS_FILE, root), next);
  return b;
};
