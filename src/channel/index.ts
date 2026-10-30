import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import config from "../../config.json";
import { projectRoot } from "../config/paths";
import type { ChannelConfig } from "./types";

export * from "./types";

/** مجلد القنوات (يمكن تغييره في الاختبارات بـ BAL_CHANNELS_DIR). */
export const channelsDir = () => process.env.BAL_CHANNELS_DIR || path.join(projectRoot, "channels");

const channelScope = new AsyncLocalStorage<string>();

/**
 * يشغّل fn وكل ما يتفرع عنه (حتى بعد await) على قناة محددة، دون متغير عام مشترك.
 * يستخدمه الاستوديو لكل طلب حتى لا تتداخل طلبات قناتين.
 */
export const runWithChannel = <T>(id: string, fn: () => T): T => channelScope.run(id, fn);

/** القناة الحالية: نطاق الطلب، ثم --channel أو BAL_CHANNEL، وإلا الافتراضية في config.json. */
export const currentChannelId = () => channelScope.getStore() || process.env.BAL_CHANNEL || config.defaultChannel;

export const channelPaths = (id = currentChannelId()) => {
  const dir = path.join(channelsDir(), id);
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
    ? readdirSync(channelsDir())
        .filter((d) => existsSync(path.join(channelsDir(), d, "channel.json")))
        .sort()
    : [];

export const loadChannel = (id = currentChannelId()): ChannelConfig => {
  const p = channelPaths(id);
  if (!existsSync(p.channelFile)) throw new Error(`القناة «${id}» غير موجودة. القنوات المتاحة: ${listChannels().join("، ") || "لا شيء"}.`);
  return JSON.parse(readFileSync(p.channelFile, "utf8")) as ChannelConfig;
};

/** هوية القناة الحالية كما هي محفوظة (للرندر). */
export const loadChannelIdentity = (id = currentChannelId()) => JSON.parse(readFileSync(channelPaths(id).identity, "utf8"));
