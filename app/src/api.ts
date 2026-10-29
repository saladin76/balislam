import type { Plan } from "../../src/plan/types";
import type { Identity } from "../../brand/identity/index";
import type { EpisodeMedia } from "../../src/plan/media";
import type { PlanIssue } from "../../src/plan/validate";
import type { ChannelDomain, ChannelInfo } from "../../src/channel/types";

export type Issue = { level: "error" | "warning"; code: string; message: string; line?: number };
export type CheckResult = { ok: boolean; issues: Issue[]; stats: { chapters: { number: number; words: number; seconds: number }[]; totalWords: number; totalSeconds: number } };
export type EpisodeSummary = { id: string; dir: string; title: string; domain: string; hasPlan: boolean };
export type ChannelSummary = { id: string; name: string; language: string; domains: Record<string, ChannelDomain> };
export type EpisodeData = { channel: ChannelInfo; script: string; plan: Plan; check: CheckResult; media: EpisodeMedia; issues: PlanIssue[]; keys: { voice: boolean; quran: boolean } };
export type VoiceReport = { total: number; toGenerate: { id: string; chars: number }[]; cached: string[]; chars: number; credits: number };
export type RenderJob = { id: string; episode: string; orientation: string; chapter?: number; status: "running" | "done" | "error"; pct: number; output?: string; error?: string };

/** القناة المختارة في الاستوديو: تُضاف لكل طلب. */
let currentChannel = "";
export const setApiChannel = (id: string) => {
  currentChannel = id;
};
const withChannel = (url: string) => (currentChannel ? `${url}${url.includes("?") ? "&" : "?"}channel=${encodeURIComponent(currentChannel)}` : url);

const call = async <T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> => {
  const url = withChannel(path);
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
  quran: (id: string) => call<{ plan: Plan }>(`/api/episodes/${id}/quran`, { method: "POST", json: {} }),
  videoUrl: (episode: string, file: string) => withChannel(`/api/episodes/${episode}/video/${encodeURIComponent(file)}`),
};
