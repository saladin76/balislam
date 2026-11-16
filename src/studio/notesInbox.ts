/**
 * صندوق ملاحظات المالك (D44 أو التالي الحر — `docs/studio/notes-inbox.md`).
 *
 * حين يضغط المالك «الحركة غير مناسبة» أو «النبرة غير مناسبة» (أو «طلب تعديل») ويكتب ملاحظة، يسجّلها
 * الخادم في سجل «إنتاج المشاهد» (محلي، خارج Git)، ثم — بعد نجاح القرار نفسه — يضيفها هنا:
 *
 *   channels/<القناة>/episodes/<الحلقة>/notes/inbox.json     صندوق المالك: إضافة فقط، لا يُعدَّل سطر سابق.
 *                                                           محلي على main (في .gitignore)، ويُرفع وحده
 *                                                           إلى الفرع `studio-notes` (notesSync.ts).
 *   channels/<القناة>/episodes/<الحلقة>/notes/resolved.json  ردود Claude بمعرّف الملاحظة: تُكتب على main
 *                                                           (`bal notes resolve`) وتصل المالك مع git pull.
 *
 * لا يكتب أي طرف ملف الآخر، فلا تعارض دمج أبدًا: الاستوديو يجمع الملفين للعرض (joinNotes).
 * لا أسرار هنا: لا كلمة مرور ولا بصمتها ولا شيء من .env، والمعرّف «owner» فقط.
 */
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";

export type NoteKind = "motion" | "tone" | "general" | "error";
export type NoteStatus = "open" | "in-progress" | "fixed" | "wont-fix";
export const NOTE_STATUSES: readonly NoteStatus[] = ["open", "in-progress", "fixed", "wont-fix"];

/** ملاحظة كما تُرفع إلى `studio-notes` (بلا حالة الإرسال المحلية). */
export type StudioNote = {
  id: string;
  channel: string;
  episode: string;
  sceneId: string;
  kind: NoteKind;
  /** نص الملاحظة كما كتبه المالك، بلا بادئة «[الحركة @0:12]». */
  note: string;
  /** النص الكامل كما سُجّل في سجل المشاهد (مع البادئة). */
  raw: string;
  /** النبرة التي اختارها المالك («النبرة غير مناسبة» في حلقة لها خريطة نبرة)، وإلا null. */
  tone: string | null;
  /** لحظة المشكلة في المعاينة «0:12» إن وُجدت. */
  timecode: string | null;
  createdAt: string;
  /** بصمة مدخلات المشهد لحظة الملاحظة، وبصمة المعاينة التي شاهدها المالك. */
  sceneInputSha256: string;
  previewSha256: string;
  /** رقم الحدث في سجل المشاهد المحلي (للربط بالعرض). */
  ledgerSeq: number;
  /** دائمًا "open" هنا: الصندوق إضافة فقط؛ الحالة الفعلية من resolved.json (joinNotes). */
  status: "open";
  fixedBy: null;
  answer: null;
  /**
   * «أرسل المشكلة» (D112): خطأ التقطه الاستوديو آليًا، منقَّحًا (`src/studio/errorLog.ts`)، مع آخر ٢٠ سطرًا من سجل
   * الأخطاء. موجود في ملاحظة `kind: "error"` وحدها.
   */
  error?: StudioNoteError;
};
export type StudioNoteError = {
  id: string; at: string; source: "server" | "ui"; kind: string; route: string; method?: string;
  message: string; stack: string; label?: string | null; episode: string | null; commit: string; log: string[];
};
export type NoteSync = { state: "pending" | "sent"; at?: string; commit?: string; lastError?: string };
export type LocalNote = StudioNote & { sync?: NoteSync };
export type Inbox<N = LocalNote> = { schemaVersion: 1; notes: N[] };

export type Resolution = { status: Exclude<NoteStatus, "open">; answer: string; fixedBy: string; at: string };
export type Resolved = { schemaVersion: 1; resolutions: Record<string, Resolution> };

