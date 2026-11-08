/**
 * نسخة قناة للاختبار (سلامة الاختبارات، ٨ نوفمبر): ملفات القناة وحدها (channel.json والهوية والنطق والمراجع)
 * بلا حلقاتها الحقيقية، ثم حلقة العينة من tests/fixtures. كان النسخ يشمل مجلد الحلقات كله (لوحات الستوري بورد
 * والمعاينات، 600 م.ب) فيتجاوز حد Vitest للـhook (10 ث) تحت الحمل، ويترك نسخة بحجم القناة في /tmp إن قُتل.
 */
import os from "node:os";
import path from "node:path";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";

export type Sandbox = { root: string; channelDir: string; episodeDir: (name: string) => string; cleanup: () => void };

export const channelSandbox = (
  prefix: string,
  opts: { channel?: string; episodes?: Record<string, string>; channelPatch?: (c: Record<string, unknown>) => Record<string, unknown> } = {},
): Sandbox => {
  const channel = opts.channel ?? "balislam";
  const root = mkdtempSync(path.join(os.tmpdir(), prefix));
  const src = path.join(__dirname, "..", "..", "channels", channel);
  const channelDir = path.join(root, channel);
  cpSync(src, channelDir, { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(path.relative(src, s) ? `/${path.relative(src, s)}` : "") });
  const episodes = opts.episodes ?? { "000-demo": "000-demo" };
  for (const [name, fixture] of Object.entries(episodes))
    cpSync(path.join(__dirname, "..", "fixtures", "episodes", fixture), path.join(channelDir, "episodes", name), { recursive: true });
  if (opts.channelPatch) {
    const f = path.join(channelDir, "channel.json");
    writeFileSync(f, JSON.stringify(opts.channelPatch(JSON.parse(readFileSync(f, "utf8"))), null, 2));
  }
  return {
    root,
    channelDir,
    episodeDir: (name) => path.join(channelDir, "episodes", name),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};

/** مصدر نص الآيات «fetch» لاختبارات الجلب (قناة بالإسلام نفسها «script» بقرار صاحبها) */
export const withFetchedQuran = (c: Record<string, unknown>) => ({ ...c, rules: { ...(c.rules as object), quranText: "fetch" } });
