/** Server-only: ترتيب النشر وبناء المخزون (src/studio/stock.ts): القراءة والحفظ، وحقائق الحلقات، واعتماد السكريبت الموقّع، وقالب الحلقة. */
import path from "node:path";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { channelPaths } from "../channel";
import { listScriptEpisodeDirs } from "../script/episodes";
import { workflowSigningKey } from "./signingKey";
import { DRAFT_STATUS, productionRefusal, stockIssues, stockViews, type EpisodeFacts, type Stock, type StockEpisodeView } from "./stock";

export const STOCK_FILE = "stock.json";
/** اعتماد المالك لسكريبت المسودة: محلي موقّع بمفتاح الجهاز، لا يُرفع (مثل سجل إنتاج المشاهد) */
export const SCRIPT_APPROVAL_FILE = "script-approval.local.json";
export const STOCK_FILES = ["script.md", "research.md", "scenes.md", "publish.draft.json"] as const;
export type StockFile = (typeof STOCK_FILES)[number];

export const stockPath = (ch: string) => path.join(channelPaths(ch).dir, STOCK_FILE);
export const readStock = (ch: string): Stock => {
  const f = stockPath(ch);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Stock) : { version: 1, phase: 1, slots: [] };
};

export class StockError extends Error {
  constructor(public issues: string[]) { super(issues.join(" ")); }
}

const writeAtomic = async (f: string, text: string) => {
  await mkdir(path.dirname(f), { recursive: true });
  const tmp = `${f}.${randomUUID()}.tmp`;
  await writeFile(tmp, text);
  await rename(tmp, f);
};

/** يحفظ ترتيب النشر كله (المالك يعدّله) بعد الفحص؛ الترتيب بالأسبوع */
export const saveStock = async (ch: string, s: Stock): Promise<Stock> => {
  const next: Stock = { ...s, version: 1, slots: [...s.slots].sort((a, b) => a.week - b.week || (a.episode ?? "").localeCompare(b.episode ?? "")) };
  const issues = stockIssues(next);
  if (issues.length) throw new StockError(issues);
  await writeAtomic(stockPath(ch), JSON.stringify(next, null, 2) + "\n");
  return next;
};

/** ترويسة السكريبت وحدها (بلا فحص المحتوى) */
export const scriptFrontmatter = (text: string): Record<string, unknown> => {
  const m = /^\s*---\n([\s\S]*?)\n---/.exec(text.replace(/\r\n?/g, "\n"));
  if (!m) return {};
  try { const d = parseYaml(m[1]!); return d && typeof d === "object" ? (d as Record<string, unknown>) : {}; } catch { return {}; }
};

const sha = (t: string | Buffer) => createHash("sha256").update(t).digest("hex");
type ScriptApproval = { version: 1; channel: string; episode: string; scriptSha256: string; at: string; mac: string };
const approvalMac = (a: Omit<ScriptApproval, "mac">) =>
  createHmac("sha256", workflowSigningKey()).update(JSON.stringify([a.version, a.channel, a.episode, a.scriptSha256, a.at])).digest("hex");

const readApproval = (dir: string, ch: string, num: string, scriptSha: string): StockEpisodeView["approval"] => {
  const f = path.join(dir, SCRIPT_APPROVAL_FILE);
  if (!existsSync(f)) return { approved: false };
  try {
    const a = JSON.parse(readFileSync(f, "utf8")) as ScriptApproval;
    const expect = approvalMac(a);
    const ok = a.channel === ch && a.episode === num && typeof a.mac === "string" && a.mac.length === expect.length
      && timingSafeEqual(Buffer.from(a.mac), Buffer.from(expect));
    if (!ok) return { approved: false };
    return a.scriptSha256 === scriptSha ? { approved: true, at: a.at } : { approved: true, at: a.at, stale: true };
  } catch { return { approved: false }; }
};

/** حقائق كل حلقة سكريبت في القناة: العنوان والحالة والسلسلة والملفات واعتماد السكريبت */
export const episodeFacts = async (ch: string): Promise<EpisodeFacts[]> => {
  const epDir = channelPaths(ch).episodes;
  const out: EpisodeFacts[] = [];
  for (const d of await listScriptEpisodeDirs(epDir)) {
    const dir = path.join(epDir, d);
    const text = await readFile(path.join(dir, "script.md"), "utf8");
    const fm = scriptFrontmatter(text);
    const num = d.slice(0, 3);
    out.push({
      number: num, dir: d, title: typeof fm.title === "string" ? fm.title : d, status: fm.status,
      ...(typeof fm.series === "string" ? { series: fm.series } : {}),
      files: { script: true, research: existsSync(path.join(dir, "research.md")), scenes: existsSync(path.join(dir, "scenes.md")), publish: existsSync(path.join(dir, "publish.draft.json")) },
      approval: readApproval(dir, ch, num, sha(text)),
    });
  }
  return out;
};

