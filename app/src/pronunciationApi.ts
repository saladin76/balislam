import { useEffect, useState } from "react";
import { apiCall } from "./api";
import type { EpisodeView } from "../../src/voice/pronunciation/service";
import type { InstallJob, Measurement } from "../../src/voice/pronunciation/whisperTool";

/** فحص النطق (العمل ٩): عميل الواجهة. */
export type PronunciationStatus = {
  installed: boolean; enabled: boolean; acceptedRate: number | null; measurement: Measurement | null;
  install: InstallJob | null;
  measure: { status: "running" | "done" | "error"; done: number; total: number; label: string; error?: string } | null;
  python: boolean; sizes: { packagesMb: number; modelMb: number }; requiredFreeMb: number; freeMb: number | null;
  model: string; version: string;
};
export type { EpisodeView };

export const pronunciationApi = {
  status: () => apiCall<PronunciationStatus>("/api/pronunciation-check"),
  act: (action: "install" | "measure" | "enable" | "disable" | "uninstall", extra: Record<string, unknown> = {}) =>
    apiCall<PronunciationStatus>("/api/pronunciation-check", { method: "POST", json: { action, ...extra } }),
  episode: (episode: string, channel: string) => apiCall<EpisodeView>(`/api/episodes/${episode}/pronunciation-check`, undefined, channel),
};

/**
 * The episode's warnings, refreshed when the sentences change (`stamp`) and every few seconds while sentences wait
 * for their check. «off» / «not-installed» → no warning and no error, ever.
 */
export const usePronunciationCheck = (episode: string, channel: string, stamp: unknown): EpisodeView | null => {
  const [view, setView] = useState<EpisodeView | null>(null);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      pronunciationApi.episode(episode, channel)
        .then((v) => {
          if (!live) return;
          setView(v);
          if (v.state === "on" && (v.pending > 0 || v.checking)) timer = setTimeout(tick, 4000);
        })
        .catch(() => { /* optional: a failed check never shows an error under the sentences */ });
    };
    tick();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [episode, channel, stamp]);
  return view;
};
