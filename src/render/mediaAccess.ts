/**
 * Vite's dev server serves publicDir directly and can expose /@fs paths from
 * its allowed root. Private render snapshots (including legacy snapshots left
 * in public/_render) must never be addressable by raw HTTP static URLs.
 * Episode media for the local Studio UI is served only through its /api route.
 */
export const isPrivateRenderAssetRequest = (rawUrl: string | undefined): boolean => {
  if (!rawUrl) return false;
  let pathname: string;
  try {
    pathname = new URL(rawUrl, "http://127.0.0.1").pathname;
  } catch {
    return true;
  }
  // Decode nested encoding rather than trusting a single percent-decode. The
  // proxy/Vite layers may decode again when resolving a requested pathname.
  for (let i = 0; i < 6 && pathname.includes("%"); i++) {
    try {
      const next = decodeURIComponent(pathname);
      if (next === pathname) break;
      pathname = next;
    } catch {
      return true;
    }
  }
  pathname = pathname.replaceAll("\\", "/");
  const segments = pathname.split("/").filter(Boolean);
  const reserved = new Set(["_render", "_storyboard_media", ".private-media"]);
  if (segments.some((segment) => reserved.has(segment.toLowerCase()))) return true;
  const isFilesystemPath = segments.some((s) => s === "@fs" || s === "@id");
  if (!isFilesystemPath) return false;
  // Never serve raw voice, Quran recitations or unpublished images via @fs.
  // The local authenticated/studio-aware API remains the intended entrypoint.
  for (let i = 0; i < segments.length; i++) {
    if (segments[i] === "channels" && i + 4 < segments.length &&
        segments[i + 2] === "episodes" &&
        ["voice", "recitations", "images", "out"].includes(segments[i + 4]!))
      return true;
    if (segments[i] === "assets" && segments[i + 1] === "recitations")
      return true;
  }
  return false;
};
