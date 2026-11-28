/**
 * D234 في اختبارات الاستوديو: حلقة الاختبار سكريبتها مرّ بمحرر المحتوى (كما يسجّله المنسّق بـ `bal editor-pass`)،
 * لتُختبر البوابات الأخرى بعده. بوابة المحرر نفسها في tests/script-pipeline-gate.test.ts.
 */
export const passEditor = async (scriptPath: string) =>
  (await import("../../src/studio/scriptPipelineStore")).recordEditorPass(scriptPath, { by: "محرر الاختبار", recordedBy: "الاختبار" });
