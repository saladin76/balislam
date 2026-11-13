import { randomUUID } from "node:crypto";
import { captureRouteError } from "../errors.ts";
import { ownerRefusal } from "../routeContext.ts";
import type { RouteCtx } from "../routeContext.ts";

/** «تراجع» بعد نقل حلقات (D77): لقطات ما قبل النقل على الخادم وحده، برمز يُستعمل مرة واحدة خلال المهلة */
export const MOVE_UNDO_MS = 15 * 60_000;
export const moveUndo = new Map<string, { ch: string; snaps: any[]; at: number }>();

/** السلاسل والتصنيفات (D71)، ونقل الحلقات و«تراجع» (D77). */
export const handleSeriesRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, ch, send, readBody, load } = ctx;

  // السلاسل والتصنيفات داخل القناة (src/channel/series.ts و seriesStore.ts)
  if (parts[0] === "series") {
    const store = await load("/src/channel/seriesStore.ts");
    const model = await load("/src/channel/series.ts");
    const { approvedIdentity } = await load("/brand/identity/approved.ts");
    const fail = (e: unknown) => {
      const issues = (e as { issues?: string[] }).issues;
      // D112: an unexpected error (not the owner's invalid input) is logged in .studio/errors.jsonl
      send(res, issues ? 400 : 500, { error: (e as Error).message, issues, ...(issues ? {} : { errorId: captureRouteError(ctx.root, req, e, ch).id }) });
      return true;
    };
    if (!parts[1] && req.method === "GET") {
      const approved = approvedIdentity(ch);
      const list = store.listSeries(ch);
      const eps = await store.episodesBySeries(ch);
      const ctx = store.seriesContext(ch);
      send(res, 200, {
        series: list.map((x: any) => ({ ...x, derived: approved ? model.deriveSeriesIdentity(ch, x.identity ?? {}) : null, episodes: eps.filter((e: any) => e.series === x.id).length })),
        episodes: eps,
        rules: approved ? {
          accents: model.accentChoices(approved).map((hex: string) => ({ hex, nameAr: approved.palette.find((p: any) => p.hex.toUpperCase() === hex)?.nameAr ?? hex })),
          motifs: approved.motifs.map((id: string) => ({ id, nameAr: model.MOTIF_AR[id] ?? id })),
          emblemParts: model.EMBLEM_PARTS[approved.emblem]?.parts ?? [],
          fonts: approved.fonts, limits: model.LIMITS, maxDepth: model.MAX_DEPTH,
          styles: ctx.styles, templates: ctx.templates, tones: ctx.tones, defaultTone: model.DEFAULT_SERIES_TONE,
        } : null,
      });
      return true;
    }
    // نقل عدة حلقات معًا (D77): كل حلقة بنقل الحلقة الواحدة نفسه، ذرّية وحدها، ونتيجة لكل حلقة؛ و«تراجع» برمز النقل
    if (parts[1] === "move-episodes" && req.method === "POST" && (!parts[2] || parts[2] === "undo")) {
      const refused = await ownerRefusal(ctx);
      if (refused) return send(res, 403, { error: refused }), true;
      try {
        const body = await readBody(req);
        for (const [k, v] of moveUndo) if (Date.now() - v.at > MOVE_UNDO_MS) moveUndo.delete(k);
        if (parts[2] === "undo") {
          const entry = moveUndo.get(String(body?.token ?? ""));
          if (!entry || entry.ch !== ch) return send(res, 410, { error: "انتهت مهلة التراجع عن هذا النقل." }), true;
          moveUndo.delete(String(body.token));
          const results = await store.undoEpisodeMoves(ch, entry.snaps);
          send(res, 200, { ok: results.every((r: { ok: boolean }) => r.ok), results });
          return true;
        }
        const to = String(body?.to ?? "");
        const list: unknown = body?.episodes;
        if (!model.SLUG_RE.test(to)) return send(res, 400, { error: "معرّف السلسلة غير صالح." }), true;
        if (!Array.isArray(list) || !list.length || list.length > 300 || !list.every((x) => /^\d{3}$/.test(String(x)))) return send(res, 400, { error: "أرقام الحلقات غير صالحة." }), true;
        const { resolveEpisodeDir } = await load("/src/script/episodes.ts");
        const found: { episode: string; dir: string }[] = [];
        const missing: { episode: string; ok: false; error: string }[] = [];
        for (const episode of [...new Set(list.map(String))]) {
          try { found.push({ episode, dir: await resolveEpisodeDir(episode) }); }
          catch (e) { missing.push({ episode, ok: false, error: (e as Error).message }); }
        }
        const { results, undo } = await store.moveEpisodesTo(ch, found, to);
        const all = [...results, ...missing];
        const token = undo.length ? randomUUID() : null;
        if (token) moveUndo.set(token, { ch, snaps: undo, at: Date.now() });
        const target = store.getSeries(ch, to);
        send(res, 200, { ok: all.every((r: { ok: boolean }) => r.ok), results: all, undo: token, to: { id: to, name: target?.name ?? to, kind: target?.kind } });
        return true;
      } catch (e) { return fail(e); }
    }
    const id = parts[1] ?? "";
    if (!model.SLUG_RE.test(id)) return send(res, 400, { error: "معرّف السلسلة غير صالح." }), true;
    const refused = await ownerRefusal(ctx);
    if (refused) return send(res, 403, { error: refused }), true;
    try {
      if (!parts[2] && req.method === "PUT") {
        const { series } = await readBody(req);
        if (!series || series.id !== id) return send(res, 400, { error: "معرّف السلسلة لا يُغيَّر؛ أنشئ سلسلة جديدة وانقل حلقاتها." }), true;
        const saved = await store.saveSeries(ch, series);
        send(res, 200, { ok: true, series: saved, derived: model.deriveSeriesIdentity(ch, saved.identity ?? {}) });
        return true;
      }
      if (!parts[2] && req.method === "DELETE") {
        await store.deleteSeries(ch, id);
        send(res, 200, { ok: true });
        return true;
      }
      if (parts[2] === "episodes" && req.method === "POST") {
        const { episode } = await readBody(req);
        if (!/^\d{3}$/.test(String(episode ?? ""))) return send(res, 400, { error: "رقم الحلقة غير صالح." }), true;
        const { resolveEpisodeDir } = await load("/src/script/episodes.ts");
        const link = await store.moveEpisode(ch, await resolveEpisodeDir(episode), id);
        send(res, 200, { ok: true, link });
        return true;
      }
    } catch (e) { return fail(e); }
    send(res, 405, { error: "طلب غير معروف." });
    return true;
  }


  return false;
};
