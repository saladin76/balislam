/**
 * فحص الخلط سطرًا سطرًا (D158، بندا بطاقة الجودة «الراوي فوق صوت المكان» و«الراوي فوق المؤثر»):
 * في كل جملة يقولها الراوي ويقع عليها مؤثر، يُقارن علو الراوي في الجملة بأعلى ما يبلغه المؤثر أثناءها، بالعلو نفسه
 * الذي يخرج به في الرندر (narrationVolume وربح سرد المشهد، وsfxVolume مع الخفض تحت الكلام والسكون المقصود، src/plan/sfxMix.ts).
 * الحد (أرقام Papermorph): الراوي أعلى من صوت الجو ≥ ١٥ dB، ومن أي مؤثر آخر ≥ ٦ dB.
 *
 * القياس من الملفات نفسها لا من الملف المجمّع (لا يُفصل صوت عن صوت بعد الخلط): العلو اللحظي (EBU R128، نافذة ٤٠٠ ms)
 * لكل مقطع راوٍ ولكل مؤثر، بمرشح ffmpeg «ebur128». الجزء الحسابي هنا خالص؛ والقياس في measureMixLevels.
 */
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Plan, PlanScene } from "../../plan/types";
import type { EpisodeMedia } from "../../plan/media";
import { isAmbience, sceneSacredSpans, sfxGainAt, speechSpans } from "../../plan/sfxMix";
import { splitWords } from "../../remotion/scenes/timing";

export const MIX_MIN = { ambience: 15, sfx: 6 } as const;
/** علو لحظي دون هذا صمت (البوابة المطلقة في EBU R128) */
const SILENT = -70;

/** علو لحظي (LUFS) عند الثانية t من أول الملف */
export type Frame = { t: number; m: number };
export type MixLevels = { voice: Record<string, Frame[]>; sfx: Record<string, Frame[]> };
export type MixLine = { scene: string; sentence: string; sfx: string; kind: "ambience" | "sfx"; narrator: number; peak: number; margin: number; need: number; ok: boolean };
export type MixReport = { lines: MixLine[]; ambience: number | null; sfx: number | null; ok: boolean };

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const round1 = (x: number) => Math.round(x * 10) / 10;

/** علو مقطع من إطاراته اللحظية: متوسط الطاقة بعد البوابتين المطلقة (−70) والنسبية (−10 LU)، كالعلو المتكامل */
export const gatedLoudness = (frames: Frame[]): number | null => {
  const e = (xs: number[]) => 10 * Math.log10(xs.reduce((a, m) => a + 10 ** (m / 10), 0) / xs.length);
  const live = frames.map((f) => f.m).filter((m) => Number.isFinite(m) && m > SILENT);
  if (!live.length) return null;
  const rel = e(live) - 10;
  const kept = live.filter((m) => m > rel);
  return e(kept.length ? kept : live);
};

/** الجمل بمواضعها في الزمن من كلمات صوت الراوي (الجملة تنتهي بـ . ؟ ! :) */
export const sentenceSpans = (scene: PlanScene, words: { start: number; end: number }[]) => {
  const sentences = (scene.narration.match(/[^.؟!:]+[.؟!:]?/g) ?? []).map((x) => x.trim()).filter(Boolean);
  const out: { text: string; from: number; to: number }[] = [];
  let k = 0;
  for (const text of sentences) {
    const n = splitWords(text).length;
    const first = words[Math.min(k, words.length - 1)], last = words[Math.min(k + n - 1, words.length - 1)];
    if (n && first && last) out.push({ text, from: first.start, to: Math.max(first.start, last.end) });
    k += n;
  }
  return out;
};

