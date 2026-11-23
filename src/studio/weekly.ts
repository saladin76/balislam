/**
 * المراجعة الأسبوعية (D191، قرار المالك ٢٢ نوفمبر): لكل قناة نسبة النقر، ومتوسط المشاهدة، وأكبر تسرب، وتحسين واحد
 * فقط كل أسبوع. من بيانات محلية وحدها، لا مفتاح خارجي ولا اتصال:
 *
 * - **نسبة النقر ومتوسط المشاهدة:** من تصدير «جدول البيانات» في YouTube Studio (Advanced mode ← Export ← CSV)، يستورده
 *   `bal analytics-import` إلى `.studio/analytics/<القناة>/<الحلقة>.json` على جهاز المالك (لا يُرفع).
 * - **أكبر تسرب:** من تصدير «Audience retention» بقارئ الاحتفاظ D165 (`src/analytics/retention.ts`)، يُستورد بالأمر نفسه.
 * - بلا ملف لا رقم: «لا بيانات بعد»، ولا يُخترع شيء.
 */
import type { RetentionReport } from "../analytics/retention";
import { EARLY_DROP_LIMIT } from "../analytics/retention";

/** ما يُحفظ لكل حلقة منشورة بعد الاستيراد */
export type EpisodeAnalytics = {
  version: 1;
  channel: string; episode: string; importedAt: string;
  /** من «جدول البيانات» (Table data) */
  impressions?: number; ctr?: number; views?: number; avgViewSec?: number; avgViewPct?: number;
};

const NUM = (s: string) => Number(String(s).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[,٬\s%٪]/g, "").replace("٫", "."));
const clockSec = (s: string) => {
  const p = s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).trim().split(":").map(Number);
  return p.length > 1 && p.every(Number.isFinite) ? p.reduce((a, x) => a * 60 + x, 0) : NUM(s);
};
const splitRow = (line: string, sep: string) => {
  const out: string[] = [];
  let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === sep && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
};

/**
 * من «جدول البيانات» في YouTube Studio إلى أرقام الحلقة. السطر «Total» (أو «الإجمالي») إن وُجد، وإلا أول سطر بيانات.
 * الأعمدة بالإنجليزية أو العربية: Impressions / مرات الظهور، Impressions click-through rate (%) / نسبة النقر إلى الظهور،
 * Views / المشاهدات، Average view duration / متوسط مدة المشاهدة، Average percentage viewed (%) / متوسط النسبة المئوية للمشاهدة.
 */
export const parseTableData = (text: string): Omit<EpisodeAnalytics, "version" | "channel" | "episode" | "importedAt"> => {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("ملف «جدول البيانات» بلا بيانات.");
  const sep = lines[0]!.includes("\t") ? "\t" : ",";
  const head = splitRow(lines[0]!, sep).map((h) => h.toLowerCase());
  const col = (re: RegExp, not?: RegExp) => head.findIndex((h) => re.test(h) && !(not && not.test(h)));
  const rows = lines.slice(1).map((l) => splitRow(l, sep));
  const total = rows.find((r) => /^(total|الإجمالي|المجموع)$/i.test(r[0] ?? "")) ?? rows[0]!;
  const val = (i: number, f: (s: string) => number = NUM) => (i >= 0 && total[i] ? f(total[i]!) : undefined);
  const out = {
    impressions: val(col(/^impressions$|^مرات الظهور$/)),
    ctr: val(col(/click-through|نسبة النقر/)),
    views: val(col(/^views$|^المشاهدات$/)),
    avgViewSec: val(col(/average view duration|متوسط مدة المشاهدة/), clockSec),
    avgViewPct: val(col(/average percentage viewed|متوسط النسبة المئوية/)),
  };
  const clean = Object.fromEntries(Object.entries(out).filter(([, v]) => typeof v === "number" && Number.isFinite(v)));
  if (!Object.keys(clean).length) throw new Error(`لم أجد أعمدة نسبة النقر أو متوسط المشاهدة في أول سطر: ${lines[0]}`);
  return clean;
};

export type EpisodeWeek = { episode: string; title: string; analytics?: EpisodeAnalytics; retention?: RetentionReport };
export type ChannelWeek = { id: string; name: string; episodes: EpisodeWeek[] };
export type ChannelReview = {
  id: string; name: string;
  ctr: number | null; avgViewSec: number | null; avgViewPct: number | null;
  biggest: { episode: string; title: string; from: number; to: number; drop: number; sceneId?: string; sentence?: string; early: boolean } | null;
  /** تحسين واحد فقط لهذا الأسبوع */
  improvement: string;
  hasData: boolean;
};

/** حدود التحسين (نقاط بدء معروفة في يوتيوب؛ تُراجَع مع البيانات) */
export const CTR_LOW = 4;
export const AVG_PCT_LOW = 35;

