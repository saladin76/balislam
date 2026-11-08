/**
 * Background queue for «جهّز كل المشاهد»: one job per channel/episode inside the Studio server process.
 * Renders run one at a time, in scene order, through the same renderer as «إنتاج المشهد». The owner
 * passphrase lives only in this job's closure for its lifetime and is never written anywhere; a Studio
 * restart drops the job (fail-closed: the owner presses the button again; finished drafts are kept).
 */
export type PrepareJobView = {
  status: "running" | "done" | "error";
  startedAt: number;
  finishedAt?: number;
  phase: "voice" | "render" | "done";
  sceneId?: string;
  voice: { needed: number; generated: number; status: string; error?: string };
  rendered: string[];
  failed: { id: string; error: string }[];
  error?: string;
};

const jobs = new Map<string, PrepareJobView>();
export const prepareJob = (key: string): PrepareJobView | null => jobs.get(key) ?? null;

export const startPrepareJob = (key: string, run: (onProgress: (p: Omit<PrepareJobView, "status" | "startedAt">) => void) => Promise<unknown>): PrepareJobView => {
  const live = jobs.get(key);
  if (live?.status === "running") return live;
  const job: PrepareJobView = { status: "running", startedAt: Date.now(), phase: "voice",
    voice: { needed: 0, generated: 0, status: "pending" }, rendered: [], failed: [] };
  jobs.set(key, job);
  void run((p) => Object.assign(job, p)).then(
    () => { job.status = "done"; job.phase = "done"; job.sceneId = undefined; job.finishedAt = Date.now(); },
    (e) => { job.status = "error"; job.error = (e as Error).message; job.sceneId = undefined; job.finishedAt = Date.now(); },
  );
  return job;
};
