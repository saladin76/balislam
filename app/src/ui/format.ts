/**
 * What the owner reads, in one numeral system (UX review 9 Nov, D52): Arabic-Indic digits everywhere on the
 * main screens, scene names by their place («المشهد ٣», never «c1-s3»), verse references by the surah's
 * name («البقرة ٤٢», never «2:42»), durations as a clock («١١:٤٨»). Technical ids stay in titles/tooltips
 * and in the server only. Pure functions, plus one tiny span (`Num`) for the zero: no fetch.
 */
import React from "react";
import { SURAH_NAMES } from "../../../src/script/quranMeta";
import { arNum, sceneName, sceneNo, seamName } from "../workspace/sceneNames";

export { sceneName, sceneNo, seamName };

const AR = "٠١٢٣٤٥٦٧٨٩";
/** «12:05» → «١٢:٠٥»; leaves Arabic-Indic digits and everything else as is. */
export const arDigits = (s: string | number): string => String(s).replace(/\d/g, (d) => AR[Number(d)]!);

/** «٠٠١» or «۰۰۱» (Persian) → «001»: what the owner types, in either digit system, compared with an id. */
export const latinDigits = (s: string): string =>
  String(s).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/**
 * An episode's title as the owner reads it (zubdat's files carry «01 | كتاب «…» || فصل»): a leading «NN |» is the
 * number already shown beside it, and «||» / «|» between parts reads « — ». Display only: the files are not edited.
 */
export const episodeTitle = (raw: string | null | undefined): string => {
  let t = String(raw ?? "").trim();
  t = t.replace(/^[0-9٠-٩]{1,4}\s*[|｜]\s*(?![|｜])/, "");
  t = t.replace(/\s*[|｜]{1,2}\s*/g, " — ");
  return arDigits(t.replace(/\s{2,}/g, " ").replace(/^—\s*|\s*—$/g, "").trim());
};

/** A count or a measure: «١٢»، «١٬٢٠٠»، «٤٫٢» (fraction digits only when asked). */
export const num = (n: number, fractionDigits = 0): string =>
  Number.isFinite(n)
    ? n.toLocaleString("ar-EG", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
    : "—";
export { arNum };

/** Seconds as a clock: ٧٢ → «١:١٢»; ٣٧٢٥ → «١:٠٢:٠٥». */
export const duration = (sec: number): string => {
  const t = Math.max(0, Math.round(Number.isFinite(sec) ? sec : 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return arDigits(h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`);
};

/** A short measure in seconds: ٤٫٢ ث */
export const seconds = (sec: number, fractionDigits = 1): string => `${num(sec, fractionDigits)} ث`;

/**
 * A verse reference as the owner says it: «2:42» → «البقرة ٤٢»، «75:14-15» → «القيامة ١٤–١٥».
 * Anything that is not «سورة:آية[-آية]» is returned with its digits made Arabic-Indic.
 */
export const verseRef = (ref: string | null | undefined): string => {
  const raw = String(ref ?? "").trim();
  if (raw === "basmala") return "البسملة";
  const m = /^(\d{1,3})\s*[:：]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/.exec(raw);
  const name = m ? SURAH_NAMES[Number(m[1]) - 1] : undefined;
  // النقطة الوسطى بجوار الأرقام العربية تُقرأ صفرًا (D61): المرجع المكتوب «طه، ١٤» بفاصلها يُعرض «طه ١٤»
  if (!m || !name) return arDigits(raw.replace(/\s*\u00B7\s*/g, " "));
  return `${name} ${arDigits(m[2]!)}${m[3] ? `–${arDigits(m[3])}` : ""}`;
};

/** One episode length everywhere (D52): the plan's own duration, with where the number comes from. */
export type EpisodeLength = { seconds: number; source: "voice" | "plan" };
export const lengthSource = (l: Pick<EpisodeLength, "source">): string =>
  l.source === "voice" ? "مقيسة من صوت الراوي" : "مدة الخطة قبل تسجيل الصوت";

/** Technical text that must never reach the owner's main screens. */
export const TECHNICAL_TEXT: RegExp[] = [/c\d+-s\d+/, /\bMaster\b/, /(?:^|[\s«(])\/(?:home|Users|tmp|var|private)\/\S+/];

/**
 * The Arabic-Indic zero «٠» is a dot in most faces and vanishes beside «:» or «من» (direction D, 10 Nov).
 * `zeroParts` splits a string so every run of «٠» can be drawn a touch larger; `Num` does that as spans
 * (class «z», shell.css). Applied where numbers are drawn, never by rewriting the page's text afterwards.
 */
export const zeroParts = (s: string): { text: string; zero: boolean }[] =>
  String(s).split(/(٠+)/).filter((p) => p !== "").map((p) => ({ text: p, zero: /^٠+$/.test(p) }));

/** A number or a short numeric phrase («٠ من ٣١»، «٠:١٥») with the zero made legible. Digits are made Arabic-Indic. */
export const Num: React.FC<{ children: string | number; className?: string; title?: string }> = ({ children, className, title }) =>
  React.createElement("span", { className: className ? `num ${className}` : "num", title, dir: undefined },
    ...zeroParts(arDigits(children)).map((p, i) => (p.zero ? React.createElement("span", { key: i, className: "z" }, p.text) : p.text)));
