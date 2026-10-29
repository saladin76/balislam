import path from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import config from "../../config.json";
import { projectRoot } from "../config/paths";
import type { ChannelConfig } from "./types";

export * from "./types";

/** مجلد القنوات (يمكن تغييره في الاختبارات بـ BAL_CHANNELS_DIR). */
export const channelsDir = () => process.env.BAL_CHANNELS_DIR || path.join(projectRoot, "channels");

/** القناة الحالية: من --channel أو BAL_CHANNEL، وإلا الافتراضية في config.json. */
export const currentChannelId = () => process.env.BAL_CHANNEL || config.defaultChannel;

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
