/**
 * «وصل تعديل من المحادثة» (D141، KI-070، طلب المالك ١٤ نوفمبر): ما يصل إلى جهاز المالك من main ويمس مشهدًا.
 *
 * محادثات القنوات (جلسات سحابية) تغيّر المحتوى أو الكود وتدفعه إلى main، والاستوديو يستقبله آليًا (D101). لكن
 * الفيديو والصوت لا يُرفعان أبدًا: فيديو مشهد صُنع في السحابة لا يصل إلى الجهاز، وما يراه المالك هو فيديو جهازه
 * القديم حتى يضغط «أنتج هذا المشهد». هذا الملف يحسب، عند كل استقبال (from..to)، أي مشهد في أي حلقة تغيّر،
 * ويحفظ ذلك محليًا بجوار الحلقة (`<الحلقة>/.studio/remote-changes.json`، في .gitignore وخارج ملفات المحتوى)، فيقول
 * الاستوديو بجوار المشهد «وصل تعديل من المحادثة على هذا المشهد — اضغط «أنتج هذا المشهد» لترى الجديد».
 *
 * كيف يُعرف المشهد:
 *   - plan.json: المشاهد التي تغيّر كائنها بين النسختين (أو أُضيفت). يعيد السجل فتحها وحده كما هو (D76).
 *   - sentence-pronunciations.json / tone-map.json (sceneTones): مشاهد النطق والنبرة (الصوت يحتاج «ولّد» من المالك).
 *   - تعديل كود الرسوم لا يغيّر مدخلات المشهد، فيسمّي المحادثة مشهدها صراحة: سطر `Studio-Scenes: <القناة>/<الحلقة>: c1-s1, c1-s2`
 *     في رسالة الـcommit، أو ردّها «أُصلحت» على ملاحظة المالك في notes/resolved.json (الملاحظة تحمل مشهدها في صندوق الجهاز).
 *     هذا وحده يضيف «علامة محرك» دائمة إلى بصمة مدخلات المشهد (sceneInputs.ts)، فيعيد السجل الموقَّع فتحه وحده ويلغي
 *     التجميع وMaster والإذن بحدث «تحديث بعد التجهيز» — على الجهاز نفسه، بلا اعتماد نيابة عن المالك.
 *   - script.md / tashkeel.md / research.md / publish.json بلا خطة: سطر للحلقة (السجل يقول ما تغيّر نصه).
 * حفظ الاستوديو نفسه («حفظ الاستوديو: …») ليس من المحادثة ولا يُذكر. لا توليد صوت ولا رندر هنا.
 */
import path from "node:path";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { childEnv } from "../../scripts/git-env.mjs";
import { writeJsonAtomic } from "../io/atomicJson";
import { planOrder, sceneNames } from "../i18n/sceneNames";

export type RemoteWhat = "plan" | "script" | "voice" | "tone" | "engine" | "research" | "publish" | "other";
export type RemoteSceneChange = { at: string; commit: string; subjects: string[]; what: RemoteWhat[]; answer?: string };
export type RemoteEpisodeChange = { at: string; commit: string; subjects: string[]; what: RemoteWhat[] };
export type RemoteChangesDoc = {
  schemaVersion: 1;
  /** آخر ما وصل لكل مشهد */
  scenes: Record<string, RemoteSceneChange>;
  /** ما وصل للحلقة ولا يُنسب إلى مشهد بعينه (آخر ١٠) */
  episode: RemoteEpisodeChange[];
  /**
   * علامات المحرك الدائمة لكل مشهد (commit لكل تعديل كود سمّى المشهد). تدخل بصمة مدخلاته (sceneInputs.ts)، فلا تُحذف
   * أبدًا: حذفها يغيّر البصمة ويعيد فتح المشهد مرة أخرى (فشل مغلق، لا اعتماد).
   */
  engine: Record<string, string[]>;
};
/** `label`: the line the owner reads in the sync badge («زبدة الكتب 001: المشهد ١ — الرسوم»). */
export type ReceivedItem = { channel: string; episode?: string; scenes: string[]; what: RemoteWhat[]; label: string };
export type ReceivedSummary = { at: string; from: string; to: string; commits: string[]; items: ReceivedItem[] };

