/**
 * A link for every place in the Studio (funnel audit item 18): «#/<channel>/<episode>/<tab>» for an
 * episode step, «#/<channel>/<tab>» elsewhere. Following the link during a session, or refreshing the page,
 * lands on the same channel, episode and step; a fresh open lands on «الرئيسية» (D85, `bootPlace`). A link carries no secret (the
 * Studio has none: owner decision 9 Nov); owner actions are allowed only from this device.
 */
import { SECTION_TITLES, type StudioSection } from "../ui/StudioSidebar";

export type StudioRoute = { channel?: string; episode?: string; tab?: StudioSection; /** «#/<channel>/series/<id>»: a series page */ series?: string;
  /** «#/<channel>/<episode>/episode/<scene id>»: the scene on screen in step ٢ (QA 12 Nov: a reload kept only the step). */
  scene?: string };

const EPISODE_STEPS: StudioSection[] = ["research", "script", "tashkeel", "storyboard", "voice", "episode", "review", "publish"];
const CHANNEL = /^[a-z0-9][a-z0-9-]{0,40}$/;
const EPISODE = /^\d{3,4}$/;
const SERIES = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SCENE = /^[a-z0-9]+(?:-[a-z0-9]+){0,4}$/;
const isTab = (t: string): t is StudioSection => Object.prototype.hasOwnProperty.call(SECTION_TITLES, t);

export const parseStudioHash = (hash: string): StudioRoute => {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return ""; }
  });
  if (!parts.length || !CHANNEL.test(parts[0]!)) return {};
  const out: StudioRoute = { channel: parts[0] };
  if (parts[1] === "series") return parts[2] && SERIES.test(parts[2]) ? { ...out, tab: "series", series: parts[2] } : out;
  if (parts.length >= 3 && EPISODE.test(parts[1]!) && isTab(parts[2]!) && EPISODE_STEPS.includes(parts[2]!))
    return { ...out, episode: parts[1], tab: parts[2], ...(parts[2] === "episode" && parts[3] && SCENE.test(parts[3]) ? { scene: parts[3] } : {}) };
  if (parts.length >= 2 && EPISODE.test(parts[1]!)) return { ...out, episode: parts[1], tab: "script" };
  if (parts.length >= 2 && isTab(parts[1]!) && !EPISODE_STEPS.includes(parts[1]!)) return { ...out, tab: parts[1] };
  return out;
};

export const studioHash = (r: StudioRoute): string => {
  if (!r.channel || !CHANNEL.test(r.channel)) return "";
  if (r.tab && EPISODE_STEPS.includes(r.tab)) return r.episode && EPISODE.test(r.episode)
    ? `#/${r.channel}/${r.episode}/${r.tab}${r.tab === "episode" && r.scene && SCENE.test(r.scene) ? `/${r.scene}` : ""}` : `#/${r.channel}`;
  if (r.tab === "series") return r.series && SERIES.test(r.series) ? `#/${r.channel}/series/${r.series}` : `#/${r.channel}`;
  return r.tab ? `#/${r.channel}/${r.tab}` : `#/${r.channel}`;
};

/**
 * Where the Studio lands when the page loads (owner decision 11 Nov, D85; replaces the boot half of audit item 18):
 * - a fresh open (new tab or window, `npm run app` again, a tab the browser restored, the address typed and
 *   autocompleted to an old link) lands on «الرئيسية»: of the channel the link names, else the last channel
 *   chosen (owner decision 18 Nov, D156: «رئيسية القناة اللي في الرابط»). The episode, the step and the scene in
 *   the old hash are still ignored, so the Studio never reopens deep inside an episode;
 * - a reload of the page while working (F5, Cmd+R, Cmd+Shift+R) keeps the place in the address bar, so no
 *   work is lost;
 * - a link opened with `?link` (`/?link#/balislam/001/episode`: scripts, a deliberate deep link) keeps its
 *   place too. A link pasted or clicked during a session is handled by the hashchange listener, not here.
 */
export type NavigationKind = "reload" | "open";
export type BootInput = {
  hash: string;
  search?: string;
  navigation: NavigationKind;
  stored: { channel?: string | null; episode?: string | null; tab?: string | null };
};
export const bootPlace = (b: BootInput): StudioRoute & { tab: StudioSection } => {
  const r = parseStudioHash(b.hash);
  const storedChannel = b.stored.channel && CHANNEL.test(b.stored.channel) ? b.stored.channel : undefined;
  const storedEpisode = b.stored.episode || undefined;
  const keep = b.navigation === "reload" || /(?:^\?|&)link(?:[=&]|$)/.test(b.search ?? "");
  // The remembered episode belongs to the remembered channel: a link to another channel opens its home without it
  if (!keep) return { channel: r.channel ?? storedChannel, episode: !r.channel || r.channel === storedChannel ? storedEpisode : undefined, tab: "home" };
  const storedTab = b.stored.tab && isTab(b.stored.tab) ? b.stored.tab : undefined;
  return { channel: r.channel ?? storedChannel, episode: r.episode ?? storedEpisode, tab: r.tab ?? storedTab ?? "home", ...(r.series ? { series: r.series } : {}), ...(r.scene ? { scene: r.scene } : {}) };
};

/** «reload» only when the browser says this load is a reload of the same page; anything else is a fresh open. */
export const navigationKind = (perf: Pick<Performance, "getEntriesByType"> & { navigation?: { type?: number } } | undefined =
  typeof performance === "undefined" ? undefined : performance): NavigationKind => {
  try {
    const e = perf?.getEntriesByType?.("navigation")?.[0] as PerformanceNavigationTiming | undefined;
    if (e?.type) return e.type === "reload" ? "reload" : "open";
    return perf?.navigation?.type === 1 ? "reload" : "open";
  } catch {
    return "open";
  }
};
