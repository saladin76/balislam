#!/usr/bin/env node
// يعالج مكتبة المؤثرات (brand/sfxMastering.ts): الأصل في assets/sfx/original/، والمعالَج في assets/sfx/.
// node scripts/sfx-master.mjs            كل المؤثرات (من الأصل دائمًا، فإعادة التشغيل لا تُراكم المعالجة)
// node scripts/sfx-master.mjs knock rain  مؤثرات بعينها
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const run = promisify(execFile);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "assets", "sfx"), orig = path.join(dir, "original");
const lib = await readFile(path.join(root, "brand", "sfx.ts"), "utf8");
const defs = [...lib.matchAll(/id: "([^"]+)", nameAr: "[^"]*", category: "([^"]+)"[^}]*?seconds: ([\d.]+)/g)].map((m) => ({ id: m[1], category: m[2], seconds: +m[3] }));
const m = await readFile(path.join(root, "brand", "sfxMastering.ts"), "utf8");
const set = (name) => new Set([...(new RegExp(`export const ${name} = new Set\\(\\[([^\\]]+)\\]`).exec(m)[1].matchAll(/"([^"]+)"/g))].map((x) => x[1]));
const AMB = set("AMBIENCE"), IMP = set("IMPACT");
const num = (k, role) => +new RegExp(`${k}: \\{[^}]*${role}: (-?[\\d.]+)`).exec(m)[1];
const roleOf = (d) => (AMB.has(d.id) ? "ambience" : IMP.has(d.id) ? "impact" : d.category === "transition" ? "transition" : "action");
const TP = -3, SR = 48000, XF = 0.5;
const ff = (args) => run("ffmpeg", ["-hide_banner", "-nostats", "-y", ...args], { maxBuffer: 32 << 20 });
const dur = async (f) => +(await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f])).stdout.trim();
const want = process.argv.slice(2);
await mkdir(orig, { recursive: true });
const tmp = path.join(os.tmpdir(), `sfx-master-${process.pid}`); await mkdir(tmp, { recursive: true });
for (const d of defs) {
  if (want.length && !want.includes(d.id)) continue;
  const live = path.join(dir, `${d.id}.mp3`), src = path.join(orig, `${d.id}.mp3`);
  if (!existsSync(src)) { if (!existsSync(live)) continue; await copyFile(live, src); }
  const role = roleOf(d);
  const a = path.join(tmp, `${d.id}-a.wav`), b = path.join(tmp, `${d.id}-b.wav`);
  // ١) الصيغة، وقص الصمت في الطرفين، وقص القصير إلى طوله المعرَّف (لا أقل من آخر صوت فيه)
  await ff(["-i", src, "-af", `aresample=${SR},silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.005,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse`, "-ac", "2", a]);
  let d0 = await dur(a);
  if (role !== "ambience" && d.seconds < 0.5 && d0 > d.seconds * 1.4) { await ff(["-i", a, "-af", `atrim=0:${d.seconds * 1.25}`, b]); await rm(a); await copyFile(b, a); d0 = await dur(a); }
  // ٢) التفاف أصوات الجو: آخرها يذوب في أولها، فتتكرر بلا موضع ظاهر
  if (role === "ambience" && d0 > XF * 4) {
    await ff(["-i", a, "-i", a, "-filter_complex", `[0]atrim=start=${XF},asetpts=PTS-STARTPTS[body];[1]atrim=0:${XF},asetpts=PTS-STARTPTS[head];[body][head]acrossfade=d=${XF}:c1=tri:c2=tri`, b]);
    await rm(a); await copyFile(b, a); d0 = await dur(a);
  }
  // ٣) التدرّج
  const fi = Math.min(num("fadeIn", role), d0 / 4), fo = Math.min(num("fadeOut", role), d0 / 3);
  await ff(["-i", a, "-af", `afade=t=in:d=${fi},afade=t=out:st=${Math.max(0, d0 - fo)}:d=${fo}`, b]);
  // ٤) العلو بقياسين (loudnorm خطي) وسقف الذروة
  const I = num("lufs", role);
  const meas = (await ff(["-i", b, "-af", `loudnorm=I=${I}:TP=${TP}:LRA=11:print_format=json`, "-f", "null", "-"]).catch((e) => e)).stderr;
  const j = JSON.parse(meas.slice(meas.lastIndexOf("{"), meas.lastIndexOf("}") + 1));
  // أقصر من بوابة القياس (٠٫٤ ث): العلو من متوسط طاقة الجزء المسموع (RMS) بدل LUFS
  let ln;
  if (!Number.isFinite(+j.input_i) || +j.input_i < -70) {
    const st = (await ff(["-i", b, "-af", "astats=metadata=0:reset=0", "-f", "null", "-"]).catch((e) => e)).stderr;
    const rms = +(/Overall[\s\S]*?RMS level dB: (-?[\d.]+)/.exec(st) ?? [, -40])[1];
    ln = `volume=${(I - rms).toFixed(2)}dB`;
  } else ln = `loudnorm=I=${I}:TP=${TP}:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  // ٥) تصحيح: صوت ذروته عالية لا يبلغ هدفه تحت السقف بالمعالجة الخطية؛ يُرفع ثم يحدّه المحدِّد (مرتين على الأكثر)
  const limit = `alimiter=limit=${Math.pow(10, (TP - 0.3) / 20).toFixed(4)}:attack=1:release=50:level=false`;
  const level = async (f) => {
    const e = (await ff(["-i", f, "-af", "ebur128,astats=metadata=0", "-f", "null", "-"]).catch((x) => x)).stderr;
    const s = e.slice(e.lastIndexOf("Summary"));
    const lufs = +(/I:\s+(-?[\d.]+) LUFS/.exec(s) ?? [, -99])[1];
    return lufs > -70 ? lufs : +(/Overall[\s\S]*?RMS level dB: (-?[\d.]+)/.exec(e) ?? [, -99])[1];
  };
  let gain = 0;
  for (let k = 0; k < 3; k++) {
    await ff(["-i", b, "-af", `${ln},volume=${gain.toFixed(2)}dB,${limit},aresample=${SR}`, "-ar", String(SR), "-c:a", "libmp3lame", "-b:a", "192k", live]);
    const off = I - (await level(live));
    if (Math.abs(off) <= 1) break;
    gain += off;
  }
  console.log(`✓ ${d.id} (${role}) ${d0.toFixed(2)} ث`);
}
await rm(tmp, { recursive: true, force: true });
