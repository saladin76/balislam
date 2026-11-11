/**
 * A link for every place in the Studio (funnel audit item 18): «#/<channel>/<episode>/<tab>» for an
 * episode step, «#/<channel>/<tab>» elsewhere. Opening the link (or refreshing) lands on the same
 * channel, episode and step. A link carries no secret (the
 * Studio has none: owner decision 9 Nov); owner actions are allowed only from this device.
 */
import { SECTION_TITLES, type StudioSection } from "../ui/StudioSidebar";

export type StudioRoute = { channel?: string; episode?: string; tab?: StudioSection; /** «#/<channel>/series/<id>»: a series page */ series?: string };

const EPISODE_STEPS: StudioSection[] = ["research", "script", "storyboard", "voice", "episode", "review", "publish"];
const CHANNEL = /^[a-z0-9][a-z0-9-]{0,40}$/;
const EPISODE = /^\d{3,4}$/;
const SERIES = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isTab = (t: string): t is StudioSection => Object.prototype.hasOwnProperty.call(SECTION_TITLES, t);

export const parseStudioHash = (hash: string): StudioRoute => {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch { return ""; }
  });
  if (!parts.length || !CHANNEL.test(parts[0]!)) return {};
  const out: StudioRoute = { channel: parts[0] };
  if (parts[1] === "series") return parts[2] && SERIES.test(parts[2]) ? { ...out, tab: "series", series: parts[2] } : out;
  if (parts.length >= 3 && EPISODE.test(parts[1]!) && isTab(parts[2]!) && EPISODE_STEPS.includes(parts[2]!))
    return { ...out, episode: parts[1], tab: parts[2] };
  if (parts.length >= 2 && EPISODE.test(parts[1]!)) return { ...out, episode: parts[1], tab: "script" };
  if (parts.length >= 2 && isTab(parts[1]!) && !EPISODE_STEPS.includes(parts[1]!)) return { ...out, tab: parts[1] };
  return out;
};

export const studioHash = (r: StudioRoute): string => {
  if (!r.channel || !CHANNEL.test(r.channel)) return "";
  if (r.tab && EPISODE_STEPS.includes(r.tab)) return r.episode && EPISODE.test(r.episode) ? `#/${r.channel}/${r.episode}/${r.tab}` : `#/${r.channel}`;
  if (r.tab === "series") return r.series && SERIES.test(r.series) ? `#/${r.channel}/series/${r.series}` : `#/${r.channel}`;
  return r.tab ? `#/${r.channel}/${r.tab}` : `#/${r.channel}`;
};
