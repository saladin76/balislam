import path from "node:path";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { safeName } from "../util.ts";
import { ownerRefusal } from "../routeContext.ts";
import type { RouteCtx } from "../routeContext.ts";

/** عيّنات الصوت (حارس القرآن قبل العميل)، والمفاتيح واختبار الاتصال، والمؤثرات الصوتية. */
export const handleVoiceRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, ch, send, readBody, load } = ctx;

  // تجربة سماع طبقة القناة والنبرات: عيّنات قصيرة تُحفظ في renders/voice-samples/<القناة> فلا يُصرف رصيد مرتين للعيّنة نفسها
  if (parts[0] === "voice-sample") {
    const dir = path.join(ctx.root, "renders", "voice-samples", ch);
    if (parts[1] === "file" && parts[2] && req.method === "GET") {
      const f = path.join(dir, safeName(parts[2]));
      if (!existsSync(f)) return send(res, 404, { error: "العيّنة غير موجودة." }), true;
      ctx.serveFile(req, res, f, "audio/mpeg");
      return true;
    }
    const { elevenLabsFromEnv } = await load("/src/voice/elevenlabs.ts");
    const { runWithChannel } = await load("/src/channel/index.ts");
    const el = runWithChannel(ch, () => elevenLabsFromEnv());
    if (!el) return send(res, 400, { error: "أضف مفتاح ElevenLabs واختر صوتك من تبويب «الإعدادات»." }), true;
    if (parts[1] === "models" && req.method === "GET") {
      send(res, 200, { models: await el.models(), current: el.modelId });
      return true;
    }
    if (!parts[1] && req.method === "POST") {
      // Spends voice credit: the owner only (also enforced for every write by the API middleware).
      const refused = await ownerRefusal(ctx);
      if (refused) return send(res, 403, { error: "عيّنة الصوت تُولَّد من الاستوديو على جهاز المالك فقط." }), true;
      const b = await readBody(req);
      const text = String(b.text ?? "").trim();
      if (!text) return send(res, 400, { error: "اكتب نص العيّنة." }), true;
      if (text.length > 400) return send(res, 400, { error: "العيّنة أطول من 400 حرف؛ يكفي سطران لضبط الصوت." }), true;
      // The cloned voice never recites Quran: the one shared guard (src/voice/quranGuard.ts), also inside the client.
      const { assertNoQuranForTts } = await load("/src/voice/quranGuard.ts");
      try { assertNoQuranForTts(text, null, { source: "عيّنة الصوت" }); }
      catch (e) { return send(res, 400, { error: (e as Error).message, code: "QURAN_TTS" }), true; }
      const { voiceSettingsFor, isTone } = await load("/src/voice/tones.ts");
      const model = String(b.model || el.modelId);
      // D136: the tone's delivery on the model the sample is made with (a v4 tone carries its performance direction)
      const tune = voiceSettingsFor(undefined, isTone(b.tone) ? b.tone : undefined, model);
      const { createHash } = await import("node:crypto");
      const name = `${createHash("sha1").update(JSON.stringify({ text, tune, model, v: process.env.ELEVENLABS_VOICE_ID })).digest("hex").slice(0, 16)}.mp3`;
      const file = path.join(dir, name);
      const cached = existsSync(file);
      if (!cached) {
        const { capsFor } = await load("/src/voice/models.ts");
        const { applyTempo } = await load("/src/voice/tempo.ts");
        const cfg = (await load("/config.json")).default;
        const speed = capsFor(model).speed === "post" ? (tune?.speed ?? cfg.voice.speed) : 1;
        const audio = await applyTempo(await el.sample(text, { tune, modelId: model }), speed);
        const { mkdir } = await import("node:fs/promises");
        await mkdir(dir, { recursive: true });
        await writeFile(file, audio);
      }
      send(res, 200, { file: name, cached, chars: cached ? 0 : text.length, tune, model });
      return true;
    }
  }

  // المفاتيح: الحالة، الحفظ في .env، اختبار الاتصال
  if (parts[0] === "settings") {
    const env = await load("/src/settings/env.ts");
    if (parts[1] === "test" && req.method === "POST") {
      const { service } = await readBody(req);
      try {
        if (service === "elevenlabs") {
          const key = process.env.ELEVENLABS_API_KEY;
          if (!key) return send(res, 200, { ok: false, message: "لم يُضف مفتاح ElevenLabs بعد." }), true;
          const { createElevenLabs } = await load("/src/voice/elevenlabs.ts");
          const el = createElevenLabs({ apiKey: key, voiceId: process.env.ELEVENLABS_VOICE_ID ?? "" });
          const acc = await el.account();
          const voices = await el.voices();
          const voiceFound = voices.some((v: any) => v.id === process.env.ELEVENLABS_VOICE_ID);
          // النماذج المتاحة ودعمها للعربية، وحالة تدريب صوتك الاحترافي على كل نموذج
          const models = await el.models().catch(() => []);
          const info = voiceFound ? await el.voiceInfo().catch(() => null) : null;
          const cfg = (await load("/config.json")).default;
          send(res, 200, { ok: true, account: acc, voices, voiceFound, models, training: info?.training ?? {}, voiceCategory: info?.category, model: process.env.ELEVENLABS_MODEL_ID || cfg.voice.modelId });
        } else send(res, 400, { error: "خدمة غير معروفة" });
      } catch (e) {
        send(res, 200, { ok: false, message: (e as Error).message });
      }
      return true;
    }
    if (req.method === "PUT") {
      const { updates } = await readBody(req);
      await env.writeKeys(updates ?? {});
      send(res, 200, { keys: env.keyStatus() });
      return true;
    }
    send(res, 200, { keys: env.keyStatus() });
    return true;
  }

  // المؤثرات الصوتية
  if (parts[0] === "sfx") {
    if (parts[1]) {
      const file = path.join(ctx.root, "assets", "sfx", safeName(parts[1]));
      if (!existsSync(file)) return send(res, 404, { error: "غير موجود" }), true;
      ctx.serveFile(req, res, file, "audio/mpeg");
      return true;
    }
    const { sfxLibrary, sfxCategoryNamesAr } = await load("/brand/sfx.ts");
    send(res, 200, sfxLibrary.map((s: any) => ({ ...s, categoryAr: sfxCategoryNamesAr[s.category], available: existsSync(path.join(ctx.root, "assets", "sfx", `${s.id}.mp3`)) })));
    return true;
  }


  return false;
};
