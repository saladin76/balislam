/** D228: كل مفاتيح القوالب ولقطاتها في السجل (templateDefs)، ليتأكد الاختبار أن كل مفتاح قديم أو مسجَّل في templates/approvals.json */
import { templateDefs } from "./templates";

export const registryTemplateKeys = (): string[] => {
  const keys = new Set<string>();
  for (const t of templateDefs) {
    keys.add(t.id);
    for (const s of Object.keys(t.shots ?? {})) keys.add(`${t.id}/${s}`);
    const f = t.fields.find((x) => x.key === "shot") as { options?: { value: string }[] } | undefined;
    for (const o of f?.options ?? []) if (o.value) keys.add(`${t.id}/${o.value}`);
  }
  return [...keys].sort();
};
