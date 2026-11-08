/**
 * Background queue for «جهّز كل المشاهد»: one job per channel/episode inside the Studio server process.
 * Renders run one at a time, in scene order, through the same renderer as «إنتاج المشهد». The owner
 * passphrase lives only in this job's closure for its lifetime and is never written anywhere; a Studio
 * restart drops the job (fail-closed: the owner presses the button again; finished drafts are kept).
 * «أوقف» (D36): a stop request is honoured between steps — the voice clip or scene render in progress
 * finishes and is kept, nothing after it starts. Status becomes "stopped"; pressing the button resumes.
 */
export type PrepareJobView = {
  status: "running" | "done" | "error" | "stopped";
  /** The owner asked to stop; the current step finishes, nothing new starts. */
  stopRequested?: boolean;
  startedAt: number;
  finishedAt?: number;
  phase: "voice" | "render" | "done";
  sceneId?: string;
  voice: { needed: number; generated: number; status: string; error?: string };
  rendered: string[];
  failed: { id: string; error: string; sourceSha256?: string }[];
  /** Not rendered on purpose: waiting for a voice that cannot be made now, or the same inputs failed last run. */
  skipped?: { id: string; reason: "voice" | "failed-before"; error?: string }[];
  error?: string;
};

const jobs = new Map<string, PrepareJobView>();
export const prepareJob = (key: string): PrepareJobView | null => jobs.get(key) ?? null;

export const startPrepareJob = (key: string, run: (
  onProgress: (p: Omit<PrepareJobView, "status" | "startedAt">) => void, shouldStop: () => boolean,
) => Promise<unknown>): PrepareJobView => {
  const live = jobs.get(key);
  if (live?.status === "running") return live;
  const job: PrepareJobView = { status: "running", startedAt: Date.now(), phase: "voice",
    voice: { needed: 0, generated: 0, status: "pending" }, rendered: [], failed: [] };
  jobs.set(key, job);
  const end = (status: PrepareJobView["status"]) => { job.status = status; job.sceneId = undefined; job.finishedAt = Date.now(); };
  void run((p) => Object.assign(job, p), () => job.stopRequested === true).then(
    () => { job.phase = "done"; end(job.stopRequested ? "stopped" : "done"); },
    (e) => { job.error = (e as Error).message; end(job.stopRequested ? "stopped" : "error"); },
  );
  return job;
};

/** Ask a running queue to stop after its current step (server-side; finished drafts are kept). */
export const stopPrepareJob = (key: string): PrepareJobView | null => {
  const job = jobs.get(key);
  if (job?.status === "running") job.stopRequested = true;
  return job ?? null;
};
