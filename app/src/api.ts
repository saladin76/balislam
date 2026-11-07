import type { Plan } from "../../src/plan/types";
import type { Identity } from "../../brand/identity/index";
import type { EpisodeMedia } from "../../src/plan/media";
import type { PlanIssue } from "../../src/plan/validate";
import type { PublishKit } from "../../src/package/social";
import type { ChannelConfig, ChannelDomain, ChannelInfo } from "../../src/channel/types";
import type { CloudRecitation } from "../../src/quran/provider";
import type { GuideIndex } from "../../src/channel/guide";
import type { LabSummary } from "../../src/channel/labs";
import type { StoryboardEntry, StoryboardStatus, StoryboardVersion } from "../../src/channel/labStoryboardsShared";
import type { TechReviewSummary } from "../../src/channel/techReviews";

export type Issue = { level: "error" | "warning"; code: string; message: string; line?: number };
export type CheckResult = { ok: boolean; issues: Issue[]; stats: { chapters: { number: number; words: number; seconds: number }[]; totalWords: number; totalSeconds: number } };
export type EpisodeSummary = { id: string; dir: string; title: string; domain: string; hasPlan: boolean };
export type ChannelSummary = { id: string; name: string; language: string; domains: Record<string, ChannelDomain> };
export type EpisodeData = { channel: ChannelInfo; script: string; plan: Plan; check: CheckResult; media: EpisodeMedia; issues: PlanIssue[]; keys: { voice: boolean; quran: boolean } };
export type TashkeelReport = { file: boolean; words: number; covered: number; coverage: number; min: number; ok: boolean; gaps: { sceneId: string; words: string[]; narration: string }[]; ambiguous: { word: string; forms: string[]; scenes: string[] }[] };
export type ReviewItem = { key: string; kind: "ayah" | "hadith" | "other"; label: string; ref: string; detail: string; text?: string; line: number; hash: string; status: "pending" | "changed" | "verified" | "rejected"; note?: string; at?: string };
export type ReviewSummary = { total: number; verified: number; pending: number; changed: number; rejected: number; ok: boolean };
export type SceneReviewItem = { id: string; hash: string; status: "pending" | "changed" | "ok" | "fix"; note?: string; at?: string };
export type SceneReviewSummary = { total: number; ok: number; fix: number; pending: number; changed: number; done: boolean };
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
  package: { video: boolean; shorts: number; thumbnails: number; updatedAt: number | null };
  planUpdatedAt: number | null;
  /** الأسلوب الغالب على الحلقة (للتنوّع) */
  style: string;
  status: EpisodeStatus;
};
export type EpisodeStatus = { /** اعتماد النسخة الأساسية بعد مشاهدتها كاملة (بصمة ملف الحلقة) */ approved?: { at: string; size: number; mtime: number }; checklist?: Record<string, boolean>; published?: { date: string; url?: string }; notes?: string; /** يوم نشر الحلقة الطويلة المخطط (YYYY-MM-DD) */ scheduled?: string };
export type Idea = { id: string; title: string; note?: string; domain?: string; style?: string; createdAt: string };
/** يوم في تقويم القناة: شورتس محددة (حلقة + رقم الشورت)، أو بلا نشر، وملاحظة */
export type CalendarDay = { shorts?: { ep: string; n: number }[]; off?: boolean; note?: string };
export type OpsChannel = { calendar: Record<string, CalendarDay>; channel: { id: string; name: string; language: string; schedule: { longDay: number; time?: string; shortsPerDay?: number } | null; domains: Record<string, ChannelDomain> }; episodes: Overview[]; ideas: Idea[] };
export type PackageInfo = { files: { name: string; size: number; mtime: number }[]; youtube: string; checklist: string; /** بأي جودة رُندرت الحلقة */ render?: { quality: "master" | "preview"; label: string; width: number; height: number; voiced: boolean; at: string } | null };
export type StoryboardInfo = { status: import("../../src/plan/storyboard").StoryboardStatus; motion: import("../../src/render/storyboardMotion").StoryboardMotion | null; motionStale?: string[]; auditNeedsReview?: boolean };
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

const call = async <T>(path: string, init?: RequestInit & { json?: unknown }, channel?: string): Promise<T> => {
  const url = channel ? `${path}${path.includes("?") ? "&" : "?"}channel=${encodeURIComponent(channel)}` : withChannel(path);
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `خطأ ${res.status}`);
  return data as T;
};

export type AlQuranAudioEdition = { identifier: string; name: string };
export type AlQuranAyahPreview = { surah: number; ayah: number; text: string; audio: string; reciter: string; rightsVerified: false; publicationAllowed: false };

