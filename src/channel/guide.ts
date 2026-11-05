/**
 * «دليل الاستوديو» لكل قناة: مرجع دائم في docs/<القناة>/ بفهرس guide.json، يُقرأ من واجهة الاستوديو (للقراءة فقط).
 * مصدر الحقيقة هو ملفات المستودع نفسها؛ الاستوديو يعرضها كما هي، فلا نسختان مختلفتان.
 * القناة التي لا دليل لها لا يظهر لها القسم.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../config/paths";

export type GuideEntry = { file: string; title: string; summary?: string };
export type GuideIndex = { title: string; channel: string; entries: GuideEntry[] };

export const guideDir = (channel: string, root = projectRoot) => path.join(root, "docs", channel);

/** فهرس دليل القناة، أو null إن لم يكن لها دليل */
export const readGuideIndex = async (channel: string, root = projectRoot): Promise<GuideIndex | null> => {
  if (!/^[a-z0-9-]+$/.test(channel)) return null;
  const f = path.join(guideDir(channel, root), "guide.json");
  if (!existsSync(f)) return null;
  return JSON.parse(await readFile(f, "utf8")) as GuideIndex;
};

/** نص صفحة من الدليل: يُقبل فقط ما في الفهرس (لا مسارات أخرى) */
export const readGuidePage = async (channel: string, file: string, root = projectRoot): Promise<string | null> => {
  const idx = await readGuideIndex(channel, root);
  if (!idx || !idx.entries.some((e) => e.file === file) || !/^[\w.-]+\.md$/.test(file)) return null;
  const p = path.join(guideDir(channel, root), file);
  return existsSync(p) ? readFile(p, "utf8") : null;
};