export type JoinedNote = Omit<StudioNote, "status" | "fixedBy" | "answer"> & {
  status: NoteStatus; answer: string | null; fixedBy: string | null; resolvedAt: string | null;
  sync: NoteSync["state"] | "remote";
};

/** `episodeDir` is an episode folder, or a channel folder for its general box (an error with no episode, D112). */
export const notesDirFor = (episodeDir: string) => path.join(episodeDir, "notes");
export const inboxFileFor = (episodeDir: string) => path.join(notesDirFor(episodeDir), "inbox.json");
export const resolvedFileFor = (episodeDir: string) => path.join(notesDirFor(episodeDir), "resolved.json");
/**
 * مسار الصندوق داخل المستودع (posix)، وهو وحده ما يُسمح به على الفرع studio-notes: صندوق الحلقة، أو الصندوق العام
 * للقناة `channels/<القناة>/notes/inbox.json` (خطأ بلا حلقة، D112). النمط نفسه في `.githooks/pre-push`.
 */
export const INBOX_PATH_RE = /^channels\/[a-z0-9-]+\/(?:episodes\/[^/]+\/)?notes\/inbox\.json$/;
/**
 * «جلسة عمل» (D141): علم واحد في جذر الفرع studio-notes يكتبه الاستوديو وحده (`src/studio/workSession.ts`)، وتقرؤه
 * المهمة المجدولة في السحابة كل ساعة. لا يُكتب على main أبدًا.
 */
export const WORK_SESSION_PATH = "notes/work-session.json";
/** كل ما يُسمح به على الفرع studio-notes: صناديق الملاحظات وعلم جلسة العمل. النمط نفسه في `.githooks/pre-push`. */
export const NOTES_BRANCH_PATH_RE = /^(?:channels\/[a-z0-9-]+\/(?:episodes\/[^/]+\/)?notes\/inbox\.json|notes\/work-session\.json)$/;

const NOTE_PREFIX_RE = /^\[(الحركة|النبرة) @(\d{1,3}:\d{2})\]\s*/;
/** «[الحركة @0:12] …» ← النوع واللحظة والنص (problemNote في SceneProductionPanel). */
export const parseCorrectionNote = (raw: string, tone?: string | null) => {
  const text = raw.trim();
  const m = NOTE_PREFIX_RE.exec(text);
  const kind: NoteKind = m ? (m[1] === "الحركة" ? "motion" : "tone") : tone ? "tone" : "general";
  return { kind, timecode: m?.[2] ?? null, note: m ? text.slice(m[0].length).trim() : text };
};

export const noteIdFor = (channel: string, episode: string, sceneId: string, ledgerSeq: number, createdAt: string) =>
  "n" + createHash("sha256").update(JSON.stringify([channel, episode, sceneId, ledgerSeq, createdAt])).digest("hex").slice(0, 10);

const readJson = async <T>(file: string, empty: T): Promise<T> => {
  try { return JSON.parse(await readFile(file, "utf8")) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty;
    throw error;
  }
};
const writeJsonAtomic = async (file: string, data: unknown) => {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  const fd = await open(temp, "wx", 0o644);
  try {
    try { await fd.writeFile(JSON.stringify(data, null, 2) + "\n"); await fd.sync(); }
    finally { await fd.close(); }
    await rename(temp, file);
  } finally { await rm(temp, { force: true }); }
};

const validInbox = (x: unknown): x is Inbox => Boolean(x && (x as Inbox).schemaVersion === 1 && Array.isArray((x as Inbox).notes));
export const readInboxFile = async (file: string): Promise<Inbox> => {
  const data = await readJson<Inbox>(file, { schemaVersion: 1, notes: [] });
  if (!validInbox(data)) throw Error(`Notes inbox is malformed: ${file}`);
  return data;
};
export const readInbox = (episodeDir: string) => readInboxFile(inboxFileFor(episodeDir));
export const readResolvedFile = async (file: string): Promise<Resolved> => {
  const data = await readJson<Resolved>(file, { schemaVersion: 1, resolutions: {} });
  if (!data || data.schemaVersion !== 1 || !data.resolutions || typeof data.resolutions !== "object")
    throw Error(`Notes resolutions are malformed: ${file}`);
  return data;
};
export const readResolved = (episodeDir: string) => readResolvedFile(resolvedFileFor(episodeDir));