export const REMOTE_CHANGES_FILE = path.join(".studio", "remote-changes.json");
export const remoteChangesFileFor = (episodeDir: string) => path.join(episodeDir, REMOTE_CHANGES_FILE);
const EMPTY = (): RemoteChangesDoc => ({ schemaVersion: 1, scenes: {}, episode: [], engine: {} });
/** حفظ الاستوديو الآلي (D101): عمل المالك نفسه، لا تعديل محادثة. */
export const STUDIO_SAVE_SUBJECT = /^حفظ الاستوديو:/;

export const readRemoteChanges = async (episodeDir: string): Promise<RemoteChangesDoc> => {
  try {
    const d = JSON.parse(await readFile(remoteChangesFileFor(episodeDir), "utf8")) as Partial<RemoteChangesDoc>;
    return { schemaVersion: 1, scenes: d.scenes ?? {}, episode: Array.isArray(d.episode) ? d.episode : [], engine: d.engine ?? {} };
  } catch { return EMPTY(); }
};
/** «علامة المحرك» لكل مشهد سمّاه تعديل كود (تدخل بصمة مدخلاته). */
export const remoteEngineTokens = async (episodeDir: string): Promise<Record<string, string[]>> =>
  (await readRemoteChanges(episodeDir)).engine;

const git = (root: string, args: string[]) => new Promise<{ ok: boolean; out: string }>((resolve) =>
  execFile("git", args, { cwd: root, timeout: 60_000, maxBuffer: 64 * 1024 * 1024, env: childEnv({ GIT_TERMINAL_PROMPT: "0" }) },
    (err, stdout) => resolve({ ok: !err, out: String(stdout) })));
const show = async (root: string, rev: string, file: string) => {
  const r = await git(root, ["show", `${rev}:${file}`]);
  return r.ok ? r.out : null;
};
const json = (t: string | null): any => { try { return t === null ? null : JSON.parse(t); } catch { return null; } };
const uniq = <T>(xs: T[]) => [...new Set(xs)];

type Commit = { sha: string; subject: string; body: string; files: string[] };
const commitsIn = async (root: string, from: string, to: string): Promise<Commit[]> => {
  const r = await git(root, ["log", "--reverse", "--no-merges", "--no-renames", "--format=%x1e%H%x1f%s%x1f%B%x1f", "--name-only", `${from}..${to}`]);
  if (!r.ok) return [];
  return r.out.split("\x1e").filter((x) => x.trim()).map((chunk) => {
    const [sha = "", subject = "", body = "", rest = ""] = chunk.split("\x1f");
    return { sha: sha.trim(), subject: subject.trim(), body, files: rest.split("\n").map((x) => x.trim()).filter(Boolean) };
  });
};

const scenesOf = (plan: any): Map<string, string> => {
  const m = new Map<string, string>();
  for (const ch of Array.isArray(plan?.chapters) ? plan.chapters : [])
    for (const s of Array.isArray(ch?.scenes) ? ch.scenes : []) if (typeof s?.id === "string") m.set(s.id, JSON.stringify(s));
  return m;
};
const diffKeys = (a: Map<string, string>, b: Map<string, string>) => [...b].filter(([k, v]) => a.get(k) !== v).map(([k]) => k);
const sayScenes = (doc: any): Map<string, string> => {
  const m = new Map<string, string>();
  for (const e of Array.isArray(doc?.entries) ? doc.entries : [])
    if (typeof e?.scene === "string") m.set(e.scene, `${m.get(e.scene) ?? ""}|${e.text}=${e.say}`);
  return m;
};
const toneScenes = (doc: any): Map<string, string> => {
  const m = new Map<string, string>();
  const t = doc?.sceneTones;
  if (t && typeof t === "object") for (const [k, v] of Object.entries(t)) m.set(k, JSON.stringify(v));
  return m;
};

