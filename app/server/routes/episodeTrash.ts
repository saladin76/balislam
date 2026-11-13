import path from "node:path";
import { execFile } from "node:child_process";
import { childEnv } from "../../../scripts/git-env.mjs";
import { prepareRunning } from "../prepare.ts";
import { busy, busyRefusal } from "../jobQueue.ts";
import { EP } from "../routeContext.ts";
import type { RouteCtx } from "../routeContext.ts";

/** «حذف الحلقة» إلى سلة محلية قابلة للاسترجاع، و«تراجع» (src/studio/episodeTrash.ts). */
export const handleEpisodeTrashRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, ch, send, readBody, load } = ctx;

  // «حذف الحلقة» (QA balislam 7, 12 Nov): local and reversible. The episode folder is MOVED into the local trash
  // (~/balislam-backup/trash/<channel>/, src/studio/episodeTrash.ts) with everything in it, paid takes included.
  // Nothing is committed, pulled or pushed from here, and ~/balislam-archive is never touched. «تراجع» moves it back.
  // The episode's path under the folder that holds channels/ (the repository, or BAL_CHANNELS_DIR's parent).
  const episodeDirOf = async (id: string) => {
    const { resolveScriptPath } = await load("/src/script/episodes.ts");
    const { channelsDir } = await load("/src/channel/index.ts");
    const dir = path.dirname(await resolveScriptPath(id));
    const base = path.dirname(channelsDir());
    const rel = path.relative(base, dir).split(path.sep).join("/");
    if (!/^channels\/[^/]+\/episodes\/\d{3}-[^/]+$/.test(rel)) throw Object.assign(new Error("مسار الحلقة غير متوقع؛ لم يُنقل شيء."), { status: 400 });
    return { dir, rel, base };
  };
  const trackedIn = (dir: string) => new Promise<string[]>((resolve) => execFile("git", ["ls-files", "-z", "--", path.relative(ctx.root, dir)],
    { cwd: ctx.root, timeout: 30_000, env: childEnv({ GIT_TERMINAL_PROMPT: "0" }) },
    (err, so) => resolve(err ? [] : String(so).split("\0").filter(Boolean))));
  if (parts[0] === "episodes" && parts[1] && parts[2] === "trash-preview" && !parts[3] && req.method === "GET") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const T = await load("/src/studio/episodeTrash.ts");
    const { dir, rel } = await episodeDirOf(parts[1]);
    return send(res, 200, { dir: rel, trash: T.trashRoot(), contents: await T.episodeContents(dir, await trackedIn(dir)) }), true;
  }
  if (parts[0] === "episodes" && parts[1] && !parts[2] && req.method === "DELETE") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { assertSceneOwner } = await load("/src/studio/sceneService.ts");
    try { assertSceneOwner(); } catch { return send(res, 403, { error: "حذف حلقة مسموح من الاستوديو على جهاز المالك فقط." }), true; }
    if (busy.has(`${ch}/${parts[1]}`) || prepareRunning(`${ch}/${parts[1]}`)) return send(res, 409, { error: busyRefusal(`${ch}/${parts[1]}`) }), true;
    const { confirm } = await readBody(req);
    if (confirm !== parts[1]) return send(res, 400, { error: "اكتب رقم الحلقة للتأكيد." }), true;
    const T = await load("/src/studio/episodeTrash.ts");
    const { dir, rel, base } = await episodeDirOf(parts[1]);
    const { loadPlan } = await load("/src/plan/io.ts");
    const title = await loadPlan(parts[1]).then((p: { title?: string } | null) => p?.title, () => undefined);
    const tracked = await trackedIn(dir);
    busy.add(`${ch}/${parts[1]}`);
    try {
      const entry = await T.trashEpisode(base, rel, { channel: ch, title, trackedFiles: tracked });
      return send(res, 200, { ok: true, dir: rel, trash: T.trashRoot(), entry, tracked: tracked.length }), true;
    } finally { busy.delete(`${ch}/${parts[1]}`); }
  }
  if (parts[0] === "trash" && !parts[1] && req.method === "GET") {
    const T = await load("/src/studio/episodeTrash.ts");
    return send(res, 200, { trash: T.trashRoot(), items: await T.listTrash(ch) }), true;
  }
  if (parts[0] === "trash" && parts[1] === "restore" && !parts[2] && req.method === "POST") {
    const { assertSceneOwner } = await load("/src/studio/sceneService.ts");
    try { assertSceneOwner(); } catch { return send(res, 403, { error: "الاسترجاع مسموح من الاستوديو على جهاز المالك فقط." }), true; }
    const { id } = await readBody(req);
    const T = await load("/src/studio/episodeTrash.ts");
    const { channelsDir } = await load("/src/channel/index.ts");
    try { return send(res, 200, { ok: true, entry: await T.restoreEpisode(path.dirname(channelsDir()), ch, String(id ?? "")) }), true; }
    catch (error) { return send(res, 409, { error: (error as Error).message }), true; }
  }


  return false;
};
