/**
 * D228 (قاعدة ثابتة من المالك، ٢٦ نوفمبر): «التصميم بالفهم والاختيار، لا بالنسخ».
 * لا يُبرمج ولا يُستعمل في الإنتاج قالب جديد (أو شكل جديد، أو لقطة جديدة داخل قالب) قبل أن يختار المالك نموذجه
 * من ستوري بورد أول ستة مشاهد (٢–٣ نماذج لكل مشهد) ويعتمده.
 *
 * السجل: templates/approvals.json.
 * - legacy: كل قالب ولقطة كانت في الإنتاج قبل D228 (لقطة مجمَّدة، لا يُضاف إليها شيء).
 * - templates: كل قالب أو لقطة بعد D228 بحالتها «مقترح» ← «معتمد من المالك»، مع سجل الاعتماد:
 *   من، ومتى، وأي نموذج، ومن أي ستوري بورد.
 *
 * المفتاح: معرّف القالب («reader-notebook»)، أو القالب ولقطته («horizon-shot/lib-term»).
 * البوابة (assertTemplatesApproved) في قلب الرندر (renderComposition): أي مشهد بمفتاح غير معتمد يوقف الرندر كله،
 * وكذلك المفتاح المجهول (لا في legacy ولا في السجل)، فلا يتسلل قالب لم يُسجَّل.
 */
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "../config/paths";
import type { Plan } from "./types";

export const PROPOSED = "مقترح";
export const OWNER_APPROVED = "معتمد من المالك";

export type TemplateApproval = {
  status: typeof PROPOSED | typeof OWNER_APPROVED;
  channel: string;
  nameAr: string;
  /** مجلد الستوري بورد تحت ~/Desktop/للمراجعة/ستوري-بورد/ */
  storyboard?: string;
  /** النماذج المقترحة (مثل «مشهد-1-نموذج-أ») */
  variants?: string[];
  approval?: { by: string; at: string; variant: string };
};
export type ApprovalsFile = { version: 1; legacy: string[]; templates: Record<string, TemplateApproval> };

export const approvalsPath = (root = projectRoot) => path.join(root, "templates", "approvals.json");

export const loadApprovals = (root = projectRoot): ApprovalsFile => {
  const raw = JSON.parse(readFileSync(approvalsPath(root), "utf8")) as ApprovalsFile;
  if (raw.version !== 1 || !Array.isArray(raw.legacy) || typeof raw.templates !== "object") throw new Error("templates/approvals.json تالف.");
  return raw;
};

/** مفاتيح المشهد: القالب، ثم القالب ولقطته إن وُجدت */
export const sceneTemplateKeys = (scene: { template: string; props?: Record<string, unknown> }): string[] => {
  const shot = typeof scene.props?.shot === "string" && scene.props.shot.trim() ? scene.props.shot.trim() : "";
  return shot ? [scene.template, `${scene.template}/${shot}`] : [scene.template];
};

/** هل المفتاح مسموح في الإنتاج: قديم قبل D228، أو معتمد من المالك بسجل كامل */
export const keyApproved = (a: ApprovalsFile, key: string): boolean => {
  if (a.legacy.includes(key)) return true;
  const t = a.templates[key];
  return Boolean(t && t.status === OWNER_APPROVED && t.approval?.by && t.approval.at && t.approval.variant);
};

export type Unapproved = { sceneId: string; key: string; status: string };
export const unapprovedScenes = (plan: Pick<Plan, "chapters">, a: ApprovalsFile): Unapproved[] => {
  const out: Unapproved[] = [];
  for (const c of plan.chapters) for (const s of c.scenes) for (const key of sceneTemplateKeys(s as never))
    if (!keyApproved(a, key)) out.push({ sceneId: s.id, key, status: a.templates[key]?.status ?? "غير مسجَّل" });
  return out;
};

/** بوابة الرندر (D228): لا يُرندر مشهد بقالب أو لقطة غير معتمدة من المالك */
export const assertTemplatesApproved = (plan: Pick<Plan, "chapters">, a: ApprovalsFile = loadApprovals()) => {
  const bad = unapprovedScenes(plan, a);
  if (bad.length) throw new Error(`D228: لا رندر بقالب غير معتمد من المالك. اعتمد النموذج من الستوري بورد أولًا:\n${bad.map((b) => `- ${b.sceneId}: ${b.key} (${b.status})`).join("\n")}`);
};

/** تسجيل قالب مقترح (قبل برمجته) */
export const proposeTemplate = (key: string, t: Omit<TemplateApproval, "status" | "approval">, root = projectRoot) => {
  const a = loadApprovals(root);
  if (a.legacy.includes(key)) throw new Error(`${key} قالب قائم قبل D228.`);
  if (a.templates[key]?.status === OWNER_APPROVED) throw new Error(`${key} معتمد بالفعل.`);
  a.templates[key] = { ...t, status: PROPOSED };
  save(a, root);
};

/** اعتماد المالك لنموذج (الاستوديو على جهازه أو أمر bal): من، ومتى، وأي نموذج */
export const approveTemplate = (key: string, variant: string, by = "المالك", root = projectRoot, now = new Date()) => {
  const a = loadApprovals(root);
  const t = a.templates[key];
  if (!t) throw new Error(`${key} غير مسجَّل قالبًا مقترحًا.`);
  if (!variant.trim()) throw new Error("حدّد النموذج المعتمد.");
  if (t.variants?.length && !t.variants.includes(variant)) throw new Error(`النموذج ${variant} ليس من نماذج ${key}: ${t.variants.join("، ")}`);
  a.templates[key] = { ...t, status: OWNER_APPROVED, approval: { by, at: now.toISOString(), variant } };
  save(a, root);
  return a.templates[key]!;
};

const save = (a: ApprovalsFile, root: string) => {
  const f = approvalsPath(root), tmp = `${f}.tmp`;
  writeFileSync(tmp, JSON.stringify(a, null, 2) + "\n");
  renameSync(tmp, f);
};
