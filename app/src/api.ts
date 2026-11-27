import type { Plan, PlanShort } from "../../src/plan/types";
import type { ShortsScene } from "../../src/plan/shorts";
import type { ToneUpgradePlan, ToneUpgradeResult } from "../../src/voice/toneUpgrade";
import type { Identity } from "../../brand/identity/index";
import type { EpisodeMedia } from "../../src/plan/media";
import type { PlanIssue } from "../../src/plan/validate";
import type { SceneStarts } from "../../src/package/chapters";
import type { PublishKit } from "../../src/package/social";
import type { ChannelConfig, ChannelDomain, ChannelInfo } from "../../src/channel/types";
import type { DerivedSeriesIdentity, SeriesConfig } from "../../src/channel/series";
import type { GuideIndex } from "../../src/channel/guide";
import type { LabSummary } from "../../src/channel/labs";
import type { StoryboardEntry, StoryboardStatus, StoryboardVersion } from "../../src/channel/labStoryboardsShared";
import type { TechReviewSummary } from "../../src/channel/techReviews";
import type { ScriptSaveReply } from "./planGuard";
import { ownerJob, ownerMessage } from "./serverMessages";
import { emitStudioError } from "./errorEvents";
import { ownerText, planOrder } from "../../src/i18n/sceneNames";
import type { PaceCommand, PaceStatus, RefreshResult } from "../../src/voice/paceApply";
import type { QualityCard, CardTarget } from "../../src/studio/quality/card";
import type { PreFinalWatchView } from "../../src/studio/preFinalApprove";
import type { LibraryRead } from "../../src/library/libraryData";
import type { Season, SeasonView } from "../../src/studio/seasons";
import type { Stock, StockEpisodeView } from "../../src/studio/stock";
import type { Book, Scholar } from "../../src/library/shared";
export type { LibraryRead };
export type QualityCardRead = QualityCard & { exists: boolean; measuring: boolean };
import type { LexiconCommand, SentenceCommand, SentencesRead, ToneImpact, WordFixOutcome } from "../../src/voice/sentenceVoice";
export type { LexiconCommand, SentenceCommand, SentencesRead, SentenceRow, SentenceScene, ToneImpact, WordFixOutcome } from "../../src/voice/sentenceVoice";

export type Issue = { level: "error" | "warning"; code: string; message: string; line?: number };
export type CheckResult = { ok: boolean; issues: Issue[]; stats: { chapters: { number: number; words: number; seconds: number }[]; totalWords: number; totalSeconds: number; /** 0 للنص المتصل بلا أقسام */ divisions?: number } };
export type EpisodeSummary = { id: string; dir: string; title: string; domain: string; hasPlan: boolean; /** سلسلة الحلقة (وإلا «general») */ series?: string };
/** سلسلة أو تصنيف كما يقرؤه الاستوديو: الملف، وهويته المشتقة من هوية القناة، وعدد حلقاته */
export type SeriesView = SeriesConfig & { derived: DerivedSeriesIdentity | null; episodes: number };
export type SeriesRules = {
  accents: { hex: string; nameAr: string }[]; motifs: { id: string; nameAr: string }[]; emblemParts: { id: string; nameAr: string }[];
  fonts: { heading: string; body: string; wordmark: string }; limits: { lightness: number; chromaMin: number; chromaMax: number; emblemParts: number }; maxDepth: number;
  styles: string[]; templates: string[]; tones: string[]; defaultTone: string;
};
export type EpisodeMoveResult = { episode: string; ok: boolean; from?: string; to?: string; number?: number; unchanged?: boolean; note?: string; error?: string };
export type MoveEpisodesResult = { ok: boolean; results: EpisodeMoveResult[]; undo: string | null; to: { id: string; name: string; kind?: string } };
export type SeriesRead = { series: SeriesView[]; episodes: { id: string; dir: string; series: string; number?: number }[]; rules: SeriesRules | null };
export type ChannelSummary = { id: string; name: string; language: string; domains: Record<string, ChannelDomain> };
export type EpisodeData = { channel: ChannelInfo; script: string; plan: Plan; check: CheckResult; media: EpisodeMedia; issues: PlanIssue[]; keys: { voice: boolean; quran: boolean } };
export type TashkeelReport = { file: boolean; words: number; covered: number; coverage: number; min: number; ok: boolean; gaps: { sceneId: string; words: string[]; narration: string }[]; ambiguous: { word: string; forms: string[]; scenes: string[] }[] };
export type ReviewItem = { key: string; kind: "ayah" | "hadith" | "other"; label: string; ref: string; detail: string; text?: string; line: number; hash: string; status: "pending" | "changed" | "verified" | "rejected"; note?: string; at?: string };
export type ReviewSummary = { total: number; verified: number; pending: number; changed: number; rejected: number; ok: boolean };
/** مشكلة مطابقة بين جملة في السكريبت والنسخة المشكولة (D132) */
export type TashkeelAlignment = { sceneId: string; sentence: string; problem: "missing" | "mismatch"; words: string[] };
export type TashkeelCheck = { report: TashkeelReport; alignment: TashkeelAlignment[]; saySentences: number; toneMapStale: boolean };
export type TashkeelState = TashkeelCheck & { exists: boolean; text: string; revision: string };
export type VoiceReport = { total: number; toGenerate: { id: string; chars: number }[]; cached: string[]; chars: number; credits: number; tashkeel?: TashkeelReport; review?: ReviewSummary };
export type Overview = {
  id: string;
  dir: string;
  title: string;
  domain: string;
  lang: string;
  check: { ok: boolean; errors: number; warnings: number; seconds: number };
  scenes: number;
  voice: { done: number; total: number };
  blocking: number;
  package: { video: boolean; shorts: number; planned?: number; thumbnails: number; updatedAt: number | null };
  planUpdatedAt: number | null;
  /** One episode length everywhere (D52): the plan's duration, "voice" once measured from the narration. */
  length?: { seconds: number; source: "voice" | "plan" } | null;
  /** الأسلوب الغالب على الحلقة (للتنوّع) */
  style: string;
  status: EpisodeStatus;
  /** سلسلة الحلقة («general» = «عام») ورقمها فيها */
  series?: string;
  seriesNumber?: number | null;
  /** حالة الخطوات الأربع من سجل الإنتاج؛ null إن تعذّرت قراءته */
  production?: ProductionSummary | null;
};
export type ProductionSummary = { steps?: [boolean, boolean, boolean, boolean]; preparation?: boolean; script: boolean; storyboard: boolean; approvedScenes: number; totalScenes: number; canAssemble: boolean; assemblyApproved: boolean; masterApproved: boolean; publishAllowed: boolean };
/** معاينة حلقة: source يبيّن هل الفيديو على هذا الجهاز، أو في مجلد Drive المتزامن، أو رابط Drive فقط */
/** D95: ملف تعارض فيه تعديل المالك مع التحديث؛ الجديد في مكانه ونسخة المالك في النسخة الاحتياطية */
export type UpdateConflict = { file: string; channel: string; mine: string | null; backup: string; at: string; reason: "both-changed" | "untracked-collision" | "deleted-here-changed-there" };
export type EpisodePreview = { name: string; size: number; mtime: number; title: string; note: string; version: number; updatedAt: string | null; source: "local" | "drive-mirror" | "drive-link" | "git-branch" | "missing"; driveUrl: string | null;
  /** معاينة سحابية على فرع previews/* (D75): الحجم بالعربية لزر «حمّل المعاينة» */
  cloud?: { ref: string; size: number; sizeLabel: string } | null };
