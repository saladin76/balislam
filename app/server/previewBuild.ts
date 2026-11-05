import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type Plugin } from "vite";
import { balApi } from "./api.ts";
import { previewKey, type PreviewSnapshot } from "../src/preview.ts";

/** Explicit read-only export. Never requests settings, update, jobs, voice or external services. */
export const studioPreviewBuild = (root: string): Plugin => ({
  name: "studio-read-only-preview",
  apply: "build",
  async generateBundle() {
    const app = path.join(root, "app");
    const server = await createServer({
      configFile: false, root: app, publicDir: false,
      plugins: [balApi({ snapshot: true })],
      oxc: { jsx: { runtime: "automatic" } },
      resolve: { alias: { "@root": root } },
      server: { host: "127.0.0.1", port: 0, watch: null, fs: { allow: [root] } },
    });
    try {
      await server.listen();
      const address = server.httpServer?.address();
      if (!address || typeof address === "string") throw new Error("Preview data server did not start");
      const origin = `http://127.0.0.1:${address.port}`;
      const config = JSON.parse(await readFile(path.join(root, "config.json"), "utf8"));
      const snapshot: PreviewSnapshot = { defaultChannel: config.defaultChannel, records: {} };
      const capture = async (route: string, channel: string, required = false): Promise<any> => {
        const res = await fetch(`${origin}${route}?channel=${encodeURIComponent(channel)}`, { signal: AbortSignal.timeout(60_000) });
        const data = await res.json();
        // Never export secret availability or local machine paths through errors.
        if (!res.ok) {
          if (required) throw new Error(`Preview export failed: ${channel} ${route} (${res.status})`);
          snapshot.records[previewKey(`${route}?channel=${channel}`, config.defaultChannel)] = { status: res.status, data: { error: "هذه البيانات غير متاحة في نسخة المعاينة." } };
          return null;
        }
        if (route === "/api/channel" && data.voice) delete data.voice.id;
        if (data.keys) data.keys = { voice: false, quran: false };
        snapshot.records[previewKey(`${route}?channel=${channel}`, config.defaultChannel)] = { status: 200, data };
        return data;
      };
      const channels = await capture("/api/channels", config.defaultChannel, true);
      for (const channel of channels) {
        const ch = channel.id as string;
        for (const [route, data] of Object.entries({
          "/api/settings": { keys: {} }, "/api/update": { available: false, behind: 0, changes: [] },
          "/api/render": [], "/api/jobs": [], "/api/voice-sample/models": { models: [], current: "" },
        })) snapshot.records[`${ch}:${route}`] = { status: 200, data };
        await capture("/api/channels", ch, true);
        for (const route of ["identity", "channel", "episodes", "overview", "ops", "labs", "guide", "sfx", "library-images"]) {
          await capture(`/api/${route}`, ch, ["identity", "channel", "episodes"].includes(route));
        }
        const guide = snapshot.records[`${ch}:/api/guide`]?.data as any;
        for (const entry of guide?.index?.entries ?? []) await capture(`/api/guide/${encodeURIComponent(entry.file)}`, ch);
        const episodes = snapshot.records[`${ch}:/api/episodes`]?.data as any[];
        for (const ep of episodes) {
          if (ep.hasPlan) await capture(`/api/episodes/${ep.id}`, ch);
          for (const section of ["research", "status", "storyboard", "scene-review", "review", "previews", "reviews", "package", "recitation"]) {
            await capture(`/api/episodes/${ep.id}/${section}`, ch);
          }
        }
        // Export only indexed review videos; never copy .env, render queues, or arbitrary files.
        const copyPreview = async (dir: string, name: string, route: string) => {
          if (!/^[\w.-]+\.mp4$/i.test(name)) return;
          const file = path.join(root, "channels", ch, "episodes", dir, "previews", name);
          if (!existsSync(file)) return;
          this.emitFile({ type: "asset", fileName: `studio-preview-media/${ch}/${route}/${name}`, source: await readFile(file) });
        };
        for (const ep of episodes) {
          const previews = snapshot.records[`${ch}:/api/episodes/${ep.id}/previews`]?.data as any;
          for (const file of previews?.files ?? []) await copyPreview(ep.dir, file.name, `episodes/${ep.id}/previews`);
        }
        const labs = snapshot.records[`${ch}:/api/labs`]?.data as any;
        for (const lab of labs?.labs ?? []) for (const file of lab.previews) await copyPreview(lab.dir, file.name, `labs/${lab.dir}/previews`);
        const sfx = snapshot.records[`${ch}:/api/sfx`]?.data as any[];
        for (const item of sfx ?? []) {
          if (!item.available || !/^[\w-]+$/.test(item.id)) continue;
          const file = path.join(root, "assets", "sfx", `${item.id}.mp3`);
          if (existsSync(file)) this.emitFile({ type: "asset", fileName: `studio-preview-media/${ch}/sfx/${item.id}.mp3`, source: await readFile(file) });
        }
      }
      this.emitFile({ type: "asset", fileName: "studio-preview.json", source: JSON.stringify(snapshot) });
    } finally {
      await server.close();
    }
  },
});