/** قفل داخل العملية لكل ملف: الإضافة والتعليم بالإرسال لا يتسابقان (الخادم عملية واحدة). */
const chains = new Map<string, Promise<unknown>>();
export const withFileMutex = <T>(file: string, work: () => Promise<T>): Promise<T> => {
  const prev = chains.get(file) ?? Promise.resolve();
  const run = prev.then(work, work);
  chains.set(file, run.catch(() => undefined));
  return run;
};

/** الصورة المرفوعة: بلا حالة الإرسال المحلية. */
export const publicNote = ({ sync: _sync, ...note }: LocalNote): StudioNote => note;

/** يضيف ملاحظة المالك إلى صندوق الحلقة (مرة واحدة لكل معرّف)، بحالة «بانتظار الإرسال». */
export const appendStudioNote = async (episodeDir: string, input: {
  channel: string; episode: string; sceneId: string; raw: string; tone?: string | null;
  createdAt: string; sceneInputSha256: string; previewSha256: string; ledgerSeq: number;
}): Promise<StudioNote> => {
  const parsed = parseCorrectionNote(input.raw, input.tone);
  const note: LocalNote = {
    id: noteIdFor(input.channel, input.episode, input.sceneId, input.ledgerSeq, input.createdAt),
    channel: input.channel, episode: input.episode, sceneId: input.sceneId,
    kind: parsed.kind, note: parsed.note, raw: input.raw.trim(), tone: input.tone?.trim() || null,
    timecode: parsed.timecode, createdAt: input.createdAt,
    sceneInputSha256: input.sceneInputSha256, previewSha256: input.previewSha256, ledgerSeq: input.ledgerSeq,
    status: "open", fixedBy: null, answer: null,
    sync: { state: "pending" },
  };
  const file = inboxFileFor(episodeDir);
  await withFileMutex(file, async () => {
    const inbox = await readInbox(episodeDir);
    if (inbox.notes.some((n) => n.id === note.id)) return;
    await writeJsonAtomic(file, { schemaVersion: 1, notes: [...inbox.notes, note] });
  });
  return publicNote(note);
};

/**
 * «أرسل المشكلة» (D112): ملاحظة من نوع `error` في صندوق الحلقة، أو في الصندوق العام للقناة (`boxDir` = مجلد القناة،
 * `episode` = ""). مرة واحدة لكل خطأ: الضغطة الثانية تعيد الملاحظة نفسها. الخطأ وسطور السجل منقَّحة قبل الوصول هنا.
 */
export const appendErrorNote = async (boxDir: string, input: {
  channel: string; episode: string; sceneId: string | null; error: StudioNoteError; createdAt?: string;
}): Promise<StudioNote> => {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const first = input.error.message.split("\n")[0]!.slice(0, 300);
  const note: LocalNote = {
    id: noteIdFor(input.channel, input.episode, input.error.id, 0, createdAt),
    channel: input.channel, episode: input.episode, sceneId: input.sceneId ?? "",
    kind: "error", note: first, raw: `[خطأ] ${first}`, tone: null, timecode: null, createdAt,
    sceneInputSha256: "", previewSha256: "", ledgerSeq: 0,
    status: "open", fixedBy: null, answer: null, error: input.error,
    sync: { state: "pending" },
  };
  const file = inboxFileFor(boxDir);
  return withFileMutex(file, async () => {
    const inbox = await readInboxFile(file);
    const existing = inbox.notes.find((n) => n.kind === "error" && n.error?.id === input.error.id);
    if (existing) return publicNote(existing);
    await writeJsonAtomic(file, { schemaVersion: 1, notes: [...inbox.notes, note] });
    return publicNote(note);
  });
};

