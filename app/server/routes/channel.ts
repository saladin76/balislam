import { writeFile } from "node:fs/promises";
import { ownerRefusal } from "../routeContext.ts";
import type { RouteCtx } from "../routeContext.ts";

/** ملف القناة وإنشاء قناة: للمالك وحده (ownerRefusal). */
export const handleChannelRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, ch, send, readBody, load } = ctx;

  // ملف القناة
  if (parts[0] === "channel") {
    const ch_ = await load("/src/channel/index.ts");
    if (req.method === "PUT") {
      const refused = await ownerRefusal(ctx);
      if (refused) return send(res, 403, { error: refused }), true;
      const { channel } = await readBody(req);
      const { langPacks } = await load("/src/i18n/packs.ts");
      const slots = ["paper", "family", "night", "warm"];
      if (!channel || channel.id !== ch) return send(res, 400, { error: "معرّف القناة لا يُغيَّر." }), true;
      if (!channel.name?.trim()) return send(res, 400, { error: "اسم القناة مطلوب." }), true;
      if (!langPacks[channel.language]) return send(res, 400, { error: "لغة غير معروفة." }), true;
      const ids = Object.keys(channel.domains ?? {});
      if (!ids.length) return send(res, 400, { error: "القناة تحتاج مجالًا واحدًا على الأقل." }), true;
      for (const id of ids) {
        if (!/^[a-z0-9-]+$/.test(id)) return send(res, 400, { error: `معرّف المجال «${id}» بالإنجليزية الصغيرة والشرطات فقط.` }), true;
        if (!slots.includes(channel.domains[id].theme)) return send(res, 400, { error: `ثيم المجال «${id}» غير صالح.` }), true;
      }
      // أدوات المحرك الافتراضية للحلقات الجديدة: لا يُقبل إلا أساس يعمل في مكتبة هذه القناة
      if (channel.production != null) {
        const { engineDefaultsIssues } = await load("/src/plan/engine.ts");
        const { templateExclusion } = await load("/src/channel/library.ts");
        const bad = engineDefaultsIssues(channel.production.defaults, (t: string) => !templateExclusion(channel, t), ch);
        if (bad.length) return send(res, 400, { error: bad.join(" ") }), true;
      }
      // Legacy provider selections are no longer Studio settings. Old on-disk
      // channel files remain untouched until their owner explicitly saves.
      const { recitation: _legacyRecitation, alquranPreviewRecitation: _legacyPreview,
        quranTranslation: _legacyTranslation, ...localChannel } = channel;
      await writeFile(ch_.channelPaths(ch).channelFile, JSON.stringify(localChannel, null, 2) + "\n");
      send(res, 200, { ok: true });
    } else send(res, 200, ch_.loadChannel(ch));
    return true;
  }
  if (parts[0] === "channels" && req.method === "POST") {
    const refused = await ownerRefusal(ctx);
    if (refused) return send(res, 403, { error: refused }), true;
    const b = await readBody(req);
    const { createChannel } = await load("/src/channel/create.ts");
    await createChannel({ id: b.id, name: b.name, language: b.language, nameLatin: b.nameLatin, quran: b.quran });
    send(res, 200, { ok: true });
    return true;
  }


  return false;
};
