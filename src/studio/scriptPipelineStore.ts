/**
 * Server-only (D234): سجل محرر المحتوى لكل حلقة (`channels/<القناة>/episodes/<الحلقة>/editor-review.json`، محتوى يُحفظ
 * في main ولا توقيع له، مثل templates/approvals.json)، وبوابة الصوت والرندر، وتسجيل مرور المحرر، ودفعة المحرر.
 * المنطق النقي في scriptPipeline.ts.
 */
import path from "node:path";
import os from "node:os";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { channelsDir } from "../channel";
import { listScriptEpisodeDirs } from "../script/episodes";
import {
  EDITOR_REVIEW_FILE, editorGateException, editorGateMessage, editorReviewIssues, editorState, scriptSentences, scriptSha256,
  type EditorPass, type EditorReview, type EditorState,
} from "./scriptPipeline";
import type { Stock } from "./stock";

/** مسار السكريبت ← القناة والحلقة ومجلد القناة (channels/<القناة>/episodes/<NNN-…>/script.md) */
export const scriptLocation = (scriptPath: string) => {
  const epDir = path.dirname(scriptPath);
  const channelDir = path.dirname(path.dirname(epDir));
  return { epDir, channelDir, channel: path.basename(channelDir), folder: path.basename(epDir), episode: /^(\d{3})(?:-|$)/.exec(path.basename(epDir))?.[1] };
};

export const editorReviewPath = (epDir: string) => path.join(epDir, EDITOR_REVIEW_FILE);

/** السجل إن كان صالحًا ويخص هذه الحلقة؛ وإلا null (السجل التالف لا يمنح مرورًا) */
export const readEditorReview = (epDir: string, channel: string, episode: string): EditorReview | null => {
  const f = editorReviewPath(epDir);
  if (!existsSync(f)) return null;
  try {
    const r = JSON.parse(readFileSync(f, "utf8")) as EditorReview;
    return editorReviewIssues(r, channel, episode).length ? null : r;
  } catch { return null; }
};

/** حالة المحرر لسكريبت بمساره (يقرأ النص الحالي والسجل) */
export const editorStateFor = async (scriptPath: string, text?: string): Promise<EditorState> => {
  const loc = scriptLocation(scriptPath);
  const source = text ?? (await readFile(scriptPath, "utf8"));
  return editorState(source, loc.episode ? readEditorReview(loc.epDir, loc.channel, loc.episode) : null);
};

const readStockAt = (channelDir: string): Stock | null => {
  const f = path.join(channelDir, "stock.json");
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, "utf8")) as Stock; } catch { return null; }
};

/**
 * بوابة المحرر (D234): سبب منع الصوت أو الرندر لهذا السكريبت، أو null.
 * voiceScenes: مشاهد طلب صوت بعينه (لا رندر)؛ تُفحص على الاستثناءات الصريحة (EDITOR_GATE_EXCEPTIONS، فارغة اليوم: D229 أُلغي بـ D235).
 */
export const editorGateRefusal = async (scriptPath: string, o: { voiceScenes?: readonly string[] | null } = {}): Promise<string | null> => {
  // يُغلق ولا يُفتح: سكريبت غير موجود لا يمر
  if (!existsSync(scriptPath)) return "لا سكريبت لهذه الحلقة؛ لا صوت ولا رندر قبل أن يمرّ سكريبتها بمحرر المحتوى (D234).";
  const state = await editorStateFor(scriptPath);
  if (state.reviewed && !state.pending.length) return null;
  const loc = scriptLocation(scriptPath);
  if (editorGateException({ channel: loc.channel, episode: loc.episode, voiceScenes: o.voiceScenes, voiceOnly: readStockAt(loc.channelDir)?.frozen?.voiceOnly })) return null;
  return editorGateMessage(state);
};

/** يرمي رسالة البوابة؛ يستدعيه كل مدخل يولّد صوتًا أو يرندر (tests/script-pipeline-gate.test.ts يفحص المداخل). */
export const assertEditorPassed = async (scriptPath: string, o: { voiceScenes?: readonly string[] | null } = {}): Promise<void> => {
  const why = await editorGateRefusal(scriptPath, o);
  if (why) throw new Error(why);
};

