/**
 * Background queue for «جهّز كل المشاهد»: one job per channel/episode inside the Studio server process.
 * Renders run one at a time, in scene order, through the same renderer as «إنتاج المشهد». The owner was
 * checked (loopback Studio request) when the job started; nothing about him is stored. A Studio
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
  skipped?: { id: string; reason: "voice" | "sentences" | "after-gap" | "blocked" | "failed-before"; error?: string; sourceSha256?: string; gap?: string }[];
  error?: string;
};

const jobs = new Map<string, PrepareJobView>();
export const prepareJob = (key: string): PrepareJobView | null => jobs.get(key) ?? null;

/** Arabic refusal when another heavy job (episode render, make, package, delete) holds the episode. */
export const PREPARE_REFUSED_BUSY = "توجد مهمة جارية على هذه الحلقة (رندر الحلقة أو صناعتها أو تغليفها). انتظر انتهاءها ثم اضغط «جهّز كل المشاهد».";
/** Arabic refusal for other heavy jobs while «جهّز كل المشاهد» runs on the episode. */
export const PREPARE_RUNNING_MESSAGE = "«جهّز كل المشاهد» يعمل الآن على هذه الحلقة. انتظر انتهاءه أو اضغط «أوقف» ثم أعد المحاولة.";
export const prepareRunning = (key: string): boolean => jobs.get(key)?.status === "running";

/**
 * QA H4: the queue takes the episode's `busy` key for its whole run (the same set the episode render, make,
 * package and delete check), and refuses to start while another job holds it. Released when the run ends.
 */
export const startPrepareJob = (key: string, run: (
  onProgress: (p: Omit<PrepareJobView, "status" | "startedAt">) => void, shouldStop: () => boolean,
) => Promise<unknown>, busy?: Set<string>): PrepareJobView => {
  const live = jobs.get(key);
  if (live?.status === "running") return live;
  if (busy?.has(key)) throw Object.assign(new Error(PREPARE_REFUSED_BUSY), { status: 409, code: "EPISODE_BUSY" });
  busy?.add(key);
  const job: PrepareJobView = { status: "running", startedAt: Date.now(), phase: "voice",
    voice: { needed: 0, generated: 0, status: "pending" }, rendered: [], failed: [] };
  jobs.set(key, job);
  const end = (status: PrepareJobView["status"]) => { job.status = status; job.sceneId = undefined; job.finishedAt = Date.now(); busy?.delete(key); };
  // The run starts synchronously (as before); a synchronous throw still ends the job and frees the busy key.
  let started: Promise<unknown>;
  try { started = run((p) => Object.assign(job, p), () => job.stopRequested === true); }
  catch (error) { started = Promise.reject(error); }
  void Promise.resolve(started).then(
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
