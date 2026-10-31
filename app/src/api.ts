import type { Plan } from "../../src/plan/types";
import type { Identity } from "../../brand/identity/index";
import type { EpisodeMedia } from "../../src/plan/media";
import type { PlanIssue } from "../../src/plan/validate";
import type { PublishKit } from "../../src/package/social";
import type { ChannelConfig, ChannelDomain, ChannelInfo } from "../../src/channel/types";

export type Issue = { level: "error" | "warning"; code: string; message: string; line?: number };
export type CheckResult = { ok: boolean; issues: Issue[]; stats: { chapters: { number: number; words: number; seconds: number }[]; totalWords: number; totalSeconds: number } };
export type EpisodeSummary = { id: string; dir: string; title: string; domain: string; hasPlan: boolean };
export type ChannelSummary = { id: string; name: string; language: string; domains: Record<string, ChannelDomain> };
export type EpisodeData = { channel: ChannelInfo; script: string; plan: Plan; check: CheckResult; media: EpisodeMedia; issues: PlanIssue[]; keys: { voice: boolean; quran: boolean } };
export type VoiceReport = { total: number; toGenerate: { id: string; chars: number }[]; cached: string[]; chars: number; credits: number };
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
export type EpisodeStatus = { checklist?: Record<string, boolean>; published?: { date: string; url?: string }; notes?: string; /** يوم نشر الحلقة الطويلة المخطط (YYYY-MM-DD) */ scheduled?: string };
export type Idea = { id: string; title: string; note?: string; domain?: string; style?: string; createdAt: string };
/** يوم في تقويم القناة: شورتس محددة (حلقة + رقم الشورت)، أو بلا نشر، وملاحظة */
export type CalendarDay = { shorts?: { ep: string; n: number }[]; off?: boolean; note?: string };
export type OpsChannel = { calendar: Record<string, CalendarDay>; channel: { id: string; name: string; language: string; schedule: { longDay: number; time?: string; shortsPerDay?: number } | null; domains: Record<string, ChannelDomain> }; episodes: Overview[]; ideas: Idea[] };
export type PackageInfo = { files: { name: string; size: number; mtime: number }[]; youtube: string; checklist: string };
export type LongJob = { id: string; kind: string; episode?: string; title: string; status: "running" | "done" | "error"; pct: number; log: string[]; error?: string; startedAt: number };
export type KeyState = Record<string, { label: string; set: boolean; preview: string }>;
export type SfxItem = { id: string; nameAr: string; category: string; categoryAr: string; useAr: string; seconds: number; guard?: string; available: boolean };
export type RenderJob = { id: string; episode: string; orientation: string; chapter?: number; status: "running" | "done" | "error"; pct: number; output?: string; error?: string };

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

export const api = {
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
  episode: (id: string) => call<EpisodeData>(`/api/episodes/${id}`),
  saveScript: (id: string, text: string) => call<{ check: CheckResult; plan: Plan }>(`/api/episodes/${id}/script`, { method: "PUT", json: { text } }),
  savePlan: (id: string, plan: Plan) => call(`/api/episodes/${id}/plan`, { method: "PUT", json: { plan } }),
  regenerate: (id: string) => call<{ plan: Plan }>(`/api/episodes/${id}/plan/regenerate`, { method: "POST", json: {} }),
  check: (text: string) => call<CheckResult>("/api/check", { method: "POST", json: { text } }),
  identity: () => call<{ identity: Identity; defaults: Identity }>("/api/identity"),
  saveIdentity: (identity: Identity) => call("/api/identity", { method: "PUT", json: { identity } }),
  render: (b: { episode: string; orientation: string; chapter?: number }) => call<RenderJob>("/api/render", { method: "POST", json: b }),
  jobs: () => call<RenderJob[]>("/api/render"),
  voice: (id: string, b: { scenes?: string[]; dryRun?: boolean; force?: boolean }) => call<{ report: VoiceReport; generated: boolean; media: EpisodeMedia }>(`/api/episodes/${id}/voice`, { method: "POST", json: b }),
  quran: (id: string) => call<{ plan: Plan; result: { fetched: string[]; recited: string[]; failed: { ref: string; reason: string }[] } }>(`/api/episodes/${id}/quran`, { method: "POST", json: {} }),
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
  testService: (service: "elevenlabs" | "quran") => call<{ ok: boolean; message?: string; account?: { tier: string; character_count: number; character_limit: number }; voices?: { id: string; name: string; category: string }[]; voiceFound?: boolean; sample?: string; env?: string }>("/api/settings/test", { method: "POST", json: { service } }),
  sfx: () => call<SfxItem[]>("/api/sfx"),
  sfxUrl: (id: string) => withChannel(`/api/sfx/${id}.mp3`),
  startJob: (b: { kind: "make" | "package" | "sfx"; episode?: string; noVoice?: boolean }) => call<LongJob>("/api/jobs", { method: "POST", json: b }),
  longJobs: () => call<LongJob[]>("/api/jobs"),
  videoUrl: (episode: string, file: string) => withChannel(`/api/episodes/${episode}/video/${encodeURIComponent(file)}`),
};