export const checkMix = (plan: Plan, media: Pick<EpisodeMedia, "voice" | "recitations" | "sfx">, levels: MixLevels,
  opts: { narrationVolume: number; sfxVolume: number; narrationGain?: Record<string, number> }): MixReport => {
  const lines: MixLine[] = [];
  const all = plan.chapters.flatMap((c) => c.scenes);
  all.forEach((scene, idx) => {
    const live = scene.sfx.filter((x) => media.sfx.includes(x.id) && levels.sfx[x.id]?.length);
    const clip = media.voice[scene.id];
    const voice = levels.voice[scene.id];
    // بلا صوت راوٍ مطابق لا جملة يغطيها المؤثر
    if (!live.length || !clip || clip.text !== scene.narration.trim() || !clip.words.length || !voice?.length) return;
    const gain = db(opts.narrationVolume * (opts.narrationGain?.[scene.id] ?? 1));
    const sacred = sceneSacredSpans(scene, all[idx + 1], media, plan.channel);
    const speech = speechSpans(scene, media);
    for (const s of sentenceSpans(scene, clip.words)) {
      // الإطار اللحظي عند t يغطي [t − ٠٫٤، t]؛ يُنسب إلى الجملة إن وقع وسطه فيها
      const inside = (t: number) => t - 0.2 >= s.from && t - 0.2 <= s.to;
      const narrator = gatedLoudness(voice.filter((f) => inside(f.t)));
      if (narrator === null) continue;
      for (const x of live) {
        const amb = isAmbience(x.id);
        let peak = -Infinity;
        for (const f of levels.sfx[x.id]!) {
          const t = x.at + f.t;
          if (!inside(t) || !Number.isFinite(f.m)) continue;
          // الخفض والسكون على وسط النافذة اللحظية
          peak = Math.max(peak, f.m + db(opts.sfxVolume * sfxGainAt(t - 0.2, sacred, speech, amb)));
        }
        if (!Number.isFinite(peak) || peak <= SILENT) continue;
        const need = amb ? MIX_MIN.ambience : MIX_MIN.sfx;
        const n = narrator + gain, margin = round1(n - peak);
        lines.push({ scene: scene.id, sentence: s.text, sfx: x.id, kind: amb ? "ambience" : "sfx", narrator: round1(n), peak: round1(peak), margin, need, ok: margin >= need });
      }
    }
  });
  const min = (k: MixLine["kind"]) => { const v = lines.filter((l) => l.kind === k).map((l) => l.margin); return v.length ? Math.min(...v) : null; };
  return { lines, ambience: min("ambience"), sfx: min("sfx"), ok: lines.every((l) => l.ok) };
};

/** إطارات ebur128 اللحظية (framelog=info): «t: 0.5 TARGET:-23 LUFS M: -21.4 S: …» */
export const parseFrames = (stderr: string): Frame[] => {
  const out: Frame[] = [];
  for (const m of stderr.matchAll(/\bt:\s*([\d.]+)\s+TARGET:\S+\s+LUFS\s+M:\s*(-?[\d.]+|-?inf|nan)/g)) {
    const v = m[2]!.includes("inf") || m[2] === "nan" ? -Infinity : Number(m[2]);
    out.push({ t: Number(m[1]), m: v });
  }
  return out;
};

const exec = promisify(execFile);
const frameCache = new Map<string, Frame[]>();
/** pad: صمت يُلحق بالملف فتغطي النافذة اللحظية (٤٠٠ ms) مؤثرًا أقصر منها */
export const measureFrames = async (file: string, pad = 0): Promise<Frame[]> => {
  const { stat } = await import("node:fs/promises");
  const st = await stat(file);
  const key = `${file}:${st.size}:${st.mtimeMs}:${pad}`;
  const hit = frameCache.get(key);
  if (hit) return hit;
  const r = await exec("ffmpeg", ["-hide_banner", "-nostats", "-nostdin", "-i", file, "-map", "0:a:0", "-af", `${pad ? `apad=pad_dur=${pad},` : ""}ebur128=framelog=info`, "-f", "null", "-"],
    { maxBuffer: 64 * 1024 * 1024, timeout: 600_000 });
  const frames = parseFrames(String(r.stderr));
  frameCache.set(key, frames);
  return frames;
};

/** يقيس ما يلزم الفحص: مقطع الراوي لكل مشهد عليه مؤثر، وكل مؤثر مستعمل */
export const measureMixLevels = async (scriptPath: string, plan: Plan, media: Pick<EpisodeMedia, "voice" | "sfx">, sfxFile: (id: string) => string): Promise<MixLevels> => {
  const levels: MixLevels = { voice: {}, sfx: {} };
  const dir = path.join(path.dirname(scriptPath), "voice");
  for (const s of plan.chapters.flatMap((c) => c.scenes)) {
    const live = s.sfx.filter((x) => media.sfx.includes(x.id));
    const clip = media.voice[s.id];
    if (!live.length || !clip || clip.text !== s.narration.trim() || path.basename(clip.file) !== clip.file) continue;
    levels.voice[s.id] = await measureFrames(path.join(dir, clip.file));
    for (const x of live) levels.sfx[x.id] ??= await measureFrames(sfxFile(x.id), 0.5);
  }
  return levels;
};
