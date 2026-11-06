/**
 * Read-only local transfer overview for Studio.
 * This never fetches GitHub, uploads media, or changes review/approval records.
 */
import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const CHANNELS: Record<string, string> = {
  bilislam: "balislam",
  "dafatir-alzaman": "dafatir-alzaman",
  "zubdat-al-kutub": "zubdat-alkutub",
};
const SAFE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$/;
const MD5 = /^[0-9a-f]{32}$/;
const HTTPS_DRIVE = /^https:\/\/(?:drive|docs)\.google\.com\//;
const MAX_INDEX = 2 * 1024 * 1024;
const BASE = () => path.join(os.homedir(), "Balislam-Preview-Sync");
const exec = promisify(execFile);
const REPO = path.resolve(import.meta.dirname, "..", "..");

export type StudioDelivery = {
  id: string;
  channel: string;
  episode: string;
  kind: "video" | "storyboard";
  slot: string;
  url: string;
  md5: string;
  updated: string;
  status: "delivered_pending_review";
};
export type StudioPendingJob = { id: string; channel: string; episode: string; slot: string; kind: "video" | "storyboard"; state: "waiting_for_mac" | "delivered" };
export type StudioTransferOverview = {
  configured: boolean;
  deliveries: StudioDelivery[];
  bridgeDeliveredJobs: number;
  pendingJobs: StudioPendingJob[];
  note: string;
};

const readJson = async (file: string): Promise<unknown | null> => {
  try {
    const raw = await readFile(file, "utf8");
    if (Buffer.byteLength(raw, "utf8") > MAX_INDEX) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** Ignore malformed, cross-channel and untrusted URLs in the local manifest. */
export const parseStudioDeliveries = (input: unknown): StudioDelivery[] => {
  if (!input || Array.isArray(input) || typeof input !== "object") return [];
  const entries = Object.entries(input).slice(0, 1500);
  const result: StudioDelivery[] = [];
  for (const [key, value] of entries) {
    if (!value || Array.isArray(value) || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    const tokens = key.split("|");
    const storyboard = tokens.length === 5 && tokens[2] === "storyboard";
    if (tokens.length !== (storyboard ? 5 : 4)) continue;
    const [cloudChannel, episode] = tokens;
    const slot = storyboard ? tokens[3] : tokens[2];
    const ext = storyboard ? tokens[4] : tokens[3];
    if (!cloudChannel || !(cloudChannel in CHANNELS) || !episode || !slot || !ext) continue;
    if (![episode, slot, ext].every((x) => SAFE.test(x))) continue;
    if (!storyboard && ext !== "mp4" && ext !== "webm") continue;
    if (storyboard && !["json", "md", "pdf", "png", "jpg", "jpeg", "webp"].includes(ext)) continue;
    if (typeof v.url !== "string" || !HTTPS_DRIVE.test(v.url) ||
        typeof v.md5 !== "string" || !MD5.test(v.md5) ||
        typeof v.updated !== "string" || !Number.isFinite(Date.parse(v.updated))) continue;
    result.push({
      id: key, channel: CHANNELS[cloudChannel]!, episode,
      kind: storyboard ? "storyboard" : "video", slot, url: v.url, md5: v.md5,
      updated: v.updated, status: "delivered_pending_review",
    });
  }
  return result.sort((a, b) => b.updated.localeCompare(a.updated));
};

const readQueuedJobs = async (delivered: unknown): Promise<StudioPendingJob[]> => {
  try {
    // Cached remote-tracking branch only. Never trigger network access from a Studio page.
    const { stdout } = await exec("git", [
      "-C", REPO, "show", "refs/remotes/origin/studio-handoff-queue:studio-handoff/queue.json",
    ], { maxBuffer: 256 * 1024 });
    const parsed: unknown = JSON.parse(stdout);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return [];
    const body = parsed as Record<string, unknown>;
    if (body.version !== 1 || !Array.isArray(body.jobs)) return [];
    const done = delivered && typeof delivered === "object" && !Array.isArray(delivered)
      ? delivered as Record<string, unknown> : {};
    return body.jobs.slice(0, 20).flatMap((raw: unknown) => {
      if (!raw || Array.isArray(raw) || typeof raw !== "object") return [];
      const v = raw as Record<string, unknown>;
      if (![v.id, v.channel, v.episode, v.slot].every((x) => typeof x === "string" && SAFE.test(x))) return [];
      if (v.kind !== "video" && v.kind !== "storyboard") return [];
      if (!["balislam", "dafatir-alzaman", "zubdat-alkutub"].includes(v.channel as string)) return [];
      return [{ id: v.id as string, channel: v.channel as string, episode: v.episode as string,
        slot: v.slot as string, kind: v.kind, state: typeof done[v.id as string] === "string" ? "delivered" as const : "waiting_for_mac" as const }];
    });
  } catch {
    return [];
  }
};

export const readStudioTransferOverview = async (): Promise<StudioTransferOverview> => {
  const base = BASE();
  const manifest = await readJson(path.join(base, "preview-cloud-index.json"));
  const state = await readJson(path.join(base, "bridge-delivered.json"));
  const bridgeDeliveredJobs = state && typeof state === "object" && !Array.isArray(state)
    ? Object.keys(state).length : 0;
  return {
    configured: manifest !== null,
    deliveries: parseStudioDeliveries(manifest),
    bridgeDeliveredJobs,
    pendingJobs: await readQueuedJobs(state),
    note: "الملفات الظاهرة رُفعت وتحققت بصمتها؛ حالة الاعتماد لا تُستنتج من الرفع. التحديث من ملفات Mac المحلية ولا يعني أن Claude سلّم تقرير التنفيذ.",
  };
};