/** تحميل معاينة سحابية إلى هذا الجهاز */
export type CloudPreviewJob = { state: "running" | "done" | "error"; phase: "fetch" | "assemble" | "install"; pct: number; received: number; total: number; sizeLabel: string; error?: string };
export type EpisodeStatus = { /** اعتماد النسخة الأساسية بعد مشاهدتها كاملة (بصمة ملف الحلقة) */ approved?: { at: string; size: number; mtime: number }; checklist?: Record<string, boolean>; published?: { date: string; url?: string }; notes?: string; /** يوم نشر الحلقة الطويلة المخطط (YYYY-MM-DD) */ scheduled?: string };
export type Idea = { id: string; title: string; note?: string; domain?: string; style?: string; createdAt: string };
/** يوم في تقويم القناة: شورتس محددة (حلقة + رقم الشورت)، أو بلا نشر، وملاحظة */
export type CalendarDay = { shorts?: { ep: string; n: number }[]; off?: boolean; note?: string };
export type OpsChannel = { calendar: Record<string, CalendarDay>; channel: { id: string; name: string; language: string; schedule: { longDay: number; time?: string; shortsPerDay?: number } | null; domains: Record<string, ChannelDomain> }; episodes: Overview[]; ideas: Idea[] };
export type PackageInfo = { files: { name: string; size: number; mtime: number }[]; youtube: string; checklist: string; /** بأي جودة رُندرت الحلقة */ render?: { quality: "master" | "preview"; label: string; width: number; height: number; voiced: boolean; at: string } | null };
export type StoryboardInfo = { status: import("../../src/plan/storyboard").StoryboardStatus; motion: import("../../src/render/storyboardMotion").StoryboardMotion | null; motionStale?: string[]; auditNeedsReview?: boolean; motionAuditNeedsReview?: boolean };
export type LongJob = { id: string; kind: string; episode?: string; title: string; status: "running" | "done" | "error"; pct: number; log: string[]; error?: string; startedAt: number; queued?: boolean };
export type KeyState = Record<string, { label: string; set: boolean; preview: string }>;
export type SfxItem = { id: string; nameAr: string; category: string; categoryAr: string; useAr: string; seconds: number; guard?: string; available: boolean };
export type RenderJob = { id: string; episode: string; orientation: string; chapter?: number; status: "running" | "done" | "error"; pct: number; output?: string; error?: string; queued?: boolean };

/** القناة المختارة في الاستوديو: تُضاف لكل طلب. */
let currentChannel = "";
export const setApiChannel = (id: string) => {
  currentChannel = id;
};
const withChannel = (url: string) => (currentChannel ? `${url}${url.includes("?") ? "&" : "?"}channel=${encodeURIComponent(currentChannel)}` : url);

/** The scene-preparation queue's errors in Arabic (P-07). */
const prepareRead = (r: ScenePrepareRead): ScenePrepareRead => ({ ...r, job: r.job ? ownerJob(r.job as ScenePrepareJob & { log?: string[] }) : r.job });

/**
 * The script check as the owner reads it (QA 12 Nov: «جملة من 27 كلمة»، «(السطر 15)»): every message with
 * Arabic-Indic digits and scene names («المشهد ٥») instead of ids. The server's own messages stay as they are (CLI, tests).
 */
export const ownerCheck = (c: CheckResult, plan?: Plan | null): CheckResult => {
  if (!c?.issues) return c;
  const order = planOrder(plan);
  return { ...c, issues: c.issues.map((i) => ({ ...i, message: ownerText(i.message, order) })) };
};
/** A refused request: the owner-facing message, plus the HTTP status and the server's code (e.g. PLAN_CONFLICT). */
export type ApiError = Error & { status?: number; code?: string };
export const isPlanConflict = (e: unknown) => {
  const x = e as ApiError | null;
  return x?.status === 409 && (x.code === "PLAN_CONFLICT" || x.code === "PLAN_REVISION_REQUIRED");
};

const call = async <T>(path: string, init?: RequestInit & { json?: unknown }, channel?: string): Promise<T> => {
  const url = channel ? `${path}${path.includes("?") ? "&" : "?"}channel=${encodeURIComponent(channel)}` : withChannel(path);
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined
      ? { "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) }
      : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = (data as { code?: unknown }).code;
    // D112: an unexpected server error was logged with this number; the page offers «أرسل المشكلة».
    const errorId = (data as { errorId?: unknown }).errorId;
    if (typeof errorId === "string" && /^e[0-9a-f]{10}$/.test(errorId))
      emitStudioError({ id: errorId, source: "server", kind: "route", message: String((data as { error?: unknown }).error ?? "") });
    // status and the server's code ride on the owner-facing error (D110: a 409 offers the merge)
    const tag = (e: Error): ApiError => Object.assign(e, { status: res.status, ...(typeof code === "string" ? { code } : {}) });
    try { throw new Error(ownerMessage((data as { error?: string }).error ?? `تعذّر الطلب (رمز ${res.status.toLocaleString("ar-EG", { useGrouping: false })}).`)); }
    catch (e) { throw tag(e as Error); }
  }
  return data as T;
};
/** For feature modules with their own client (pronunciationApi.ts): the same channel, errors and «أرسل المشكلة». */
export const apiCall = call;


/** What changed in a scene re-opened after «اعتمد التجهيز». */
export type AfterPreparationWhat = "board" | "text" | "new" | "inputs";
export const AFTER_PREPARATION_WHAT: Record<AfterPreparationWhat, string> = { board: "اللوحة", text: "النص", new: "مشهد جديد", inputs: "مدخلاته" };
/** «تغيّر بعد التجهيز — راجعه (النص، اللوحة)» */
export const afterPreparationLine = (what: AfterPreparationWhat[]) =>
  `تغيّر بعد التجهيز — راجعه (${[...new Set(what.map((w) => AFTER_PREPARATION_WHAT[w]))].join("، ")})`;
