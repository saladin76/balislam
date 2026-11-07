import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import config from "../../config.json";
import { projectRoot } from "../config/paths";
import type { ChannelConfig } from "./types";

export * from "./types";

/** مجلد القنوات (يمكن تغييره في الاختبارات بـ BAL_CHANNELS_DIR). */
export const channelsDir = () => process.env.BAL_CHANNELS_DIR || path.join(projectRoot, "channels");

const channelScope = new AsyncLocalStorage<string>();

/** Never allow a channel selector to become a filesystem path. */
export const isChannelId = (id: unknown): id is string =>
  typeof id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);

function assertChannelId(id: unknown): asserts id is string {
  if (!isChannelId(id)) throw new Error("معرّف القناة غير صالح.");
}

const assertLocalEntry = (file: string) => {
  // lstat (not existsSync) also detects dangling symlinks.
  try {
    if (lstatSync(file).isSymbolicLink())
      throw new Error("مسار القناة يشير إلى رابط رمزي خارج عزلها.");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
};

const record = (x: unknown): x is Record<string, unknown> =>
  Boolean(x) && typeof x === "object" && !Array.isArray(x);

/** Validate the minimal runtime contract, keeping optional historical fields intact. */
export function assertChannelConfig(value: unknown, expectedId: string): asserts value is ChannelConfig {
  if (!record(value) || value.id !== expectedId ||
      typeof value.name !== "string" || !value.name.trim() ||
      typeof value.language !== "string" ||
      !["paper", "family", "night", "warm"].includes(String(value.masterTheme)) ||
      !record(value.domains) || !Object.keys(value.domains).length ||
      !record(value.rules) || typeof value.rules.faces !== "boolean" ||
      typeof value.rules.music !== "boolean" || typeof value.rules.quran !== "boolean" ||
      typeof value.rules.hadith !== "boolean" || !Array.isArray(value.rules.hadithGrades) ||
      !record(value.youtube) || !Array.isArray(value.youtube.tags)) {
    throw new Error(`ملف القناة «${expectedId}» غير صالح أو لا يطابق مجلدها؛ لم تُغيّر البيانات.`);
  }
  for (const [id, domain] of Object.entries(value.domains)) {
    if (!isChannelId(id) || !record(domain) || typeof domain.name !== "string" ||
        !["paper", "family", "night", "warm"].includes(String(domain.theme)) || !Array.isArray(domain.tags)) {
      throw new Error(`إعدادات مجال القناة «${expectedId}/${id}» غير صالحة.`);
    }
  }
}

/**
 * يشغّل fn وكل ما يتفرع عنه (حتى بعد await) على قناة محددة، دون متغير عام مشترك.
 * يستخدمه الاستوديو لكل طلب حتى لا تتداخل طلبات قناتين.
 */
export const runWithChannel = <T>(id: string, fn: () => T): T => {
  assertChannelId(id);
  return channelScope.run(id, fn);
};

/** القناة الحالية: نطاق الطلب، ثم --channel أو BAL_CHANNEL، وإلا الافتراضية في config.json. */
export const currentChannelId = () => channelScope.getStore() || process.env.BAL_CHANNEL || config.defaultChannel;

export const channelPaths = (id = currentChannelId()) => {
  assertChannelId(id);
  const dir = path.join(channelsDir(), id);
  // A symlinked channel/episodes directory can alias another channel or escape
  // the channels root even though the identifier itself is safe.
  assertLocalEntry(dir);
  for (const local of [
    "episodes", "images", "channel.json", "identity.json", "identity.default.json",
    "pronunciation.json", "calendar.json", "ideas.json",
  ]) assertLocalEntry(path.join(dir, local));
  return {
    dir,
    channelFile: path.join(dir, "channel.json"),
    identity: path.join(dir, "identity.json"),
    identityDefault: path.join(dir, "identity.default.json"),
    pronunciation: path.join(dir, "pronunciation.json"),
    episodes: path.join(dir, "episodes"),
  };
};

export const listChannels = (): string[] =>
  existsSync(channelsDir())
    ? readdirSync(channelsDir(), { withFileTypes: true })
        .filter((d) => d.isDirectory() && isChannelId(d.name) &&
          existsSync(path.join(channelsDir(), d.name, "channel.json")) &&
          !lstatSync(path.join(channelsDir(), d.name, "channel.json")).isSymbolicLink())
        .map((d) => d.name)
        .sort()
    : [];

export const loadChannel = (id = currentChannelId()): ChannelConfig => {
  const p = channelPaths(id);
  if (!existsSync(p.channelFile)) throw new Error(`القناة «${id}» غير موجودة. القنوات المتاحة: ${listChannels().join("، ") || "لا شيء"}.`);
  assertLocalEntry(p.channelFile);
  let result: unknown;
  try {
    result = JSON.parse(readFileSync(p.channelFile, "utf8"));
  } catch {
    throw new Error(`ملف القناة «${id}» تالف أو غير قابل للقراءة؛ يلزم إصلاحه من نسخة موثّقة.`);
  }
  assertChannelConfig(result, id);
  return result;
};

/** هوية القناة الحالية كما هي محفوظة (للرندر). */
export const loadChannelIdentity = (id = currentChannelId()) => {
  const file = channelPaths(id).identity;
  assertLocalEntry(file);
  return JSON.parse(readFileSync(file, "utf8"));
};