export const stockOverview = async (ch: string): Promise<{ channel: string; frozen?: Stock["frozen"]; phase: number; views: StockEpisodeView[]; issues: string[] }> => {
  const stock = readStock(ch);
  return { channel: ch, ...(stock.frozen ? { frozen: stock.frozen } : {}), phase: stock.phase, views: stockViews(ch, stock, await episodeFacts(ch)), issues: stockIssues(stock) };
};

const episodeDir = async (ch: string, num: string): Promise<string> => {
  if (!/^\d{3}$/.test(num)) throw new StockError(["رقم الحلقة غير صالح."]);
  const epDir = channelPaths(ch).episodes;
  const d = (await listScriptEpisodeDirs(epDir)).filter((x) => x.startsWith(`${num}-`));
  if (d.length !== 1) throw new StockError([`الحلقة ${num} غير موجودة.`]);
  return path.join(epDir, d[0]!);
};

/** نص ملف من ملفات الحلقة للعرض (للقراءة فقط) */
export const readStockFile = async (ch: string, num: string, name: string): Promise<string | null> => {
  if (!(STOCK_FILES as readonly string[]).includes(name)) throw new StockError(["ملف غير معروف."]);
  const f = path.join(await episodeDir(ch, num), name);
  return existsSync(f) ? readFile(f, "utf8") : null;
};

/** «اعتمدت السكريبت»: اعتماد المالك لنص المسودة كما هو الآن (موقّع؛ أي تعديل بعده يُظهره «تغيّر بعد اعتمادك»). لا صوت ولا رندر. */
export const approveDraftScript = async (ch: string, num: string): Promise<{ at: string }> => {
  const dir = await episodeDir(ch, num);
  const text = await readFile(path.join(dir, "script.md"), "utf8");
  const body = { version: 1 as const, channel: ch, episode: num, scriptSha256: sha(text), at: new Date().toISOString() };
  await writeAtomic(path.join(dir, SCRIPT_APPROVAL_FILE), JSON.stringify({ ...body, mac: approvalMac(body) }, null, 2) + "\n");
  return { at: body.at };
};

/** المانع من الإنتاج لحلقة بمسار سكريبتها (المسودة، ثم تجميد القناة) */
export const productionBlockFor = async (ch: string, scriptPath: string): Promise<string | null> => {
  const status = existsSync(scriptPath) ? scriptFrontmatter(await readFile(scriptPath, "utf8")).status : undefined;
  const stock = existsSync(stockPath(ch)) ? readStock(ch) : null;
  return productionRefusal({ status, frozen: stock?.frozen });
};

/** قالب حلقة المخزون: script.md وresearch.md وscenes.md وpublish.json مسودة (templates/stock/) */
export const scaffoldStockEpisode = async (o: { channel: string; number: string; slug: string; title: string; series?: string; domain: string; templatesRoot: string }): Promise<string> => {
  if (!/^\d{3}$/.test(o.number)) throw new StockError(["رقم الحلقة يجب أن يكون ثلاث خانات."]);
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(o.slug)) throw new StockError(["الاسم المختصر بالحروف اللاتينية الصغيرة والشرطات."]);
  if (!o.title.trim()) throw new StockError(["العنوان فارغ."]);
  const epDir = channelPaths(o.channel).episodes;
  if ((await listScriptEpisodeDirs(epDir)).some((d) => d.startsWith(`${o.number}-`)) || existsSync(path.join(epDir, `${o.number}-${o.slug}`)))
    throw new StockError([`الحلقة ${o.number} موجودة بالفعل.`]);
  const dir = path.join(epDir, `${o.number}-${o.slug}`);
  const fill = (t: string) => t.replaceAll("{{TITLE}}", o.title.replaceAll('"', "'")).replaceAll("{{EPISODE}}", o.number)
    .replaceAll("{{DOMAIN}}", o.domain).replaceAll("{{SERIES}}", o.series ?? "").replaceAll("{{STATUS}}", DRAFT_STATUS);
  await mkdir(dir, { recursive: true });
  for (const name of STOCK_FILES) {
    const src = path.join(o.templatesRoot, "stock", name);
    await writeFile(path.join(dir, name), fill(await readFile(src, "utf8")));
  }
  return dir;
};