/** مسار السكريبت من وصف وسائط الرندر (`_render/<القناة>/<NNN-…>/<بصمة>/`): لرندر لا يعرف إلا الخطة والوسائط */
export const scriptPathFromRenderMedia = (base: string): string | null => {
  const m = /^_render\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*)\//.exec(base);
  return m ? path.join(channelsDir(), m[1]!, "episodes", m[2]!, "script.md") : null;
};

const writeAtomic = async (f: string, text: string) => {
  await mkdir(path.dirname(f), { recursive: true });
  const tmp = `${f}.${randomUUID()}.tmp`;
  await writeFile(tmp, text);
  await rename(tmp, f);
};

/**
 * يسجّل مرور المحرر على السكريبت كما هو الآن: كل جمله الحالية تصير «مرّت بالمحرر». يسجّله المنسّق بعد أن يسلّمه المالك
 * رد المحرر. expectSha: بصمة السكريبت كما أُرسل في الدفعة؛ إن تغيّر بعدها يُرفض (جمل لم يرها المحرر).
 */
export const recordEditorPass = async (scriptPath: string, o: {
  by: string; recordedBy: string; at?: string; batch?: number; expectSha?: string; grandfathered?: string; note?: string;
}): Promise<{ record: EditorReview; reviewed: number; file: string }> => {
  const loc = scriptLocation(scriptPath);
  if (!loc.episode) throw new Error("مسار السكريبت غير قياسي.");
  if (!o.by.trim() || !o.recordedBy.trim()) throw new Error("اذكر من راجع ومن سجّل.");
  const text = await readFile(scriptPath, "utf8");
  const sha = scriptSha256(text);
  if (o.expectSha && !sha.startsWith(o.expectSha.toLowerCase()))
    throw new Error(`تغيّر السكريبت بعد إرسال الدفعة (البصمة الآن ${sha.slice(0, 12)}، وفي الدفعة ${o.expectSha}): الجمل الجديدة لم يرها المحرر. أرسلها في دفعة جديدة.`);
  const prev = readEditorReview(loc.epDir, loc.channel, loc.episode);
  const before = editorState(text, prev);
  const sentences = [...new Set(scriptSentences(text).map((s) => s.hash))].sort();
  const pass: EditorPass = {
    at: o.at ?? new Date().toISOString(), by: o.by.trim(), recordedBy: o.recordedBy.trim(), ...(o.batch !== undefined ? { batch: o.batch } : {}),
    scriptSha256: sha, sentences: before.total, reviewed: before.pending.length,
    ...(o.grandfathered ? { grandfathered: o.grandfathered } : {}), ...(o.note ? { note: o.note } : {}),
  };
  const record: EditorReview = { version: 1, channel: loc.channel, episode: loc.episode, sentences, passes: [...(prev?.passes ?? []), pass] };
  const file = editorReviewPath(loc.epDir);
  await writeAtomic(file, JSON.stringify(record, null, 2) + "\n");
  return { record, reviewed: before.pending.length, file };
};

// ———————————————————— دفعة المحرر ————————————————————

export const GITHUB_BLOB = "https://github.com/saladin76/balislam/blob/main";
export const CHANNEL_NAMES: Record<string, string> = { balislam: "بالإسلام", "dafatir-alzaman": "دفاتر الزمن", "zubdat-alkutub": "زبدة الكتب" };
export const defaultEditorBatchDir = () => path.join(os.homedir(), "Desktop", "للمراجعة", "محرر-المحتوى");

export type EditorQueueItem = {
  channel: string; episode: string; folder: string; title: string; draft: boolean;
  stockBatch: number | null; week: number | null;
  scriptSha256: string; state: EditorState; repoPath: string;
};

