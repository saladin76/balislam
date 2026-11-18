import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

/**
 * A long filter graph is read from a file. FFmpeg 7 deprecated `-filter_complex_script` for `-/filter_complex <file>`,
 * and FFmpeg 8 removed it: on the owner's Mac (Homebrew FFmpeg 8) every assembly and pre-final preview failed with
 * «Unrecognized option 'filter_complex_script'» (18 Nov), while CI (Ubuntu FFmpeg 6) knows only the old form.
 * Neither form works on both, so the version decides, and an «Unrecognized option» retries once with the other.
 */
export type FilterScriptForm = "old" | "new";

/** The major version from `ffmpeg -version` («ffmpeg version 6.1.1-3ubuntu5», «ffmpeg version n9.0.2-…», «8.0»); null if unknown. */
export const ffmpegMajor = (versionText: string): number | null => {
  const m = /ffmpeg version n?(\d+)\./i.exec(versionText);
  return m ? Number(m[1]) : null;
};

/** The form for a version: old before 7, new from 7 on (and for an unknown build, which is usually a recent one). */
export const filterScriptForm = (major: number | null): FilterScriptForm => (major !== null && major < 7 ? "old" : "new");

export const filterScriptArgs = (file: string, form: FilterScriptForm): string[] =>
  form === "old" ? ["-filter_complex_script", file] : ["-/filter_complex", file];

/** The other form, for the one retry. */
export const otherForm = (form: FilterScriptForm): FilterScriptForm => (form === "old" ? "new" : "old");

/** True when FFmpeg refused the option itself (not the graph or a file). */
export const refusedOption = (error: unknown) =>
  /Unrecognized option '(?:filter_complex_script|\/filter_complex)'/.test(String((error as { stderr?: string })?.stderr ?? (error as Error)?.message ?? error));

let cached: Promise<FilterScriptForm> | null = null;
/** The form for the FFmpeg on this machine, asked once per process. */
export const localFilterScriptForm = (bin = "ffmpeg"): Promise<FilterScriptForm> =>
  (cached ??= exec(bin, ["-hide_banner", "-version"], { timeout: 15_000 })
    .then((r) => filterScriptForm(ffmpegMajor(r.stdout)), () => "new" as const));

/** Forget the asked form (tests, or after the owner updates FFmpeg while the Studio runs). */
export const resetFilterScriptForm = () => { cached = null; };
