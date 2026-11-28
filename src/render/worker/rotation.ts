/**
 * D245 (قرار المالك ٢٨ نوفمبر): طابور الويندوز لا يقف أبدًا، والحلقات بالتناوب بين القنوات:
 * «دفاتر الزمن» ← «زبدة الكتب» ← «بالإسلام» ← ثم نعيد. «الحلقة» بكل مشتملاتها (المشاهد، والتجميع، وMaster، والعمودية، والشورتس):
 * الحلقة التي بدأت تبقى في دورها حتى لا يبقى لها شيء في الطابور. إن لم يكن للقناة التي عليها الدور شيء في الطابور
 * تُؤخذ الحلقة التالية من القناة التي بعدها، ويُسجَّل أن الدور تُخطّي (rotation.json في المجلد المشترك).
 *
 * الترتيب داخل طبقة الأولوية (D243: Master وكل ما سوى العمودية وقصها أولًا) لا فوقها: فـ Master لا يتأخر أبدًا.
 * ملف الحالة يكتبه العامل لحظة أخذ المهمة؛ تالفه أو غيابه = بلا حلقة جارية (الدور على «دفاتر الزمن»).
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";

export const CHANNEL_ROTATION = ["dafatir-alzaman", "zubdat-alkutub", "balislam"] as const;
export const ROTATION_FILE = "rotation.json";
export const ROTATION_LOG_MAX = 200;

export type EpisodeKey = { channel: string; episode: string };
export type RotationLogEntry = { at: string; channel: string; episode: string; expected: string; skipped: string[] };
export type RotationState = { version: 1; current: (EpisodeKey & { since: string }) | null; log: RotationLogEntry[] };
type Job = { channel: string; episode: string; createdAt: string; id: string };

const sameEp = (a: EpisodeKey | null | undefined, b: EpisodeKey) => Boolean(a) && a!.channel === b.channel && a!.episode === b.episode;
const rotIndex = (ch: string) => { const i = (CHANNEL_ROTATION as readonly string[]).indexOf(ch); return i < 0 ? CHANNEL_ROTATION.length : i; };

/** القناة التي عليها الدور بعد حلقة من `channel` (أو الأولى إن لم تكن حلقة سابقة) */
export const channelAfter = (channel: string | null | undefined): string =>
  channel == null || rotIndex(channel) >= CHANNEL_ROTATION.length ? CHANNEL_ROTATION[0] : CHANNEL_ROTATION[(rotIndex(channel) + 1) % CHANNEL_ROTATION.length]!;

/**
 * ترتيب الحلقات المنتظرة: الجارية أولًا (حتى تنتهي كل مشتملاتها)، ثم بالتناوب من القناة التي عليها الدور،
 * وداخل القناة الأقدم أولًا. يعيد رتبة لكل حلقة (أصغر = أولًا).
 */
export const episodeRanks = (jobs: Job[], current: EpisodeKey | null): Map<string, number> => {
  const key = (e: EpisodeKey) => `${e.channel}/${e.episode}`;
  const oldest = new Map<string, Job>();
  for (const j of jobs) { const k = key(j); const o = oldest.get(k); if (!o || j.createdAt < o.createdAt) oldest.set(k, j); }
  const eps = [...oldest.values()];
  const start = current && eps.some((e) => sameEp(current, e)) ? rotIndex(current.channel) : rotIndex(channelAfter(current?.channel));
  const turnDistance = (ch: string) => { const i = rotIndex(ch); return i >= CHANNEL_ROTATION.length ? 99 : (i - start + CHANNEL_ROTATION.length) % CHANNEL_ROTATION.length; };
  eps.sort((a, b) => Number(!sameEp(current, a)) - Number(!sameEp(current, b)) || turnDistance(a.channel) - turnDistance(b.channel)
    || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return new Map(eps.map((e, i) => [key(e), i]));
};

/** ترتيب المهام: الأولوية (D243) ثم رتبة الحلقة بالتناوب ثم الأقدم */
export const orderJobs = <T extends Job & { kind: string }>(jobs: T[], current: EpisodeKey | null, priority: (kind: string) => number): T[] => {
  const ranks = episodeRanks(jobs, current);
  const r = (j: T) => ranks.get(`${j.channel}/${j.episode}`) ?? 0;
  return [...jobs].sort((a, b) => priority(a.kind) - priority(b.kind) || r(a) - r(b) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
};

export const readRotation = async (queueDir: string): Promise<RotationState> => {
  try {
    const s = JSON.parse(await readFile(path.join(queueDir, ROTATION_FILE), "utf8")) as RotationState;
    if (s?.version === 1 && Array.isArray(s.log)) return s;
  } catch { /* بلا حالة */ }
  return { version: 1, current: null, log: [] };
};

/**
 * يسجّل أخذ مهمة: إن بدأت حلقة جديدة تصير الجارية، ويُسجَّل الدور المتوقع وما تُخطّي من قنوات (لا شيء لها في الطابور).
 * دالة خالصة على الحالة.
 */
export const noteClaim = (s: RotationState, job: EpisodeKey, now: Date): RotationState => {
  if (sameEp(s.current, job)) return s;
  const expected = channelAfter(s.current?.channel);
  const skipped: string[] = [];
  for (let ch = expected; ch !== job.channel && skipped.length < CHANNEL_ROTATION.length; ch = channelAfter(ch)) skipped.push(ch);
  const entry: RotationLogEntry = { at: now.toISOString(), channel: job.channel, episode: job.episode, expected, skipped: rotIndex(job.channel) >= CHANNEL_ROTATION.length ? [] : skipped };
  return { version: 1, current: { channel: job.channel, episode: job.episode, since: now.toISOString() }, log: [...s.log, entry].slice(-ROTATION_LOG_MAX) };
};

export const writeRotation = async (queueDir: string, s: RotationState) => {
  if (!existsSync(queueDir)) return;
  const file = path.join(queueDir, ROTATION_FILE);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(s, null, 2) + "\n");
  await rename(tmp, file);
};

/** سطر حالة الطابور للتقرير: الجاري، ثم التالي، ثم بعده (بالحلقة لا بالمهمة) */
export const queueSummary = (running: Job[], pending: (Job & { kind: string })[], current: EpisodeKey | null, priority: (kind: string) => number) => {
  const ordered = orderJobs(pending, current, priority);
  const eps: string[] = [];
  for (const j of ordered) { const k = `${j.channel}/${j.episode}`; if (!eps.includes(k)) eps.push(k); }
  return {
    running: running.map((j) => j.id),
    next: eps[0] ?? null,
    after: eps[1] ?? null,
    turn: channelAfter(current?.channel),
  };
};