const frontmatterField = (text: string, key: string): string | undefined => {
  const m = new RegExp(`^${key}:\\s*"?(.*?)"?\\s*$`, "m").exec(/^---\n([\s\S]*?)\n---/.exec(text.replace(/\r\n?/g, "\n"))?.[1] ?? "");
  return m?.[1];
};

/** كل سكريبت في القنوات غير المجمّدة فيه جمل تنتظر المحرر، مرتبًا بدفعة ترتيب النشر ثم الأسبوع ثم القناة (رمضان أولًا) */
export const editorQueue = async (root = channelsDir(), o: { includeFrozen?: boolean } = {}): Promise<EditorQueueItem[]> => {
  const out: EditorQueueItem[] = [];
  const channels = existsSync(root) ? readdirSync(root).filter((d) => existsSync(path.join(root, d, "channel.json"))).sort() : [];
  for (const ch of channels) {
    const stock = readStockAt(path.join(root, ch));
    // القناة المجمّدة (D211، D235) لا ترسل سكريبتاتها للمحرر إلا بطلب صريح (--include-frozen)
    if (stock?.frozen && !o.includeFrozen) continue;
    const epRoot = path.join(root, ch, "episodes");
    for (const folder of await listScriptEpisodeDirs(epRoot)) {
      const scriptPath = path.join(epRoot, folder, "script.md");
      const text = await readFile(scriptPath, "utf8");
      const state = editorState(text, readEditorReview(path.join(epRoot, folder), ch, folder.slice(0, 3)));
      if (state.reviewed && !state.pending.length) continue;
      const slot = stock?.slots.find((s) => s.episode === folder.slice(0, 3));
      out.push({
        channel: ch, episode: folder.slice(0, 3), folder, title: frontmatterField(text, "title") ?? folder,
        draft: (frontmatterField(text, "status") ?? "") === "مسودة", stockBatch: slot?.batch ?? null, week: slot?.week ?? null,
        scriptSha256: scriptSha256(text), state, repoPath: `channels/${ch}/episodes/${folder}/script.md`,
      });
    }
  }
  return out.sort((a, b) => (a.stockBatch ?? 999) - (b.stockBatch ?? 999) || (a.week ?? 999) - (b.week ?? 999) || a.channel.localeCompare(b.channel) || a.episode.localeCompare(b.episode));
};

export type EditorBatchManifest = { batch: number; at: string; items: { channel: string; episode: string; folder: string; scriptSha256: string; pending: number; partial: boolean }[] };

const ar = (n: number) => n.toLocaleString("ar-EG");
const two = (n: number) => String(n).padStart(2, "0");
const BATCH_RE = /^دفعة-المحرر-(\d{2,})\.json$/;

export const readEditorBatches = (dir: string): EditorBatchManifest[] =>
  existsSync(dir)
    ? readdirSync(dir).filter((f) => BATCH_RE.test(f)).map((f) => { try { return JSON.parse(readFileSync(path.join(dir, f), "utf8")) as EditorBatchManifest; } catch { return null; } })
      .filter((x): x is EditorBatchManifest => Boolean(x)).sort((a, b) => a.batch - b.batch)
    : [];