/**
 * `Studio-Scenes: zubdat-alkutub/001: c1-s1, c1-s2` (سطر أو أكثر في رسالة الـcommit). الحلقة باسم مجلدها أو برقمها.
 */
export const parseSceneTrailers = (body: string): { channel: string; episode: string; scenes: string[] }[] => {
  const out: { channel: string; episode: string; scenes: string[] }[] = [];
  for (const line of body.split("\n")) {
    const m = /^\s*Studio-Scenes:\s*([a-z0-9-]+)\/([^\s:]+)\s*:\s*(.+)$/i.exec(line);
    if (!m) continue;
    const scenes = m[3]!.split(/[,،\s]+/).map((x) => x.trim()).filter((x) => /^[a-z0-9][a-z0-9-]*$/i.test(x));
    if (scenes.length) out.push({ channel: m[1]!, episode: m[2]!, scenes });
  }
  return out;
};

const episodeFolder = async (root: string, channel: string, ep: string): Promise<string | null> => {
  try {
    const names = (await readdir(path.join(root, "channels", channel, "episodes"))).sort();
    return names.find((n) => n === ep) ?? names.find((n) => n.startsWith(`${ep}-`) || n.split("-")[0] === ep) ?? null;
  } catch { return null; }
};

const CHANNEL_NAMES: Record<string, string> = { "balislam": "بالإسلام", "dafatir-alzaman": "دفاتر الزمن", "zubdat-alkutub": "زبدة الكتب" };
/** What changed, as the owner reads it (one word each, in a fixed order). */
export const WHAT_AR: Record<RemoteWhat, string> = {
  plan: "الخطة (الرسوم والحركة)", engine: "الرسوم", script: "السكريبت", voice: "النطق والتشكيل", tone: "النبرة",
  research: "البحث", publish: "نصوص النشر", other: "إعدادات",
};
export const whatAr = (what: RemoteWhat[]) =>
  (Object.keys(WHAT_AR) as RemoteWhat[]).filter((w) => what.includes(w)).map((w) => WHAT_AR[w]).join("، ");

/** ما يُذكر بجوار المشهد: نص سطر الحلقة الأخير وما تغيّر. */
const WHAT_OF: [RegExp, RemoteWhat][] = [
  [/^script\.md$/, "script"], [/^tashkeel\.md$/, "voice"], [/^research\.md$/, "research"], [/^publish\.json$/, "publish"],
];

/**
 * يُستدعى بعد استقبال ناجح من `from` إلى `to` (app/server/contentSync.ts). يكتب ملف كل حلقة تغيّرت ويعيد ملخصًا
 * للعلامة في رأس الصفحة. لا يرمي: فشل القراءة يعني ملخصًا أقل، ولا يوقف التحديث أبدًا.
 */
