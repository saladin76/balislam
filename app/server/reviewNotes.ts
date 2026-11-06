/** Notes are review instructions, never approval records. */
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type ReviewNote = {
  id: string; sceneId: string; timeSec: number; text: string; createdAt: string;
};
export const validateReviewNotes = (value: unknown): ReviewNote[] => {
  if (!Array.isArray(value) || value.length > 200) throw new Error("عدد ملاحظات المراجعة غير صالح");
  const seen = new Set<string>();
  return value.map((raw: unknown) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("صيغة ملاحظة غير صالحة");
    const v = raw as Record<string, unknown>;
    if (typeof v.id !== "string" || !/^[A-Za-z0-9-]{4,80}$/.test(v.id) || seen.has(v.id)) throw new Error("معرّف الملاحظة غير صالح");
    seen.add(v.id);
    if (typeof v.sceneId !== "string" || !/^c\d+-s\d+$/.test(v.sceneId)) throw new Error("معرّف المشهد غير صالح");
    if (typeof v.timeSec !== "number" || !Number.isFinite(v.timeSec) || v.timeSec < 0 || v.timeSec > 86400) throw new Error("توقيت الملاحظة غير صالح");
    if (typeof v.text !== "string" || !v.text.trim() || v.text.length > 2000) throw new Error("نص الملاحظة غير صالح");
    if (typeof v.createdAt !== "string" || !Number.isFinite(Date.parse(v.createdAt))) throw new Error("تاريخ الملاحظة غير صالح");
    return { id: v.id, sceneId: v.sceneId, timeSec: v.timeSec, text: v.text.trim(), createdAt: v.createdAt };
  });
};
const noteFile = (scriptPath: string) => path.join(path.dirname(scriptPath), "review-notes.json");
export const readReviewNotes = async (scriptPath: string): Promise<ReviewNote[]> => {
  try {
    return validateReviewNotes(JSON.parse(await readFile(noteFile(scriptPath), "utf8")));
  } catch {
    return [];
  }
};
export const saveReviewNotes = async (scriptPath: string, input: unknown): Promise<ReviewNote[]> => {
  const notes = validateReviewNotes(input);
  const target = noteFile(scriptPath);
  const pending = target + "." + randomUUID() + ".pending";
  try {
    await writeFile(pending, JSON.stringify(notes, null, 2) + "\n", { flag: "wx" });
    await rename(pending, target);
    return notes;
  } finally {
    const { rm } = await import("node:fs/promises");
    await rm(pending, { force: true });
  }
};