/** يعلّم ملاحظات بعينها بحالة الإرسال، بإعادة قراءة الملف (لا يمحو ملاحظة أُضيفت أثناء الإرسال). */
export const markNotesSync = async (inboxFile: string, ids: readonly string[], sync: NoteSync): Promise<void> => {
  if (!ids.length) return;
  const want = new Set(ids);
  await withFileMutex(inboxFile, async () => {
    const inbox = await readInboxFile(inboxFile);
    let changed = false;
    const notes = inbox.notes.map((n) => {
      if (!want.has(n.id)) return n;
      // ملاحظة أُرسلت لا ترجع «بانتظار» بسبب محاولة لاحقة فاشلة.
      if (n.sync?.state === "sent" && sync.state === "pending") return n;
      changed = true;
      return { ...n, sync };
    });
    if (changed) await writeJsonAtomic(inboxFile, { schemaVersion: 1, notes });
  });
};

/** دمج صندوقين بالمعرّف (إضافة فقط): ما في الأول يبقى كما هو، وما يزيد في الثاني يُلحق. */
export const mergeInboxNotes = (base: readonly StudioNote[], extra: readonly StudioNote[]): StudioNote[] => {
  const seen = new Set(base.map((n) => n.id));
  const out = [...base];
  for (const n of extra) if (!seen.has(n.id)) { seen.add(n.id); out.push(n); }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
};

export const joinNotes = (notes: readonly (StudioNote | LocalNote)[], resolved: Resolved): JoinedNote[] =>
  notes.map((n) => {
    const r = resolved.resolutions[n.id];
    const local = (n as LocalNote).sync;
    return { ...publicNote(n as LocalNote),
      status: r?.status ?? "open", answer: r?.answer ?? null, fixedBy: r?.fixedBy ?? null, resolvedAt: r?.at ?? null,
      sync: local?.state ?? "remote" };
  });

/** حالة ملاحظة التصحيح كما يعرضها الاستوديو تحت الملاحظة (مربوطة برقم الحدث في السجل). */
/** Why a note still waits (QA 12 Nov: a failed push read «بلا اتصال»): the reason of the last failed send, if any. */
export type NoteSyncReason = "offline" | "rejected" | "auth" | "not-owner" | "no-repo" | "no-remote" | "error";
export type CorrectionInboxView = { id: string; sync: NoteSync["state"]; status: NoteStatus; answer: string | null; reason?: NoteSyncReason };
const syncReason = (lastError?: string): NoteSyncReason | undefined => {
  const r = /^(offline|rejected|auth|not-owner|no-repo|no-remote|error):/.exec(lastError ?? "")?.[1];
  return r as NoteSyncReason | undefined;
};
export const correctionInboxView = async (episodeDir: string, ledgerSeq: number): Promise<CorrectionInboxView | null> => {
  try {
    const inbox = await readInbox(episodeDir);
    const note = [...inbox.notes].reverse().find((n) => n.kind !== "error" && n.ledgerSeq === ledgerSeq);
    if (!note) return null;
    const r = (await readResolved(episodeDir)).resolutions[note.id];
    const reason = note.sync?.state === "sent" ? undefined : syncReason(note.sync?.lastError);
    return { id: note.id, sync: note.sync?.state ?? "pending", status: r?.status ?? "open", answer: r?.answer ?? null, ...(reason ? { reason } : {}) };
  } catch { return null; }
};

/** يكتب رد Claude على main (resolved.json بجوار الصندوق). */
export const writeResolution = async (episodeDir: string, id: string, resolution: Resolution): Promise<Resolved> => {
  if (!/^n[a-f0-9]{10}$/.test(id)) throw Error(`Invalid note id: ${id}`);
  if (!NOTE_STATUSES.includes(resolution.status) || resolution.status === ("open" as string))
    throw Error(`Invalid status: ${resolution.status}`);
  if (!resolution.answer.trim()) throw Error("An answer is required.");
  const file = resolvedFileFor(episodeDir);
  return withFileMutex(file, async () => {
    const current = await readResolved(episodeDir);
    const next: Resolved = { schemaVersion: 1, resolutions: { ...current.resolutions, [id]: resolution } };
    await writeJsonAtomic(file, next);
    return next;
  });
};