export const recordRemoteChanges = async (root: string, from: string, to: string, now = new Date().toISOString()): Promise<ReceivedSummary> => {
  const summary: ReceivedSummary = { at: now, from, to, commits: [], items: [] };
  if (!from || !to || from === to) return summary;
  const all = await commitsIn(root, from, to);
  const commits = all.filter((c) => !STUDIO_SAVE_SUBJECT.test(c.subject));
  summary.commits = commits.map((c) => c.subject).slice(-12);
  if (!commits.length) return summary;

  type Acc = { scenes: Map<string, { what: Set<RemoteWhat>; subjects: Set<string>; commit: string; answer?: string; engine?: string }>;
    episode: { what: Set<RemoteWhat>; subjects: Set<string>; commit: string } | null };
  const eps = new Map<string, Acc>(); // "<channel>/<folder>"
  const acc = (key: string): Acc => { if (!eps.has(key)) eps.set(key, { scenes: new Map(), episode: null }); return eps.get(key)!; };
  const markScene = (key: string, id: string, what: RemoteWhat, c: { sha: string; subject: string }, extra: { answer?: string; engine?: string } = {}) => {
    const a = acc(key);
    const s = a.scenes.get(id) ?? { what: new Set<RemoteWhat>(), subjects: new Set<string>(), commit: c.sha };
    s.what.add(what); s.subjects.add(c.subject); s.commit = c.sha;
    if (extra.answer) s.answer = extra.answer;
    if (extra.engine) s.engine = extra.engine;
    a.scenes.set(id, s);
  };
  const markEpisode = (key: string, what: RemoteWhat, c: { sha: string; subject: string }) => {
    const a = acc(key);
    a.episode ??= { what: new Set(), subjects: new Set(), commit: c.sha };
    a.episode.what.add(what); a.episode.subjects.add(c.subject); a.episode.commit = c.sha;
  };
  const channelItems = new Map<string, Set<RemoteWhat>>();

  // ١. الملفات كما تغيّرت بين النسختين، منسوبة إلى آخر commit من المحادثة مسّها
  const lastTouch = new Map<string, Commit>();
  for (const c of commits) for (const f of c.files) lastTouch.set(f, c);
  for (const [file, c] of lastTouch) {
    const m = /^channels\/([a-z0-9-]+)\/episodes\/([^/]+)\/(.+)$/.exec(file);
    if (!m) {
      const ch = /^channels\/([a-z0-9-]+)\/[^/]+\.json$/.exec(file)?.[1];
      if (ch) channelItems.set(ch, (channelItems.get(ch) ?? new Set()).add(/pronunciations?\.json$/.test(file) ? "voice" : "other"));
      const engine = /^src\/remotion\/(zubdat|dafatir)\//.exec(file)?.[1];
      if (engine) {
        const id = engine === "zubdat" ? "zubdat-alkutub" : "dafatir-alzaman";
        // A commit that names its scenes (`Studio-Scenes:`) is said on those scenes, not as «للقناة كلها».
        if (!parseSceneTrailers(c.body).some((t) => t.channel === id)) channelItems.set(id, (channelItems.get(id) ?? new Set()).add("engine"));
      }
      continue;
    }
    const [, channel, folder, rest] = m as unknown as [string, string, string, string];
    const key = `${channel}/${folder}`;
    try {
      if (rest === "plan.json") {
        const ids = diffKeys(scenesOf(json(await show(root, from, file))), scenesOf(json(await show(root, to, file))));
        for (const id of ids) markScene(key, id, "plan", c);
        if (!ids.length) markEpisode(key, "plan", c);
      } else if (rest === "sentence-pronunciations.json") {
        const a = sayScenes(json(await show(root, from, file))), b = sayScenes(json(await show(root, to, file)));
        const ids = uniq([...diffKeys(a, b), ...diffKeys(b, a)]);
        for (const id of ids) markScene(key, id, "voice", c);
        if (!ids.length) markEpisode(key, "voice", c);
      } else if (rest === "tone-map.json") {
        const ids = diffKeys(toneScenes(json(await show(root, from, file))), toneScenes(json(await show(root, to, file))));
        for (const id of ids) markScene(key, id, "tone", c);
        if (!ids.length) markEpisode(key, "tone", c);
      } else if (rest === "notes/resolved.json") {
        const before = json(await show(root, from, file))?.resolutions ?? {};
        const after = json(await show(root, to, file))?.resolutions ?? {};
        const inbox = json(await readFile(path.join(root, "channels", channel, "episodes", folder, "notes", "inbox.json"), "utf8").catch(() => null));
        const notes: { id?: string; sceneId?: string }[] = Array.isArray(inbox?.notes) ? inbox.notes : [];
        for (const [id, r] of Object.entries<any>(after)) {
          if (r?.status !== "fixed" || JSON.stringify(before[id]) === JSON.stringify(r)) continue;
          const scene = notes.find((n) => n.id === id)?.sceneId;
          if (scene) markScene(key, scene, "engine", c, { answer: typeof r.answer === "string" ? r.answer : undefined, engine: `note:${id}:${r.at ?? c.sha}` });
        }
      } else {
        const what = WHAT_OF.find(([re]) => re.test(rest))?.[1];
        if (what) markEpisode(key, what, c);
      }
    } catch { /* ملخص أقل، لا أكثر */ }
  }
  // ٢. المشاهد التي سمّتها المحادثة صراحة (تعديل كود الرسوم لا يغيّر مدخلات المشهد)
  for (const c of commits) for (const t of parseSceneTrailers(c.body)) {
    const folder = await episodeFolder(root, t.channel, t.episode);
    if (!folder) continue;
    for (const id of t.scenes) markScene(`${t.channel}/${folder}`, id, "engine", c, { engine: `commit:${c.sha}` });
  }

  // ٣. الكتابة: ملف لكل حلقة (محلي)، ثم الملخص
  for (const [key, a] of eps) {
    const [channel, folder] = key.split("/") as [string, string];
    const dir = path.join(root, "channels", channel, "episodes", folder);
    const doc = await readRemoteChanges(dir);
    for (const [id, s] of a.scenes) {
      doc.scenes[id] = { at: now, commit: s.commit, subjects: [...s.subjects].slice(-3), what: [...s.what],
        ...(s.answer ? { answer: s.answer } : {}) };
      if (s.engine && !(doc.engine[id] ?? []).includes(s.engine)) doc.engine[id] = [...(doc.engine[id] ?? []), s.engine];
    }
    if (a.episode) doc.episode = [...doc.episode, { at: now, commit: a.episode.commit, subjects: [...a.episode.subjects].slice(-3), what: [...a.episode.what] }].slice(-10);
    try { await writeJsonAtomic(remoteChangesFileFor(dir), doc); } catch { /* الحلقة حُذفت أو نُقلت */ }
    const what = uniq([...[...a.scenes.values()].flatMap((s) => [...s.what]), ...(a.episode ? [...a.episode.what] : [])]);
    const order = planOrder(json(await show(root, to, `channels/${channel}/episodes/${folder}/plan.json`)));
    const ids = [...a.scenes.keys()].sort((x, y) => (order.indexOf(x) + 1 || 1e9) - (order.indexOf(y) + 1 || 1e9));
    const where = !ids.length ? "الحلقة" : ids.every((id) => order.includes(id)) ? sceneNames(order, ids, 6) : ids.join("، ");
    summary.items.push({ channel, episode: folder, scenes: ids, what,
      label: `${CHANNEL_NAMES[channel] ?? channel} ${folder.slice(0, 3)}: ${where} — ${whatAr(what)}` });
  }
  for (const [channel, what] of channelItems) summary.items.push({ channel, scenes: [], what: [...what],
    label: `${CHANNEL_NAMES[channel] ?? channel}: ${whatAr([...what])} للقناة كلها (لم يُسمَّ مشهد)` });
  return summary;
};

/**
 * للقراءة في الخطوة ٢: آخر ما وصل لمشهد، ما دام فيديو المشهد على الجهاز أقدم منه (صُنع قبل وصوله).
 * `videoAt` null (لا فيديو بعد): لا شيء قديم يُذكر.
 */
export const remoteChangeFor = (doc: RemoteChangesDoc, sceneId: string, videoAt: number | null): RemoteSceneChange | null => {
  const r = doc.scenes[sceneId];
  if (!r || videoAt === null) return null;
  const at = Date.parse(r.at);
  return Number.isFinite(at) && videoAt < at ? r : null;
};
