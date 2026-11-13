import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { EP } from "../routeContext.ts";
import type { RouteCtx } from "../routeContext.ts";

/** «١ التجهيز»: ملف البحث، ونص القرآن للقراءة، والستوري بورد وتقرير حركته، وسجل التوثيق؛ ومراجعة المشاهد القديمة 410 (D120). */
export const handlePreparationRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, ch, send, readBody, load } = ctx;

  // ملف البحث (دراسة الكتاب في زبدة الكتب): research.md بجوار السكريبت، بقالب القناة إن لم يوجد
  if (parts[0] === "episodes" && parts[1] && parts[2] === "research") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { resolveScriptPath, templateFor, RESEARCH_FILE } = await load("/src/script/episodes.ts");
    const file = path.join(path.dirname(await resolveScriptPath(parts[1])), RESEARCH_FILE);
    const label = ch === "zubdat-alkutub" ? "دراسة الكتاب" : "ملف البحث";
    if (req.method === "PUT") {
      const { text } = await readBody(req);
      if (typeof text !== "string") return send(res, 400, { error: "نص غير صالح." }), true;
      await writeFile(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
      return send(res, 200, { ok: true }), true;
    }
    if (existsSync(file)) return send(res, 200, { text: await readFile(file, "utf8"), exists: true, label }), true;
    const tpl = templateFor(ch, RESEARCH_FILE, false);
    send(res, 200, { text: tpl ? (await readFile(tpl, "utf8")).replaceAll("{{TITLE}}", "") : "", exists: false, label });
    return true;
  }

  // Text-only Quran repair. Never regenerates the plan, downloads voice,
  // changes reviewer approvals or fills missing verses with placeholders.
  if (parts[0] === "episodes" && parts[1] && parts[2] === "quran-text-only" && parts.length === 3) {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { inspectMissingQuranTexts } = await load("/src/quran/fillMissingText.ts");
    if (req.method === "GET") {
      return send(res, 200, { status: await inspectMissingQuranTexts(parts[1]) }), true;
    }
    if (req.method === "POST")
      return send(res, 409, { error: "لا يُجلب نص القرآن إلى quran.json. اكتب الآية في السكريبت ثم استخدم مقارنة المصحف للقراءة فقط." }), true;
    return send(res, 405, { error: "Method not allowed" }), true;
  }

  // ستوري بورد الفيديو قبل تنفيذه (storyboard.json): الحالة، والاعتماد، وحركة كل مشهد إن قيست. لا سحب للاعتماد (D76).
  if (parts[0] === "episodes" && parts[1] && parts[2] === "storyboard") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { resolveScriptPath } = await load("/src/script/episodes.ts");
    const { loadPlan, regeneratePlan } = await load("/src/plan/io.ts");
    const S = await load("/src/plan/storyboard.ts");
    const { loadStoryboardMotion } = await load("/src/render/storyboardMotion.ts");
    const file = await resolveScriptPath(parts[1]);
    const plan = (await loadPlan(parts[1])) ?? (await regeneratePlan(parts[1]));
    if (req.method === "PUT") {
      const { action, auditNote } = await readBody(req);
      if (action === "approve") {
        // Script approval lives in the scene-first ledger only (unified engine).
        const { requireScriptApproved } = await load("/src/studio/sceneService.ts");
        await requireScriptApproved(parts[1]);
        const { checkVisualStoryboardSignoff } = await load("/src/plan/storyboardVisualGate.ts");
        const checked = checkVisualStoryboardSignoff(plan, auditNote);
        if (!checked.ok)
          return send(res, 400, { error: checked.reason }), true;
        // The illustrated storyboard is reviewed BEFORE voice/video production.
        // A motion-audit of a provisional silent video is intentionally NOT its
        // acceptance gate. Preserve the technical motion report as QA evidence.
        await S.approveStoryboard(file, plan, {
          note: checked.note,
        });
      } else if (action === "revoke")
        // QA balislam 1 / D76: «اعتمد التجهيز» is given once per episode and is never withdrawn from the studio.
        return send(res, 409, { error: S.STORYBOARD_REVOKE_REFUSED }), true;
      else return send(res, 400, { error: "إجراء غير صالح." }), true;
    }
    const status = S.storyboardStatus(plan, await S.loadStoryboard(file));
    const motion = await loadStoryboardMotion(parts[1]);
    // أي اختلاف في مدخلات الرندر يجعل القياس السابق غير صالح، لا مجرد تعديل القالب.
    let motionStale: string[] = [];
    if (motion) {
      const { currentMotionFingerprint } = await load("/src/render/motionFingerprint.ts");
      const { staleMotionScenes } = await load("/src/render/motionValidity.ts");
      const hash = await currentMotionFingerprint(parts[1], plan, motion.orientation);
      motionStale = staleMotionScenes(plan, motion, hash);
    }
    const { auditNeedsJustification } = await load("/src/render/motionValidity.ts");
    const motionAuditNeedsReview = Boolean(motion && !motionStale.length && auditNeedsJustification(motion, status.audit));
    // Kept separate: motion QA must not revoke a human-approved pre-voice storyboard.
    send(res, 200, { status, motion, motionStale, motionAuditNeedsReview, auditNeedsReview: false });
    return true;
  }

  // تنزيل التقرير النصي المفصل دون المساس بسجلات الاعتماد.
  if (parts[0] === "episodes" && parts[1] && parts[2] === "storyboard-report" && req.method === "GET") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { loadStoryboardMotion } = await load("/src/render/storyboardMotion.ts");
    const { loadPlan, regeneratePlan } = await load("/src/plan/io.ts");
    const { renderMotionAuditMarkdown } = await load("/src/render/motionAudit.ts");
    const report = await loadStoryboardMotion(parts[1]);
    if (!report) return send(res, 404, { error: "لا يوجد تقرير. ابدأ فحص الحركة والمنطق أولًا." }), true;
    const plan = (await loadPlan(parts[1])) ?? (await regeneratePlan(parts[1]));
    const { currentMotionFingerprint } = await load("/src/render/motionFingerprint.ts");
    const hash = await currentMotionFingerprint(parts[1], plan, report.orientation);
    const { staleMotionScenes } = await load("/src/render/motionValidity.ts");
    if (staleMotionScenes(plan, report, hash).length)
      return send(res, 409, { error: "تقرير الحركة قديم أو ناقص المشاهد؛ أعد فحص الحركة والمنطق لتنزيل تقرير صالح." }), true;
    send(res, 200, { markdown: renderMotionAuditMarkdown(plan, report) });
    return true;
  }

  // مراجعة المشاهد القديمة: صارت جزءًا من اعتماد المشهد بالصوت والصورة، وأُرشف سجلها (D120). لا يُقرأ شيء.
  if (parts[0] === "episodes" && parts[1] && parts[2] === "scene-review")
    return send(res, 410, { error: "مراجعة المشهد صارت جزءًا من اعتماده بالصوت والصورة في «٢ المشاهد»." }), true;

  // سجل التوثيق والاعتماد لكل استشهاد (review.json)
  if (parts[0] === "episodes" && parts[1] && parts[2] === "review") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { resolveScriptPath } = await load("/src/script/episodes.ts");
    const { parseScript } = await load("/src/script/parse.ts");
    const R = await load("/src/script/review.ts");
    const file = await resolveScriptPath(parts[1]);
    const script = parseScript(await readFile(file, "utf8"), file);
    let items;
    if (req.method === "PUT") {
      const { key, status, note } = await readBody(req);
      if (typeof key !== "string" || !["verified", "rejected", "pending"].includes(status)) return send(res, 400, { error: "قرار غير صالح." }), true;
      try {
        items = await R.setReview(file, script, key, status, typeof note === "string" ? note : "");
      } catch (e) {
        return send(res, 400, { error: (e as Error).message }), true;
      }
    } else items = R.reviewItems(script, await R.loadLedger(file));
    send(res, 200, { items, summary: R.reviewSummary(items) });
    return true;
  }


  return false;
};
