import { loadChannel, type ChannelConfig } from "./index";

/**
 * A damaged channel must not take down listings of the other channels.
 * This is read-only: never replace corrupt JSON with generated defaults.
 */
export type ChannelInspection = {
  id: string;
  config: ChannelConfig | null;
  error: string | null;
};

export const inspectChannel = (id: string): ChannelInspection => {
  try {
    return { id, config: loadChannel(id), error: null };
  } catch (error) {
    return {
      id,
      config: null,
      error: error instanceof Error ? error.message : "تعذّر قراءة إعدادات القناة.",
    };
  }
};