export type SceneProductionRead = {
  schemaVersion: 1;
  channel: string; episode: string; revision: number;
  progress: {
    /** The first scene without an approval (where step ٢ opens); any scene may be decided first (D145). */
    currentScene: string | null; approvedScenes: number; totalScenes: number;
    /** Every scene without an approval, in episode order: what the assembly still waits for (D145). */
    unapprovedScenes?: string[];
    canAssemble: boolean; assemblyApproved: boolean; masterApproved: boolean; publishAllowed: boolean;
    /** Verse scenes approved «مشروط بالتلاوة»: assembly and Master wait for their recitation. */
    recitationPending?: string[] };
  script: { sha256: string; approved: boolean };
  storyboard: { sha256: string; approved: boolean };
  /** P-05: every current scene matches its recorded board; `changed` lists the boards edited since (or new). */
  boards?: { current: boolean; changed: string[] };
  /**
   * 11 Nov: the latest «تحديث بعد التجهيز» — a change after «اعتمد التجهيز» carried forward by the ledger (signed system
   * event). Its scenes re-open for review in step ٢; nothing is approved again. null when there was none.
   */
  afterPreparation?: { at: string; script: boolean; scriptOnly?: boolean; scenes: { id: string; what: AfterPreparationWhat[] }[] } | null;
  /** Script errors that belong to no single scene: no scene not yet approved is produced until they are fixed. */
  episodeBlocked?: string[];
  scenes: { id: string; status: "queued" | "in_review" | "approved" | "needs_revision";
    sourceSha256: string; previewSha256?: string; readyForAv: boolean; approved: boolean;
    /** Verse card whose human recitation is not attached yet (its draft is silent, marked). */
    recitationPending?: boolean;
    /** Approved on condition of its recitation (re-opens when the recitation is attached). */
    conditional?: boolean;
    /** Pre-rendered draft from «جهّز كل المشاهد»: never a submission or approval. */
    draft?: "ready" | "stale" | "none";
    /** M4: sent back for a fix and its inputs have not changed since: not re-rendered until they do. */
    awaitingChange?: boolean;
    /** 11 Nov: re-opened by a change after «اعتمد التجهيز»: step ٢ shows «تغيّر بعد التجهيز — راجعه» with what changed. */
    afterPreparation?: { at: string; what: AfterPreparationWhat[]; script: boolean };
    /** What blocks producing this scene (a verse without its text, a script error on its narration). */
    blocked?: string[];
    /**
     * KI-066: a sentence take that the scene video does not hold yet (1-based sentence numbers). `produce`: «أنتج هذا
     * المشهد» carries it; `blocked`: the sentences in `missing` have no current take, so the scene's sound cannot hold it yet.
     */
    newerTake?: { state: "produce" | "blocked"; sentences: number[]; missing: number[] };
    /** D148: a conversation's change reached this machine after the scene's video was made (src/studio/remoteChanges.ts). */
    remoteChange?: RemoteSceneChangeView;
    /** The owner's latest «الحركة/النبرة غير مناسبة» note while the scene awaits its fix. */
    correction?: { note: string; at: string;
      /** صندوق الملاحظات (docs/studio/notes-inbox.md): أُرسلت إلى Claude أو بانتظار الإرسال، ورده بعد git pull. */
      inbox?: { id: string; sync: "pending" | "sent"; status: "open" | "in-progress" | "fixed" | "wont-fix"; answer: string | null;
        /** Why it still waits: the last failed send («offline» only for a real network failure). */
        reason?: "offline" | "rejected" | "no-repo" | "no-remote" | "error" } } }[];
  /** «جاهز ١٢ من ٣١»: approved, submitted, or with a current draft. */
  prepared?: { ready: number; total: number };
  assembly: { sha256: string; approved: boolean } | null;
  /** Every boundary between consecutive scenes, in order ("c1-s1>c1-s2"). */
  seams: string[];
  /** While the assembly awaits review: each seam's time in the assembled file (seconds), if known. */
  seamTimes?: Record<string, number>;
  /** While the assembly awaits review (owner, 16 Nov): the silence at each seam and a warning above the chosen «الفاصل». */
  seamReport?: import("../../src/studio/seamTimes").SeamReport;
  master: { sha256: string; approved: true; publishAllowed: boolean } | null;
  candidates: { scenes: Record<string, string | null>; assemblySha256: string | null;
    masterSha256: string | null };
  /** Episode tone map (دفاتر الزمن): version and each scene's part tone ("" = mixed). null/absent elsewhere. */
  toneMap?: { version: string; tones: Record<string, string> } | null;
};
export type Loudness = { integrated: number; truePeak: number; lra: number; threshold: number };
export type RecitationVariant = { file: string; duration: number; sha256: string; loudness: Loudness };
export type RecitationPolish = { before: Loudness; trim: { start: number; end: number; duration: number; trimmedHead: number; trimmedTail: number };
  target: { integrated: number; truePeak: number; source: "narration" | "default" } };
export type OwnRecitationCandidate = { file: string; duration: number; sha256: string; createdAt: string;
  variant?: "processed" | "original"; variants?: Record<"processed" | "original", RecitationVariant>; polish?: RecitationPolish };
export type OwnRecitationsRead = {
  verses: { key: string; sceneId: string; reference: string }[];
  pending: Record<string, OwnRecitationCandidate>;
  approved: Record<string, { reciter: string; approvedAt: string; file: string; duration: number;
    variant: "processed" | "original" | null; variants: Record<"processed" | "original", RecitationVariant> | null; polish: RecitationPolish | null }>;
  /** D239: the owner's one approved basmala clip on this machine (only when the episode has no approved recording of its own). */
  basmalaClip?: { installed: boolean; reason?: string };
};
export type ScenePrepareJob = {
  status: "running" | "done" | "error" | "stopped"; stopRequested?: boolean; startedAt: number; finishedAt?: number;
  phase: "voice" | "render" | "done"; sceneId?: string;
  voice: { needed: number; generated: number; status: string; error?: string };
  rendered: string[]; failed: { id: string; error: string }[]; error?: string;
  /** Not rendered on purpose: waiting for a voice that cannot be made now, or the same inputs failed last run. */
  skipped?: { id: string; reason: "voice" | "sentences" | "after-gap" | "blocked" | "failed-before"; error?: string; gap?: string }[];
};
export type EpisodeContents = { files: number; bytes: number; voiceFiles: number; videoFiles: number; tracked: number };
export type TrashEntry = { id: string; channel: string; from: string; at: string; title?: string; contents: EpisodeContents };
export type PreparationRead = { scriptErrors: number; versesMissing: string[]; boardsRecorded: boolean;
  /** QA balislam 2: scenes whose board text differs from the script, and script lines no scene says (block the approval). */
  textDiverged?: { scenes: string[]; unplaced: number[] };
  /** M1: narrated scenes with no tone at all (none of their own, the episode's or the channel's). */
  toneMissing?: string[]; episodeTone?: string | null; channelTone?: string | null;
  /** KI-054: plan errors the final file refuses, known now, per scene (informative in «قبل أن تعتمد»). */
  planErrors?: { scene: string; message: string }[] };
export type ScenePrepareRead = { job: ScenePrepareJob | null; voiceKey: boolean; needVoice?: number;
  /** M1: narrated scenes with no tone at all; the stopped line offers the episode tone right there. */
  toneMissing?: string[];
  /** What «ولّد الصوت الآن» would pay for (read only); nothing paid starts without the owner's confirmed press. */
  voicePlan?: VoiceGenerationPlan | null };
/** src/studio/prepareAll.ts `voiceGenerationPlan` */
export type VoiceGenerationPlan = { sentences: number; scenes: string[]; chars: number; credits: number;
  excluded: { id: string; reason: "verse" | "basmala" | "quran" }[]; fingerprint: string };
export type SceneOwnerAction = {
  action: "approve-script" | "approve-storyboard" | "submit-scene" | "approve-scene" |
    "correct-scene" | "assemble" | "approve-assembly" | "approve-master" | "grant-publish";
  expectedSha256: string;
  sceneId?: string;
  note?: string;
  confirmedWatched?: boolean;
  seamsChecked?: string[];
  /** correct-scene in a tone-map episode: the owner's tone for this scene (new tone-map version). */
  tone?: string;
};

