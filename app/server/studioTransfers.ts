/**
 * Read-only local transfer overview for Studio.
 * This never fetches GitHub, uploads media, or changes review/approval records.
 */
import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";

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
export type StudioTransferOverview = {
  configured: boolean;
  deliveries: StudioDelivery[];
  bridgeDeliveredJobs: number;
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
    note: "الملفات الظاهرة رُفعت وتحققت بصمتها؛ حالة الاعتماد لا تُستنتج من الرفع. التحديث من ملفات Mac المحلية ولا يعني أن Claude سلّم تقرير التنفيذ.",
  };
};
