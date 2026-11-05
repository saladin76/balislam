/**
 * «مختبرات الإنتاج» (الأمر 017): آلية عامة لكل القنوات لمراجعة التجارب الإخراجية قبل اعتمادها.
 * المختبر مجلد NNN-… في حلقات القناة فيه lab.json (ولا script.md): ليس حلقة، لا يظهر في قائمة الحلقات،
 * ولا يُصدَّر ولا يُنشر (أوامر الإنتاج تتطلب script.md). المجلد بلا lab.json (مثل 000-trailer) ليس مختبرًا.
 * البيانات لكل قناة من مجلد حلقاتها وحده، فلا تختلط مختبرات القنوات.
 */
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

/** الحالة الإخراجية: نجاح الفحوص التقنية لا يجعلها «معتمد» — الاعتماد قرار المشرف وحده */
export type LabStatus = "experimental" | "review" | "approved" | "rejected";
export const LAB_STATUS_AR: Record<LabStatus, string> = { experimental: "تجريبي", review: "جاهز للمراجعة", approved: "معتمد", rejected: "مرفوض" };

export type LabTool = {
  name: string;
  /** حالته الإخراجية في المختبر */
  status: LabStatus;
  /** انتقل فعلًا إلى المكتبة العامة (اسمه أو مساره هناك) */
  promotedTo?: string;
  note?: string;
};
export type LabCheck = { name: string; ok: boolean; detail?: string; at?: string };
export type LabDecision = { at: string; by: string; decision: string; status: LabStatus };
export type LabMeta = {
  title: string;
  purpose: string;
  status: LabStatus;
  tools: LabTool[];
  /** نتائج الفحوص التقنية (الاختبارات، القياس) — لا تعني اعتمادًا */
  checks: LabCheck[];
  visualNotes: string[];
  decisions: LabDecision[];
  /** ما انتقل إلى المكتبة العامة فعلًا */
  promoted: string[];
  /** حالة كل معاينة بخانتها (library.mp4 …) */
  previews?: Record<string, LabStatus>;
  updatedAt: string;
};
export type LabPreview = { name: string; title: string; note: string; version: number; updatedAt: string | null; size: number; status: LabStatus };
export type LabSummary = Omit<LabMeta, "previews"> & { id: string; dir: string; previews: LabPreview[]; lastActivity: string | null };

const STATUSES: LabStatus[] = ["experimental", "review", "approved", "rejected"];

/** يتحقق من بنية lab.json ويعيد رسائل الخطأ (فارغة إن كان سليمًا) */
export const labProblems = (m: Partial<LabMeta>): string[] => {
  const p: string[] = [];
  if (!m.title?.trim()) p.push("title فارغ");
  if (!m.purpose?.trim()) p.push("purpose فارغ");
  if (!STATUSES.includes(m.status as LabStatus)) p.push(`status غير معروف: ${m.status}`);
  if (!Array.isArray(m.tools) || !m.tools.length) p.push("tools فارغة");
  for (const t of m.tools ?? []) if (!STATUSES.includes(t.status)) p.push(`حالة أداة غير معروفة: ${t.name}`);
  for (const t of m.tools ?? []) if (t.promotedTo && !(m.promoted ?? []).some((x) => x.includes(t.promotedTo!))) p.push(`أداة منقولة غير مذكورة في promoted: ${t.name}`);
  if (m.status === "approved" && !(m.decisions ?? []).some((d) => d.status === "approved")) p.push("status معتمد بلا قرار اعتماد مسجل");
  for (const [k, v] of Object.entries(m.previews ?? {})) {
    if (!STATUSES.includes(v)) p.push(`حالة معاينة غير معروفة: ${k}`);
    if (v === "approved" && !(m.decisions ?? []).some((d) => d.status === "approved")) p.push(`معاينة معتمدة بلا قرار مسجل: ${k}`);
  }
  if (!m.updatedAt) p.push("updatedAt فارغ");
  return p;
};

/** مجلدات المختبرات في مجلد حلقات قناة: NNN-… فيها lab.json وليس فيها script.md */
export const listLabDirs = async (episodesDir: string): Promise<string[]> =>
  existsSync(episodesDir)
    ? (await readdir(episodesDir)).filter((d) => /^\d{3}-/.test(d) && existsSync(path.join(episodesDir, d, "lab.json")) && !existsSync(path.join(episodesDir, d, "script.md"))).sort()
    : [];

const readJson = async <T>(f: string, fallback: T): Promise<T> => {
  if (!existsSync(f)) return fallback;
  try {
    return JSON.parse(await readFile(f, "utf8")) as T;
  } catch {
    return fallback;
  }
};

/** المختبرات بمعايناتها لقناة واحدة (مجلد حلقاتها) */
export const listLabs = async (episodesDir: string): Promise<LabSummary[]> => {
  const out: LabSummary[] = [];
  for (const d of await listLabDirs(episodesDir)) {
    const dir = path.join(episodesDir, d);
    const meta = await readJson<LabMeta | null>(path.join(dir, "lab.json"), null);
    if (!meta || labProblems(meta).length) continue;
    const pdir = path.join(dir, "previews");
    const index = await readJson<Record<string, { title?: string; note?: string; version?: number; updatedAt?: string }>>(path.join(pdir, "index.json"), {});
    const names = existsSync(pdir) ? (await readdir(pdir)).filter((n) => /\.mp4$/i.test(n)).sort() : [];
    const previews: LabPreview[] = [];
    for (const n of names)
      previews.push({ name: n, title: index[n]?.title ?? n, note: index[n]?.note ?? "", version: index[n]?.version ?? 1, updatedAt: index[n]?.updatedAt ?? null, size: (await stat(path.join(pdir, n))).size, status: meta.previews?.[n] ?? meta.status });
    const dates = [meta.updatedAt, ...previews.map((p) => p.updatedAt ?? ""), ...meta.decisions.map((x) => x.at)].filter(Boolean).sort();
    const { previews: _status, ...rest } = meta;
    out.push({ ...rest, id: d.slice(0, 3), dir: d, previews, lastActivity: dates[dates.length - 1] ?? null });
  }
  return out;
};