/** D53: حالة التسليم إلى Drive (src/package/driveHandoff.ts). */
export type DriveHandoffFile = { name: string; kind: "master" | "short" | "thumbnail" | "subtitle" | "text" | "manifest"; size: number; sha256: string; action: "copied" | "replaced" | "skipped" };
export type DriveHandoffRead = {
  drive: { found: boolean; source: "env" | "detected" | null; message: string | null; folder: string | null };
  job: { status: "running" | "done" | "error"; startedAt: string; finishedAt?: string; trigger: "publish-permission" | "retry"; pct: number; current: string; error?: string } | null;
  last: ({ status: "done"; at: string; root: string; folder: string; masterSha256: string; files: DriveHandoffFile[] }
    | { status: "error"; at: string; error: string; masterSha256?: string; folder?: string }) | null;
  canOpen: boolean;
};

/** GET /api/episodes/:id/shorts */
export type ShortsRead = { saved: PlanShort[] | null; suggested: PlanShort[]; scenes: ShortsScene[]; divisions: number; titleMax: number };

export const api = {
  /** One scene = one combined audiovisual review; no Quran provider selection. */
  sceneProduction: (episode: string, channel?: string) =>
    call<SceneProductionRead>(`/api/episodes/${episode}/scene-production`, undefined, channel),
  decideScene: (episode: string, channel: string, decision: SceneOwnerAction) =>
    call<SceneProductionRead>(`/api/episodes/${episode}/scene-production`, {
      method: "POST", json: decision,
    }, channel),
  assembleSceneAv: (episode: string, channel: string) =>
    call<{ ok: true; version: number; scenes: number }>(
      `/api/episodes/${episode}/scene-av-assemble`, {
        method: "POST",
      }, channel),
  renderSceneAv: (episode: string, channel: string, sceneId: string,
    expectedSha256: string) =>
    call<{ ok: true; version: number; preview: string }>(
      `/api/episodes/${episode}/scene-av-render`, {
        method: "POST", json: { sceneId, expectedSha256 },
      }, channel),
  /** «معاينة قبل النهائية»: all current scene cuts in order, recitations missing; never an approval. */
  preFinal: (episode: string, channel: string) =>
    call<{ preview: string | null; entry: { title: string; version: number; updatedAt: string | null } | null }>(
      `/api/episodes/${episode}/scene-prefinal`, undefined, channel),
  makePreFinal: (episode: string, channel: string) =>
    call<{ ok: true; preview: string; version: number; scenes: number; recitationPending: string[] }>(
      `/api/episodes/${episode}/scene-prefinal`, { method: "POST" }, channel),
  /** D199: what the owner played of the current pre-final, and the list «اعتمد المشاهد التي شاهدتها كاملة» would show. */
  preFinalWatch: (episode: string, channel: string) =>
    call<PreFinalWatchView>(`/api/episodes/${episode}/prefinal-watch`, undefined, channel),
  addPreFinalWatch: (episode: string, channel: string, fileSha256: string, spans: [number, number][]) =>
    call<{ watched: [number, number][] }>(`/api/episodes/${episode}/prefinal-watch`, { method: "POST", json: { fileSha256, spans } }, channel),
  approveWatchedPreFinal: (episode: string, channel: string, fileSha256: string, sceneIds: string[]) =>
    call<{ approved: string[]; failed: { id: string; error: string }[] }>(`/api/episodes/${episode}/prefinal-approve`,
      { method: "POST", json: { fileSha256, sceneIds, confirmed: true } }, channel),
  /** The owner's own recitations: upload (processed + original kept), switch variant, approve after listening. */
  ownRecitations: (episode: string, channel: string) =>
    call<OwnRecitationsRead>(`/api/episodes/${episode}/own-recitations`, undefined, channel),
  ownRecitationAction: (episode: string, channel: string, body:
    | { action: "upload"; key: string; name: string; data: string }
    | { action: "select"; key: string; variant: "processed" | "original" }
    | { action: "approve"; key: string; reciter: string; rightsEvidence: string; note: string; listened: boolean }) =>
    call<Record<string, unknown>>(`/api/episodes/${episode}/own-recitations`, {
      method: "POST", json: body }, channel),
  /** الصوت جملةً جملة (D50): قراءة جمل الحلقة، وفعل المالك على جملة. */
  sentences: (episode: string, channel: string) =>
    call<SentencesRead>(`/api/episodes/${episode}/sentences`, undefined, channel),
  /** D97: what choosing the episode tone would invalidate (read only; shown before it is applied). */
  toneImpact: (episode: string, channel: string | undefined, tone: string | null, sceneId?: string | null) =>
    call<ToneImpact>(`/api/episodes/${episode}/sentences/tone-impact?tone=${encodeURIComponent(tone ?? "")}${sceneId ? `&scene=${encodeURIComponent(sceneId)}` : ""}`, undefined, channel),
  /** D136: the tone of a whole scene, or of the episode (sceneId null), from «الجمل»; nothing is generated. */
  toneScope: (episode: string, channel: string, body: { sceneId: string | null; tone: string | null }) =>
    call<{ read: SentencesRead; planChanged: boolean; plan?: Plan; media?: EpisodeMedia }>(`/api/episodes/${episode}/sentences/tone-scope`, { method: "POST", json: body }, channel),
  sentenceAction: (episode: string, channel: string, body: SentenceCommand) =>
    call<{ read: SentencesRead; planChanged: boolean; plan?: Plan; media?: EpisodeMedia; composed?: { sceneId: string; composed: boolean; reason?: string }; message?: string; fix?: WordFixOutcome;
      confirm?: { kind: "same-send"; message: string } }>(
      `/api/episodes/${episode}/sentences`, { method: "POST", json: body }, channel),
  /** «أعد توليد ما وُلّد بنبرة سابقة» (بعد استعادة أول نسخة من النبرات، ١٢ نوفمبر): dryRun يعرض العدد والحروف، ثم التوليد بضغطة المالك */
  toneUpgrade: (episode: string, channel: string, dryRun: boolean) =>
    call<{ plan?: ToneUpgradePlan; result?: ToneUpgradeResult; media?: EpisodeMedia }>(`/api/episodes/${episode}/voice/upgrade-tone`, { method: "POST", json: { dryRun } }, channel),
  /** قاموس النطق للقناة: تعديل كلمة أو حذفها */
  lexiconAction: (episode: string, channel: string, body: LexiconCommand) =>
    call<{ read: SentencesRead }>(`/api/episodes/${episode}/pronunciations`, { method: "POST", json: body }, channel),
  /** Step ١ «التجهيز»: what still blocks the one-button approval (script errors, verses without text, board record). */
  preparation: (episode: string, channel: string) =>
    call<PreparationRead>(`/api/episodes/${episode}/approve-preparation`, undefined, channel),
  /**
   * «اعتمد التجهيز»: the script approval, then (if needed) the board record, then the storyboard approval, each
   * checked by the server; then the free drafts start on their own (scenes whose voice exists; nothing approved, nothing
   * paid: the voice waits for «ولّد الصوت الآن», owner decision 15–16 Nov).
   */
  approvePreparation: (episode: string, channel: string, body: { scriptSha256: string; storyboardSha256: string; reviewed: boolean; note?: string }) =>
    call<SceneProductionRead & { prepare: { job: ScenePrepareJob | null; voicePlan?: VoiceGenerationPlan | null; error?: string } }>(`/api/episodes/${episode}/approve-preparation`, {
      method: "POST", json: body,
    }, channel),
  /** M6: the seams heard in the current assembly (server-side, per assembly fingerprint). */
  seamChecks: (episode: string, channel: string) =>
    call<{ assembly: string | null; heard: Record<string, { how: "played" | "confirmed"; at: string }> }>(`/api/episodes/${episode}/seam-checks`, undefined, channel),
  recordSeam: (episode: string, channel: string, body: { seam: string; assemblySha256: string; how?: "played" | "confirmed"; heard?: boolean; playedSec?: number }) =>
    call<{ assembly: string; heard: Record<string, { how: "played" | "confirmed"; at: string }> }>(`/api/episodes/${episode}/seam-checks`, { method: "POST", json: body }, channel),
  /** «جهّز كل المشاهد»: status of the background queue (read-only). */
  scenePrepare: (episode: string, channel: string) =>
    call<ScenePrepareRead>(`/api/episodes/${episode}/scene-prepare`, undefined, channel).then(prepareRead),
  /**
   * Free by default: «أنتج كل المشاهد الجاهزة» / «استأنف إنتاج المسودات» render the scenes whose takes exist; never any voice
   * (D145; owner decision 15–16 Nov). `voice`: «ولّد الصوت الآن» after the owner confirmed the plan he read — the only
   * start that may pay; a plan changed since is refused (409 VOICE_PLAN_CHANGED) with the new numbers.
   */
  startScenePrepare: (episode: string, channel: string, opts: { renderOnly?: boolean; voice?: { confirm: true; fingerprint: string } } = {}) =>
    call<ScenePrepareRead>(`/api/episodes/${episode}/scene-prepare`, {
      method: "POST", ...(opts.voice ? { json: { voice: opts.voice } } : opts.renderOnly ? { json: { renderOnly: true } } : {}),
    }, channel).then(prepareRead),
  /** بطاقة الجودة (المرحلة A): القراءة، و«قِس الآن» في الخلفية */
  qualityCard: (episode: string, target?: CardTarget) => call<QualityCardRead>(`/api/episodes/${episode}/quality-card${target ? `?target=${target}` : ""}`),
  measureQuality: (episode: string, target: CardTarget) => call<{ ok: boolean; measuring: boolean }>(`/api/episodes/${episode}/quality-card/measure`, { method: "POST", json: { target } }),
  /** «سرعة الإلقاء» و«الفاصل بين الجمل»: الإعداد والمشاهد المتأثرة والمدة (قراءة)، والحفظ (pace.json وحده) */
  pace: (episode: string, channel: string | undefined) => call<PaceStatus>(`/api/episodes/${episode}/pace`, undefined, channel),
  setPace: (episode: string, channel: string | undefined, body: PaceCommand) =>
    call<PaceStatus>(`/api/episodes/${episode}/pace`, { method: "POST", json: body }, channel),
  /** «أعد إنتاج المشاهد المتأثرة»: نسخ السرعة من التسجيلات القائمة (مجانًا) ثم المسودات وحدها، بلا أي طلب صوت */
  applyPace: (episode: string, channel: string) =>
    call<ScenePrepareRead & { pace?: RefreshResult }>(`/api/episodes/${episode}/scene-prepare`, { method: "POST", json: { pace: "apply" } }, channel)
      .then((r) => ({ ...prepareRead(r), pace: r.pace })),
  /** «أوقف»: the step in progress finishes and is kept; nothing new starts. */
  stopScenePrepare: (episode: string, channel: string) =>
    call<ScenePrepareRead>(`/api/episodes/${episode}/scene-prepare`, {
      method: "DELETE",
    }, channel).then(prepareRead),
  /** المراجعات الفنية للقناة (توصيات المنفّذ وشرائطها ومقاطعها) */
  techReviews: (channel: string) => call<{ reviews: TechReviewSummary[] }>("/api/tech-reviews", undefined, channel),
  techReviewFileUrl: (channel: string, dir: string, id: string, rel: string) => `/api/tech-reviews/${encodeURIComponent(dir)}/${encodeURIComponent(id)}/${rel.split("/").map(encodeURIComponent).join("/")}?channel=${encodeURIComponent(channel)}`,
  /** مختبرات الإنتاج للقناة (ليست حلقات) */
  labs: (channel: string) => call<{ labs: LabSummary[] }>("/api/labs", undefined, channel),
  labStoryboards: (channel: string, dir: string) => call<{ entries: StoryboardEntry[] }>(`/api/labs/${encodeURIComponent(dir)}/storyboards`, undefined, channel),
  labStoryboardUrl: (channel: string, dir: string, file: string) => `/api/labs/${encodeURIComponent(dir)}/storyboards/${encodeURIComponent(file)}?channel=${encodeURIComponent(channel)}`,
  decideLabStoryboard: (channel: string, dir: string, slot: string, version: number, status: StoryboardStatus, note: string) =>
    call<{ version: StoryboardVersion }>(`/api/labs/${encodeURIComponent(dir)}/storyboards/${encodeURIComponent(slot)}/${version}/decision`, { method: "POST", json: { status, note } }, channel),
  labPreviewUrl: (channel: string, dir: string, name: string) => `/api/labs/${encodeURIComponent(dir)}/previews/${encodeURIComponent(name)}?channel=${encodeURIComponent(channel)}`,
  /** دليل الاستوديو للقناة (null إن لم يكن لها دليل) */
  guideIndex: (channel: string) => call<{ index: GuideIndex | null }>("/api/guide", undefined, channel),
  guidePage: (channel: string, file: string) => call<{ text: string }>(`/api/guide/${encodeURIComponent(file)}`, undefined, channel),
  /** غرفة العمليات: كل القنوات */
  ops: () => call<OpsChannel[]>("/api/ops"),
  // D191: الطابور الليلي والمراجعة الأسبوعية (ملفات محلية على جهاز المالك)
  nightly: () => call<{ settings: { enabled: boolean; hour: number }; running: boolean; markdown: string | null }>("/api/nightly"),
  saveNightly: (s: { enabled: boolean; hour: number }) => call<{ settings: { enabled: boolean; hour: number } }>("/api/nightly/settings", { method: "PUT", json: s }),
  runNightly: () => call<{ started: boolean }>("/api/nightly/run", { method: "POST", json: {} }),
  weekly: () => call<{ markdown: string | null }>("/api/weekly"),
  buildWeekly: () => call<{ markdown: string }>("/api/weekly/build", { method: "POST", json: {} }),
  saveCalendar: (channel: string, calendar: Record<string, CalendarDay>) => call("/api/calendar", { method: "PUT", json: { calendar } }, channel),
  channelFor: (channel: string) => call<ChannelConfig>("/api/channel", undefined, channel),
  saveChannelFor: (channel: string, c: ChannelConfig) => call("/api/channel", { method: "PUT", json: { channel: c } }, channel),
  saveIdeas: (channel: string, ideas: Idea[]) => call("/api/ideas", { method: "PUT", json: { ideas } }, channel),
  statusFor: (channel: string, id: string) => call<EpisodeStatus>(`/api/episodes/${id}/status`, undefined, channel),
  saveStatusFor: (channel: string, id: string, status: EpisodeStatus) => call(`/api/episodes/${id}/status`, { method: "PUT", json: { status } }, channel),
  channels: () => call<ChannelSummary[]>("/api/channels"),
  episodes: () => call<EpisodeSummary[]>("/api/episodes"),
  createEpisode: (b: { episode: string; slug: string; domain: string; title: string; series?: string }) => call("/api/episodes", { method: "POST", json: b }),
  series: () => call<SeriesRead>("/api/series"),
  /** المكتبة (D206): السجلان، ومواضع الحلقات، وقوائم التشغيل التلقائية */
  library: () => call<LibraryRead>("/api/library"),
  saveScholar: (scholar: Scholar) => call<{ ok: boolean }>(`/api/library/scholars/${scholar.id}`, { method: "PUT", json: { scholar } }),
  saveBook: (book: Book) => call<{ ok: boolean }>(`/api/library/books/${book.id}`, { method: "PUT", json: { book } }),
  /** مواسم السنة الهجرية (عمود «بالإسلام»، عاشرًا/٦) */
  seasons: () => call<{ today: string; seasons: SeasonView[]; issues: string[] }>("/api/seasons"),
  saveSeason: (season: Season) => call<{ ok: boolean }>(`/api/seasons/${season.id}`, { method: "PUT", json: { season } }),
  // D213 بناء المخزون: «بانتظارك» (القنوات الثلاث) وترتيب النشر لكل قناة (ترتيب لا مواعيد)
  stockAll: () => call<{ channels: StockOverview[] }>("/api/stock?all=1"),
  stock: () => call<StockOverview>("/api/stock"),
  saveStock: (stock: Stock) => call<{ ok: boolean; saved: Stock }>("/api/stock", { method: "PUT", json: { stock } }),
  stockFile: (ch: string, ep: string, name: string) => call<{ name: string; text: string | null }>(`/api/stock/${ch}/${ep}/file?name=${encodeURIComponent(name)}`),
  /** D228: القوالب الجديدة بحالتها والستوري بورد بنماذجه */
  templateApprovals: () => call<{ templates: Record<string, import("../../src/plan/templateApproval").TemplateApproval>; storyboards: import("../../src/studio/storyboards").Storyboard[] }>("/api/template-approvals"),
  storyboardImageUrl: (folder: string, file: string) => `/api/template-approvals/image?folder=${encodeURIComponent(folder)}&file=${encodeURIComponent(file)}`,
  approveTemplate: (key: string, variant: string) => call<{ ok: boolean }>("/api/template-approvals/approve", { method: "POST", json: { key, variant } }),
  approveDraftScript: (ch: string, ep: string) => call<{ ok: boolean; at: string }>(`/api/stock/${ch}/${ep}/approve-script`, { method: "POST", json: {} }),
  saveSeries: (series: SeriesConfig) => call<{ ok: boolean; series: SeriesConfig; derived: DerivedSeriesIdentity }>(`/api/series/${series.id}`, { method: "PUT", json: { series } }),
  deleteSeries: (id: string) => call<{ ok: boolean }>(`/api/series/${id}`, { method: "DELETE" }),
  moveEpisodeToSeries: (id: string, episode: string) => call<{ ok: boolean }>(`/api/series/${id}/episodes`, { method: "POST", json: { episode } }),
  /** Move many episodes at once (D77): a result per episode, and a token for «تراجع» (null when nothing moved). */
  moveEpisodes: (to: string, episodes: string[]) => call<MoveEpisodesResult>("/api/series/move-episodes", { method: "POST", json: { to, episodes } }),
  undoMoveEpisodes: (token: string) => call<{ ok: boolean; results: EpisodeMoveResult[] }>("/api/series/move-episodes/undo", { method: "POST", json: { token } }),
  research: (id: string) => call<{ text: string; exists: boolean; label: string }>(`/api/episodes/${id}/research`),
  saveResearch: (id: string, text: string) => call<{ ok: boolean }>(`/api/episodes/${id}/research`, { method: "PUT", json: { text } }),
  /** «النص المشكول» (D132): tashkeel.md للصوت وحده؛ الحفظ بنسخة الملف التي فُتحت (409 TASHKEEL_REVISION_STALE إن تغيّر بعدها). */
  tashkeel: (id: string) => call<TashkeelState>(`/api/episodes/${id}/tashkeel`),
  checkTashkeel: (id: string, text: string) => call<TashkeelCheck>(`/api/episodes/${id}/tashkeel/check`, { method: "POST", json: { text } }),
  saveTashkeel: (id: string, b: { text?: string; fromScript?: true; expectedRevision: string }) =>
    call<TashkeelState & { changedSentences: number; staleTakes: number }>(`/api/episodes/${id}/tashkeel`, { method: "PUT", json: b }),
  review: (id: string) => call<{ items: ReviewItem[]; summary: ReviewSummary }>(`/api/episodes/${id}/review`),
  setReview: (id: string, b: { key: string; status: "verified" | "rejected" | "pending"; note?: string }) => call<{ items: ReviewItem[]; summary: ReviewSummary }>(`/api/episodes/${id}/review`, { method: "PUT", json: b }),
  /** QA balislam 7: «حذف الحلقة» moves the folder into the local trash (nothing deleted, nothing pushed); «تراجع» restores. */
  trashPreview: (id: string) => call<{ dir: string; trash: string; contents: EpisodeContents }>(`/api/episodes/${id}/trash-preview`),
  deleteEpisode: (id: string, confirm: string) => call<{ ok: boolean; dir: string; trash: string; entry: TrashEntry; tracked: number }>(`/api/episodes/${id}`, { method: "DELETE", json: { confirm } }),
  trashList: () => call<{ trash: string; items: TrashEntry[] }>("/api/trash"),
  restoreTrash: (id: string) => call<{ ok: boolean; entry: TrashEntry }>("/api/trash/restore", { method: "POST", json: { id } }),
  episode: (id: string, channel?: string) => call<EpisodeData>(`/api/episodes/${id}`, undefined, channel).then((d) => ({ ...d, check: ownerCheck(d.check, d.plan) })),
  saveScript: (id: string, text: string) => call<{ check: CheckResult; plan: Plan } & ScriptSaveReply>(`/api/episodes/${id}/script`, { method: "PUT", json: { text } }).then((d) => ({ ...d, check: ownerCheck(d.check, d.plan) })),
  savePlan: (id: string, plan: Plan, channel: string, expectedRevision: string) =>
    call<{ ok: boolean; planRevision: string }>(`/api/episodes/${id}/plan`, { method: "PUT", json: { plan, expectedRevision } }, channel),
  /** مقاطع الشورتس (D83): الاختيار المحفوظ والمقترح ومشاهد الحلقة بمددها؛ الحفظ يكتب plan.shorts وحدها */
  shorts: (id: string) => call<ShortsRead>(`/api/episodes/${id}/shorts`),
  saveShorts: (id: string, shorts: PlanShort[]) => call<ShortsRead & { warnings: string[] }>(`/api/episodes/${id}/shorts`, { method: "PUT", json: { shorts } }),
  /** يحذف الاختيار فيعود السلوك السابق (شورت لكل قسم إن وُجد قسمان فأكثر) */
  resetShorts: (id: string) => call<ShortsRead & { warnings: string[] }>(`/api/episodes/${id}/shorts`, { method: "PUT", json: { reset: true } }),
  /** على خطة مصمَّمة يرفض الخادم (409) إلا بـ confirmRegenerate من planGuard.ts (رقم الحلقة مكتوبًا) */
  regenerate: (id: string, confirm: { overwriteDesigned?: true; confirmEpisode?: string } = {}) =>
    call<{ plan: Plan; backup?: string }>(`/api/episodes/${id}/plan/regenerate`, { method: "POST", json: confirm }),
  check: (text: string) => call<CheckResult>("/api/check", { method: "POST", json: { text } }).then((c) => ownerCheck(c)),
  identity: () => call<{ identity: Identity; defaults: Identity }>("/api/identity"),
  saveIdentity: (identity: Identity) => call("/api/identity", { method: "PUT", json: { identity } }),
  render: (b: { episode: string; orientation: string; chapter?: number }) => call<RenderJob>("/api/render", { method: "POST", json: b }).then(ownerJob),
  jobs: () => call<RenderJob[]>("/api/render").then((js) => js.map(ownerJob)),
  libraryImages: () => call<{ files: string[] }>("/api/library-images"),
  libraryImageUrl: (file: string) => withChannel(`/api/library-images/file/${encodeURIComponent(file)}`),
  uploadLibraryImage: (b: { slot: string; name: string; data: string }) => call<{ file: string }>("/api/library-images", { method: "POST", json: b }),
  uploadImage: (id: string, b: { name: string; data: string; scene: string }) => call<{ file: string; media: EpisodeMedia }>(`/api/episodes/${id}/images`, { method: "POST", json: b }),
  voice: (id: string, b: { scenes?: string[]; dryRun?: boolean; force?: boolean; confirmSame?: boolean }) => call<{ report: VoiceReport | null; generated: boolean; noKey?: boolean; media: EpisodeMedia;
      /** D136: nothing that would be sent changed; nothing was generated until the owner confirms */
      confirm?: { kind: "same-send"; count: number; message: string };
      /** M5: a scene voiced sentence by sentence was regenerated sentence by sentence. */
      sentences?: { generated: number; composed: { sceneId: string; composed: boolean; reason?: string } | null } }>(`/api/episodes/${id}/voice`, { method: "POST", json: b }),
  overview: () => call<Overview[]>("/api/overview"),
  status: (id: string) => call<EpisodeStatus>(`/api/episodes/${id}/status`),
  saveStatus: (id: string, status: EpisodeStatus) => call(`/api/episodes/${id}/status`, { method: "PUT", json: { status } }),
  packageInfo: (id: string) => call<PackageInfo>(`/api/episodes/${id}/package`),
  /** D53: الملفات المعتمدة في مجلد Google Drive بعد إذن النشر (الحالة، وإعادة الإرسال وفتح المجلد). */
  driveHandoff: (id: string) => call<DriveHandoffRead>(`/api/episodes/${id}/publish-drive`),
  resendToDrive: (id: string) =>
    call<DriveHandoffRead>(`/api/episodes/${id}/publish-drive`, { method: "POST" }),
  openDriveFolder: (id: string) =>
    call<{ folder: string }>(`/api/episodes/${id}/publish-drive/open`, { method: "POST" }),
  packageUrl: (id: string, file: string, download = false) => withChannel(`/api/episodes/${id}/package/${encodeURIComponent(file)}${download ? "?download=1" : ""}`),
  channel: () => call<ChannelConfig>("/api/channel"),
  saveChannel: (channel: ChannelConfig) => call("/api/channel", { method: "PUT", json: { channel } }),
  createChannel: (b: { id: string; name: string; language: string; nameLatin?: string; quran: boolean }) => call("/api/channels", { method: "POST", json: b }),
  updateStatus: (force = false) => call<{ available: boolean; behind: number; changes: string[]; error?: string; blocked?: string; local?: number; conflicts?: UpdateConflict[] }>(`/api/update${force ? "?force=1" : ""}`),
  applyUpdate: () => call<{ ok: boolean; message: string; reinstalled?: boolean; restart?: boolean; conflicts?: UpdateConflict[] }>("/api/update", { method: "POST", json: {} }),
  /** D101: حالة «كل الأماكن نسخة واحدة» (الحفظ الآلي في main واستقبال التحديثات) */
  syncStatus: () => call<SyncStatus>("/api/sync"),
  /** D112: a page error, written to .studio/errors.jsonl on this device (app/server/errors.ts) */
  reportError: (b: { kind: "render" | "window" | "rejection"; message: string; stack?: string; componentStack?: string; label?: string;
    route?: string; channel?: string; episode?: string; sceneId?: string }) => call<{ id: string; message: string }>("/api/errors", { method: "POST", json: b }),
  /** D112: «أرسل المشكلة» — an `error` note in the episode's box (or the channel's general box), sent like the other notes */
  sendError: (id: string) => call<{ noteId: string; box: "episode" | "general"; channel: string; episode: string }>("/api/errors/send", { method: "POST", json: { id } }),
  /** D107: «ملاحظات لم تُرسل: N» (src/studio/notesSync.ts studioNotesStatus) */
  notesStatus: () => call<NotesStatus>("/api/notes/status"),
  /** D141: «جلسة عمل» — علم notes/work-session.json على studio-notes (src/studio/workSession.ts) */
  workSession: () => call<WorkSessionStatus>("/api/notes/work-session"),
  startWorkSession: (hours: number) => call<WorkSessionStatus>("/api/notes/work-session", { method: "POST", json: { action: "start", hours } }),
  stopWorkSession: () => call<WorkSessionStatus>("/api/notes/work-session", { method: "POST", json: { action: "stop" } }),
  syncNow: () => call<SyncStatus>("/api/sync", { method: "POST", json: {} }),
  restartStudio: () => call<{ ok: boolean; message: string }>("/api/sync/restart", { method: "POST", json: {} }),
  /** D95: «أبقِ نسختي» أو «خذ الجديد» لملف واحد تعارض فيه تعديل المالك مع التحديث */
  resolveUpdateConflict: (file: string, choice: "mine" | "new") => call<{ ok: boolean; message: string }>("/api/update/resolve", { method: "POST", json: { file, choice } }),
  kit: (id: string) => call<{ kit: PublishKit; keywords: string[]; chapters: string; chaptersEstimated?: boolean; chaptersSource?: "assembly" | "master" | "plan"; sceneStarts?: SceneStarts; titleCtx?: { channel?: string; book?: string; series?: string } }>(`/api/episodes/${id}/kit`),
  saveKit: (id: string, kit: PublishKit) => call(`/api/episodes/${id}/kit`, { method: "PUT", json: { kit } }),
  regenerateKit: (id: string) => call<{ kit: PublishKit; keywords: string[] }>(`/api/episodes/${id}/kit/regenerate`, { method: "POST", json: {} }),
  keys: () => call<{ keys: KeyState }>("/api/settings"),
  saveKeys: (updates: Record<string, string>) => call<{ keys: KeyState }>("/api/settings", { method: "PUT", json: { updates } }),
  /** تجربة سماع: النماذج المتاحة، وعيّنة بطبقة ونبرة ونموذج (تُحفظ فلا يُصرف رصيد مرتين) */
  voiceModels: (channel: string) => call<{ models: { id: string; name: string; arabic: boolean }[]; current: string }>("/api/voice-sample/models", undefined, channel),
  voiceSample: (channel: string, b: { text: string; tone?: string; model?: string; profile?: { speed: number; stability: number; style: number } }) =>
    call<{ file: string; cached: boolean; chars: number; model: string }>("/api/voice-sample", { method: "POST", json: b }, channel),
  voiceSampleUrl: (channel: string, file: string) => `/api/voice-sample/file/${encodeURIComponent(file)}?channel=${encodeURIComponent(channel)}`,
  testService: (service: "elevenlabs" | "quran") => call<{ ok: boolean; message?: string; account?: { tier: string; character_count: number; character_limit: number }; voices?: { id: string; name: string; category: string }[]; voiceFound?: boolean; models?: { id: string; name: string; arabic: boolean }[]; training?: Record<string, string>; voiceCategory?: string; model?: string; sample?: string; env?: string }>("/api/settings/test", { method: "POST", json: { service } }),
  sfx: () => call<SfxItem[]>("/api/sfx"),
  sfxUrl: (id: string) => withChannel(`/api/sfx/${id}.mp3`),
  startJob: (b: { kind: "make" | "package" | "shorts" | "thumbnails" | "sfx" | "storyboard-motion"; episode?: string; noVoice?: boolean }) => call<LongJob>("/api/jobs", { method: "POST", json: b }).then(ownerJob),
  /** إلغاء مهمة منتظرة أو جارية (رندر أو صناعة) */
  cancelJob: (id: string) => call<{ ok: boolean }>(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  storyboard: (id: string) => call<StoryboardInfo>(`/api/episodes/${id}/storyboard`),
  previewUrl: (id: string, name: string) => withChannel(`/api/episodes/${id}/previews/${encodeURIComponent(name)}`),
  /** KI-066: a scene cut's URL carries its fingerprint, so a new cut under the same name is never the old one from a cache. */
  scenePreviewUrl: (id: string, sceneId: string, sha256: string | null | undefined) =>
    withChannel(`/api/episodes/${id}/previews/${encodeURIComponent(`scene-${sceneId}-av.mp4`)}${sha256 ? `?v=${sha256.slice(0, 16)}` : ""}`),
  reviewUrl: (id: string, name: string) => withChannel(`/api/episodes/${id}/reviews/${encodeURIComponent(name)}`),
  reviews: (id: string) => call<{ files: { name: string; title: string; note: string; mtime: number }[] }>(`/api/episodes/${id}/reviews`),
  previews: (id: string) => call<{ files: EpisodePreview[]; autoDownload?: boolean }>(`/api/episodes/${id}/previews`),
  downloadPreview: (id: string, name: string) => call<{ job: CloudPreviewJob | null }>(`/api/episodes/${id}/previews/${encodeURIComponent(name)}/download`, { method: "POST" }),
  previewDownload: (id: string, name: string) => call<{ job: CloudPreviewJob | null }>(`/api/episodes/${id}/previews/${encodeURIComponent(name)}/download`),
  cloudPreviewSettings: (autoDownload?: boolean) => call<{ autoDownload: boolean }>("/api/cloud-previews/settings",
    autoDownload === undefined ? undefined : { method: "POST", json: { autoDownload } }),
  auditQuranScript: (id: string) =>
    call<{ environment: string; audits: { key: string; status: "match" | "differs" | "pending" | "missing" | "failed";
      reason?: string; categories: Record<string, string>; numbers: { ok: boolean; notes: string[] };
      ops: { at: number; op: string; shown: string; ref: string; cls: string }[] }[] }>(
      `/api/episodes/${id}/quran-audit`),
  missingQuranTexts: (id: string) =>
    call<{ status: { missing: string[]; existing: string[]; invalid: { ref: string; reason: string }[] } }>(
      `/api/episodes/${id}/quran-text-only`),
  fetchMissingQuranTexts: (id: string) =>
    call<{ result: { fetched: string[]; existing: string[]; failed: { ref: string; reason: string }[] };
      status: { missing: string[]; existing: string[]; invalid: { ref: string; reason: string }[] } }>(
      `/api/episodes/${id}/quran-text-only`, { method: "POST", json: { confirm: true } }),
  storyboardReport: (id: string) => call<{ markdown: string }>(`/api/episodes/${id}/storyboard-report`),
  setStoryboard: (id: string, action: "approve", auditNote?: string) => call<StoryboardInfo>(`/api/episodes/${id}/storyboard`, { method: "PUT", json: { action, auditNote } }),
  longJobs: () => call<LongJob[]>("/api/jobs").then((js) => js.map(ownerJob)),
  videoUrl: (episode: string, file: string) => withChannel(`/api/episodes/${episode}/video/${encodeURIComponent(file)}`),
};

/** D107: src/studio/notesSync.ts NotesStatus */
export type NotesStatus = {
  pending: number;
  reason: "offline" | "rejected" | "auth" | "not-owner" | "no-repo" | "no-remote" | "error" | null;
  detail: string | null; lastAttemptAt: string | null; sending: boolean;
  where: { channel: string; episode: string; count: number }[];
};

/** D141: src/studio/workSession.ts WorkSessionStatus */
export type WorkSessionStatus = {
  session: { active: boolean; until: string; startedAt: string; channel: string | null } | null;
  live: boolean;
  push: { state: "sent"; at: string; commit: string | null } | { state: "failed"; at: string; reason: NonNullable<NotesStatus["reason"]>; message: string } | null;
  lastResolved: { at: string; count: number; sinceStart: number } | null;
  hours: number[];
};
/** D148: src/studio/remoteChanges.ts (what a conversation changed, as this machine received it). */
export type RemoteWhat = "plan" | "script" | "voice" | "tone" | "engine" | "research" | "publish" | "other";
export type RemoteSceneChangeView = { at: string; what: RemoteWhat[]; subjects: string[]; answer?: string };
export type ReceivedSummary = { at: string; from: string; to: string; commits: string[];
  items: { channel: string; episode?: string; scenes: string[]; what: RemoteWhat[]; label: string }[] };

/** D101: app/server/contentSync.ts SyncState */
export type SyncStatus = {
  enabled: boolean;
  state: "off" | "synced" | "saving" | "pending" | "updating" | "conflict" | "error" | "behind";
  message: string; pending: string[]; skipped: string[]; conflicts: number;
  lastSavedAt?: string; lastCommit?: string; lastUpdateAt?: string; updateNote?: string; restartNeeded?: boolean; supervised: boolean;
  restartPending?: boolean; lastCheckAt?: string; receiveError?: string; lastReceived?: ReceivedSummary;
};

export type StockOverview = { channel: string; frozen?: Stock["frozen"]; phase: number; views: StockEpisodeView[]; issues: string[] };