export type StudioDelivery = {
  id: string; channel: string; episode: string; kind: "video" | "storyboard";
  slot: string; url: string; md5: string; updated: string; status: "delivered_pending_review";
};
export type StudioPendingJob = {
  id: string; channel: string; episode: string; slot: string;
  kind: "video" | "storyboard"; state: "waiting_for_mac" | "delivered";
};
export type StudioTransferOverview = {
  configured: boolean; deliveries: StudioDelivery[]; bridgeDeliveredJobs: number;
  pendingJobs: StudioPendingJob[]; note: string;
};

export type StudioReviewNote = { id: string; sceneId: string; timeSec: number; text: string; createdAt: string };
export const api = {
  reviewNotes: (episode: string) => call<{ notes: StudioReviewNote[] }>(`/api/episodes/${encodeURIComponent(episode)}/review-notes`),
  saveReviewNotes: (episode: string, notes: StudioReviewNote[]) => call<{ notes: StudioReviewNote[] }>(`/api/episodes/${encodeURIComponent(episode)}/review-notes`, { method: "PUT", json: { notes } }),
  studioTransfers: () => call<StudioTransferOverview>("/api/studio-transfers"),
  recitationChoice: (episode: string, channel: string) =>
    call<{ recitation: CloudRecitation | null }>(`/api/episodes/${episode}/recitation`, undefined, channel),
  saveRecitationChoice: (episode: string, channel: string, recitation: CloudRecitation | null) =>
    call<{ recitation: CloudRecitation | null }>(`/api/episodes/${episode}/recitation`, { method: "PUT", json: { recitation } }, channel),
  alquranEditions: () => call<{ editions: AlQuranAudioEdition[] }>("/api/alquran-cloud/editions"),
  alquranAyah: (surah: number, ayah: number, edition: string) =>
    call<AlQuranAyahPreview>(`/api/alquran-cloud/ayah?surah=${surah}&ayah=${ayah}&edition=${encodeURIComponent(edition)}`),

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
  saveCalendar: (channel: string, calendar: Record<string, CalendarDay>) => call("/api/calendar", { method: "PUT", json: { calendar } }, channel),
  channelFor: (channel: string) => call<ChannelConfig>("/api/channel", undefined, channel),
  saveChannelFor: (channel: string, c: ChannelConfig) => call("/api/channel", { method: "PUT", json: { channel: c } }, channel),
  saveIdeas: (channel: string, ideas: Idea[]) => call("/api/ideas", { method: "PUT", json: { ideas } }, channel),
  statusFor: (channel: string, id: string) => call<EpisodeStatus>(`/api/episodes/${id}/status`, undefined, channel),
  saveStatusFor: (channel: string, id: string, status: EpisodeStatus) => call(`/api/episodes/${id}/status`, { method: "PUT", json: { status } }, channel),
  channels: () => call<ChannelSummary[]>("/api/channels"),
  episodes: () => call<EpisodeSummary[]>("/api/episodes"),
  createEpisode: (b: { episode: string; slug: string; domain: string; title: string }) => call("/api/episodes", { method: "POST", json: b }),
  research: (id: string) => call<{ text: string; exists: boolean; label: string }>(`/api/episodes/${id}/research`),
  saveResearch: (id: string, text: string) => call<{ ok: boolean }>(`/api/episodes/${id}/research`, { method: "PUT", json: { text } }),
  sceneReview: (id: string) => call<{ items: SceneReviewItem[]; summary: SceneReviewSummary; criteria: string[] }>(`/api/episodes/${id}/scene-review`),
  setSceneReview: (id: string, b: { id: string; status: "ok" | "fix" | "pending"; note?: string }) => call<{ items: SceneReviewItem[]; summary: SceneReviewSummary; criteria: string[] }>(`/api/episodes/${id}/scene-review`, { method: "PUT", json: b }),
  review: (id: string) => call<{ items: ReviewItem[]; summary: ReviewSummary }>(`/api/episodes/${id}/review`),
  setReview: (id: string, b: { key: string; status: "verified" | "rejected" | "pending"; note?: string }) => call<{ items: ReviewItem[]; summary: ReviewSummary }>(`/api/episodes/${id}/review`, { method: "PUT", json: b }),
  deleteEpisode: (id: string, confirm: string) => call<{ ok: boolean; archived: number; pushed: boolean; note?: string }>(`/api/episodes/${id}`, { method: "DELETE", json: { confirm } }),
  episode: (id: string, channel?: string) => call<EpisodeData>(`/api/episodes/${id}`, undefined, channel),
  saveScript: (id: string, text: string) => call<{ check: CheckResult; plan: Plan }>(`/api/episodes/${id}/script`, { method: "PUT", json: { text } }),
  savePlan: (id: string, plan: Plan) => call(`/api/episodes/${id}/plan`, { method: "PUT", json: { plan } }),
  regenerate: (id: string) => call<{ plan: Plan }>(`/api/episodes/${id}/plan/regenerate`, { method: "POST", json: {} }),
  check: (text: string) => call<CheckResult>("/api/check", { method: "POST", json: { text } }),
  identity: () => call<{ identity: Identity; defaults: Identity }>("/api/identity"),
  saveIdentity: (identity: Identity) => call("/api/identity", { method: "PUT", json: { identity } }),
  render: (b: { episode: string; orientation: string; chapter?: number }) => call<RenderJob>("/api/render", { method: "POST", json: b }),
  jobs: () => call<RenderJob[]>("/api/render"),
  libraryImages: () => call<{ files: string[] }>("/api/library-images"),
  libraryImageUrl: (file: string) => withChannel(`/api/library-images/file/${encodeURIComponent(file)}`),
  uploadLibraryImage: (b: { slot: string; name: string; data: string }) => call<{ file: string }>("/api/library-images", { method: "POST", json: b }),
  uploadImage: (id: string, b: { name: string; data: string; scene: string }) => call<{ file: string; media: EpisodeMedia }>(`/api/episodes/${id}/images`, { method: "POST", json: b }),
  voice: (id: string, b: { scenes?: string[]; dryRun?: boolean; force?: boolean }) => call<{ report: VoiceReport; generated: boolean; media: EpisodeMedia }>(`/api/episodes/${id}/voice`, { method: "POST", json: b }),
  quran: (id: string, channel?: string) => call<{ plan: Plan; result: { fetched: string[]; recited: string[]; failed: { ref: string; reason: string }[] } }>(`/api/episodes/${id}/quran`, { method: "POST", json: {} }, channel),
  overview: () => call<Overview[]>("/api/overview"),
  status: (id: string) => call<EpisodeStatus>(`/api/episodes/${id}/status`),
  saveStatus: (id: string, status: EpisodeStatus) => call(`/api/episodes/${id}/status`, { method: "PUT", json: { status } }),
  packageInfo: (id: string) => call<PackageInfo>(`/api/episodes/${id}/package`),
  packageUrl: (id: string, file: string, download = false) => withChannel(`/api/episodes/${id}/package/${encodeURIComponent(file)}${download ? "?download=1" : ""}`),
  channel: () => call<ChannelConfig>("/api/channel"),
  saveChannel: (channel: ChannelConfig) => call("/api/channel", { method: "PUT", json: { channel } }),
  createChannel: (b: { id: string; name: string; language: string; nameLatin?: string; quran: boolean }) => call("/api/channels", { method: "POST", json: b }),
  quranRecitations: () => call<{ ok: boolean; message?: string; list: { id: number; name: string; style: string }[] }>("/api/quran/recitations"),
  quranTranslations: (lang: string) => call<{ ok: boolean; message?: string; list: { id: number; name: string; author: string; language: string }[] }>(`/api/quran/translations?lang=${lang}`),
  updateStatus: (force = false) => call<{ available: boolean; behind: number; changes: string[]; error?: string }>(`/api/update${force ? "?force=1" : ""}`),
  applyUpdate: () => call<{ ok: boolean; message: string; reinstalled?: boolean }>("/api/update", { method: "POST", json: {} }),
  kit: (id: string) => call<{ kit: PublishKit; keywords: string[]; chapters: string }>(`/api/episodes/${id}/kit`),
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
  startJob: (b: { kind: "make" | "package" | "shorts" | "sfx" | "storyboard-motion"; episode?: string; noVoice?: boolean }) => call<LongJob>("/api/jobs", { method: "POST", json: b }),
  /** إلغاء مهمة منتظرة أو جارية (رندر أو صناعة) */
  cancelJob: (id: string) => call<{ ok: boolean }>(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  storyboard: (id: string) => call<StoryboardInfo>(`/api/episodes/${id}/storyboard`),
  previewUrl: (id: string, name: string) => withChannel(`/api/episodes/${id}/previews/${encodeURIComponent(name)}`),
  reviewUrl: (id: string, name: string) => withChannel(`/api/episodes/${id}/reviews/${encodeURIComponent(name)}`),
  reviews: (id: string) => call<{ files: { name: string; title: string; note: string; mtime: number }[] }>(`/api/episodes/${id}/reviews`),
  previews: (id: string) => call<{ files: { name: string; size: number; mtime: number; title: string; note: string; version: number; updatedAt: string | null }[] }>(`/api/episodes/${id}/previews`),
  storyboardReport: (id: string) => call<{ markdown: string }>(`/api/episodes/${id}/storyboard-report`),
  setStoryboard: (id: string, action: "approve" | "revoke", auditNote?: string) => call<StoryboardInfo>(`/api/episodes/${id}/storyboard`, { method: "PUT", json: { action, auditNote } }),
  longJobs: () => call<LongJob[]>("/api/jobs"),
  videoUrl: (episode: string, file: string) => withChannel(`/api/episodes/${episode}/video/${encodeURIComponent(file)}`),
};