const wavg = (xs: { v?: number; w?: number }[]) => {
  const ok = xs.filter((x) => typeof x.v === "number");
  if (!ok.length) return null;
  const W = ok.reduce((a, x) => a + (x.w && x.w > 0 ? x.w : 1), 0);
  return ok.reduce((a, x) => a + x.v! * (x.w && x.w > 0 ? x.w : 1), 0) / W;
};
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export const reviewChannel = (c: ChannelWeek): ChannelReview => {
  const eps = c.episodes;
  const ctr = wavg(eps.map((e) => ({ v: e.analytics?.ctr, w: e.analytics?.impressions })));
  const avgViewSec = wavg(eps.map((e) => ({ v: e.analytics?.avgViewSec, w: e.analytics?.views })));
  const avgViewPct = wavg(eps.map((e) => ({ v: e.analytics?.avgViewPct ?? e.retention?.average, w: e.analytics?.views })));
  // أكبر تسرب في القناة: أشد هبوط في أي حلقة (تسرب البداية يُعدّ إن تجاوز حده، وإلا أكبر تسرب بعدها)
  let biggest: ChannelReview["biggest"] = null;
  for (const e of eps) {
    const r = e.retention;
    if (!r) continue;
    const cands = [...(r.earlyFix ? [{ s: r.early, early: true }] : []), ...(r.biggest ? [{ s: r.biggest, early: false }] : [])];
    for (const { s, early } of cands)
      if (!biggest || s.drop > biggest.drop) biggest = { episode: e.episode, title: e.title, from: s.from, to: s.to, drop: s.drop, sceneId: s.sceneId, sentence: s.sentence, early };
  }
  const hasData = ctr !== null || avgViewSec !== null || avgViewPct !== null || biggest !== null;
  // تحسين واحد بالترتيب: الخطاف ← الغلاف والعنوان ← موضع أكبر تسرب ← الإيقاع
  let improvement: string;
  if (!hasData) improvement = "ارفع تصدير YouTube Studio للحلقة المنشورة («جدول البيانات» و«Audience retention») ليبدأ القياس.";
  else if (biggest?.early) improvement = `الخطاف: أول ٣٠ ثانية في ${biggest.episode} تفقد ${Math.round(biggest.drop)} نقطة؛ أعد كتابة الجمل الأولى حتى ${clock(biggest.to)} (أكثر من ${EARLY_DROP_LIMIT}).`;
  else if (ctr !== null && ctr < CTR_LOW) improvement = `الغلاف والعنوان: نسبة النقر ${ctr.toFixed(1)}٪ (أقل من ${CTR_LOW}٪)؛ جرّب غلافًا بعنصر واحد أقوى وسؤالًا أقصر.`;
  else if (biggest) improvement = `أكبر تسرب: ${biggest.episode} عند ${clock(biggest.from)}–${clock(biggest.to)} (−${Math.round(biggest.drop)} نقطة)${biggest.sceneId ? ` في ${biggest.sceneId}` : ""}؛ اختصر الموضع أو أضف حدثًا مرئيًا فيه.`;
  else if (avgViewPct !== null && avgViewPct < AVG_PCT_LOW) improvement = `الإيقاع: متوسط المشاهدة ${Math.round(avgViewPct)}٪ (أقل من ${AVG_PCT_LOW}٪)؛ قصّر المشاهد الطويلة بلا حدث.`;
  else improvement = "لا مشكلة بارزة هذا الأسبوع: ثبّت ما نجح وجرّب فكرة غلاف جديدة واحدة.";
  return { id: c.id, name: c.name, ctr, avgViewSec, avgViewPct, biggest, improvement, hasData };
};

export const NO_DATA = "لا بيانات بعد";

/** المراجعة كاملة: قسم لكل قناة، والأرقام «لا بيانات بعد» حيث لا ملف */
export const weeklyMarkdown = (week: string, reviews: ChannelReview[]) => {
  const out = [`# المراجعة الأسبوعية — ${week}`, "", "من تصديرات YouTube Studio المستوردة على هذا الجهاز وحدها (D191). تحسين واحد لكل قناة.", ""];
  for (const r of reviews) {
    out.push(`## ${r.name}`, "");
    out.push(`- نسبة النقر: ${r.ctr !== null ? `${r.ctr.toFixed(1)}٪` : NO_DATA}`);
    out.push(`- متوسط المشاهدة: ${r.avgViewSec !== null ? clock(r.avgViewSec) : NO_DATA}${r.avgViewPct !== null ? ` (${Math.round(r.avgViewPct)}٪ من الحلقة)` : r.avgViewSec !== null ? "" : ""}`);
    out.push(`- أكبر تسرب: ${r.biggest ? `${r.biggest.episode} «${r.biggest.title}» ${clock(r.biggest.from)}–${clock(r.biggest.to)} (−${Math.round(r.biggest.drop)} نقطة)${r.biggest.sceneId ? ` في ${r.biggest.sceneId}` : ""}` : NO_DATA}`);
    out.push(`- **تحسين هذا الأسبوع:** ${r.improvement}`, "");
  }
  return out.join("\n");
};

/** «2026-W48» بالأسبوع الدولي */
export const isoWeek = (d: Date) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
};