/** نص ملف الدفعة (Markdown) */
export const editorBatchMarkdown = (n: number, items: EditorQueueItem[], at: Date): string => {
  const head = [
    `# دفعة المحرر ${ar(n)}`,
    "",
    `**التاريخ:** ${at.toISOString().slice(0, 10)} · **عدد السكريبتات:** ${ar(items.length)}`,
    "",
    "## المطلوب",
    "",
    "مراجعة تحريرية لكل سكريبت أدناه قبل المراجعة العلمية واعتماد المالك (القاعدة D234: مسودة ← المحرر ← المراجعة العلمية بطبقتيها ← اعتماد المالك ← صوت ← رندر).",
    "- **«السكريبت كاملًا»:** راجع النص كله من الرابط.",
    "- **«الجمل المتغيّرة وحدها»:** راجعتَ هذا السكريبت من قبل، ثم تغيّرت فيه هذه الجمل (مثلًا بالمراجعة العلمية)؛ راجعها وحدها.",
    "- اكتب تعديلاتك أو «موافق» تحت كل سكريبت. لا تُغيَّر آية ولا حديث ولا مصدر؛ أي ملاحظة عليها تُكتب ملاحظة.",
    "",
    "## السكريبتات",
    "",
  ];
  const body = items.flatMap((x, i) => {
    const link = `${GITHUB_BLOB}/${x.repoPath}`;
    const research = `${GITHUB_BLOB}/${x.repoPath.replace(/script\.md$/, "research.md")}`;
    const lines = [
      `### ${ar(i + 1)}. ${CHANNEL_NAMES[x.channel] ?? x.channel} ${x.episode} — «${x.title}»`,
      "",
      `- **السكريبت:** [${x.repoPath}](${link})`,
      `- **البحث والمصادر:** [research.md](${research})`,
      `- **بصمة النص:** \`${x.scriptSha256.slice(0, 12)}\`${x.draft ? "" : " · ليست مسودة"}`,
    ];
    if (x.state.partial) {
      lines.push(`- **المطلوب:** الجمل المتغيّرة وحدها (${ar(x.state.pending.length)} من ${ar(x.state.total)})`, "");
      for (const s of x.state.pending) lines.push(`  - السطر ${ar(s.line)}: ${s.text}`);
    } else lines.push(`- **المطلوب:** السكريبت كاملًا (${ar(x.state.total)} جملة)`);
    lines.push("", "**رد المحرر:** ______________________", "", "---", "");
    return lines;
  });
  return [...head, ...body].join("\n");
};

/**
 * يكتب دفعة المحرر التالية: `دفعة-المحرر-NN.md` (للمحرر) و`دفعة-المحرر-NN.json` (البيان: القناة والحلقة وبصمة النص المرسل).
 * لا يكرر سكريبتًا أُرسل في دفعة سابقة بالنص نفسه ولم يُسجَّل مروره (إلا includeSent).
 */
export const writeEditorBatch = async (o: { dir?: string; limit?: number; includeSent?: boolean; includeFrozen?: boolean; root?: string; now?: Date } = {}) => {
  const dir = o.dir ?? defaultEditorBatchDir();
  const prior = readEditorBatches(dir);
  const sent = new Set(prior.flatMap((b) => b.items.map((x) => `${x.channel}/${x.episode}/${x.scriptSha256}`)));
  const queue = await editorQueue(o.root, { includeFrozen: o.includeFrozen });
  const fresh = queue.filter((x) => o.includeSent || !sent.has(`${x.channel}/${x.episode}/${x.scriptSha256}`));
  const items = fresh.slice(0, o.limit ?? fresh.length);
  const existing = existsSync(dir) ? readdirSync(dir).map((f) => /^دفعة-المحرر-(\d{2,})\.(md|json)$/.exec(f)?.[1]).filter(Boolean).map(Number) : [];
  const n = Math.max(0, ...existing) + 1;
  const at = o.now ?? new Date();
  if (!items.length) return { n: null, file: null, items, queue, waiting: queue.length };
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `دفعة-المحرر-${two(n)}.md`);
  const manifest: EditorBatchManifest = { batch: n, at: at.toISOString(), items: items.map((x) => ({
    channel: x.channel, episode: x.episode, folder: x.folder, scriptSha256: x.scriptSha256, pending: x.state.pending.length, partial: x.state.partial,
  })) };
  await writeAtomic(file, editorBatchMarkdown(n, items, at));
  await writeAtomic(path.join(dir, `دفعة-المحرر-${two(n)}.json`), JSON.stringify(manifest, null, 2) + "\n");
  return { n, file, items, queue, waiting: queue.length };
};

/** بصمة السكريبت كما أُرسل في دفعة (لـ editor-pass --batch) */
export const sentShaFor = (dir: string, batch: number, channel: string, episode: string): string | null =>
  readEditorBatches(dir).find((b) => b.batch === batch)?.items.find((x) => x.channel === channel && x.episode === episode)?.scriptSha256 ?? null;

