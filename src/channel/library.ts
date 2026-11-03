import { elementLibrary } from "../../brand/elements/registry";
import type { ElementCategory } from "../../brand/elements/types";
import { sets } from "../../brand/sets/index";
import { templateDefs } from "../plan/templates";
import { templateMeta } from "../plan/templateMeta";
import type { ChannelConfig } from "./types";

/**
 * مكتبة كل قناة: مصدر واحد لما يجوز لكل قناة أن تستعمله من القوالب وأماكن التصوير والعناصر والشخصيات.
 * يعتمد عليه تبويب «المكتبة» في الاستوديو، واختيار الرسمات الآلي عند توليد الخطة، وفحص الخطة قبل الرندر،
 * فلا يتسرب عنصر من قناة إلى أخرى (مثلًا: لا رموز دينية في زبدة الكتب، ولا وجوه في بالإسلام).
 *
 * القاعدة مبنية على قواعد القناة (rules) لا على اسمها، فتعمل لأي قناة جديدة:
 * - الرموز الدينية والزخرفة الإسلامية: للقنوات التي تستشهد بالقرآن أو الحديث.
 * - إطار الآية وبطاقتها: لمن تستشهد بالقرآن. إطار الحديث وبطاقته: لمن تستشهد بالحديث.
 * - الشخصيات بملامح (الشخصيات التاريخية): لمن تسمح بالوجوه. الشخصيات بلا ملامح للجميع.
 * - القوالب التخصصية (only في templateMeta) وأماكن التصوير (channels في brand/sets): بقائمة القنوات المذكورة معها.
 */
export type LibraryRules = Pick<ChannelConfig, "id"> & { rules: Pick<ChannelConfig["rules"], "faces" | "quran" | "hadith"> };

/** عناصر دينية خارج فئة «رموز إسلامية» */
const RELIGIOUS_IDS = new Set(["hands-dua", "arch-frame", "star-pattern-tile", "girih-tile", "arabesque-border", "courtyard-arches", "mosque-exterior"]);
const RELIGIOUS_CATEGORIES = new Set<ElementCategory>(["islamic"]);

export type ExcludeReason = "religious" | "quran" | "hadith" | "faces" | "channel";
export const excludeReasonAr: Record<ExcludeReason, string> = {
  religious: "رمز ديني لقناة لا تستشهد بالقرآن ولا بالحديث",
  quran: "القناة لا تستشهد بالقرآن",
  hadith: "القناة لا تستشهد بالحديث",
  faces: "القناة بلا وجوه",
  channel: "خاص بقناة أخرى",
};

const religious = (r: LibraryRules["rules"]) => r.quran || r.hadith;

/** سبب استبعاد عنصر عن القناة، أو null إن كان من مكتبتها */
export const elementExclusion = (ch: LibraryRules, id: string, category?: ElementCategory): ExcludeReason | null => {
  const cat = category ?? elementLibrary.find((e) => e.id === id)?.category;
  if (id === "verse-frame") return ch.rules.quran ? null : "quran";
  if (id === "hadith-frame") return ch.rules.hadith ? null : "hadith";
  if ((RELIGIOUS_IDS.has(id) || (cat && RELIGIOUS_CATEGORIES.has(cat))) && !religious(ch.rules)) return "religious";
  return null;
};

export const templateExclusion = (ch: LibraryRules, id: string): ExcludeReason | null => {
  if (id === "verse-card" && !ch.rules.quran) return "quran";
  if (id === "hadith-card" && !ch.rules.hadith) return "hadith";
  const only = templateMeta[id]?.only;
  if (only && !only.includes(ch.id)) return "channel";
  return null;
};

export const setExclusion = (ch: LibraryRules, id: string): ExcludeReason | null => {
  const s = sets.find((x) => x.id === id);
  return s?.channels?.length && !s.channels.includes(ch.id) ? "channel" : null;
};

/** الشخصيات التاريخية بملامح الوجه */
export const figuresAllowed = (ch: LibraryRules) => ch.rules.faces;

/** مكتبة القناة كاملة (للاستوديو والاختبارات) */
export const channelLibrary = (ch: LibraryRules) => ({
  templates: templateDefs.filter((t) => !templateExclusion(ch, t.id)).map((t) => t.id),
  sets: sets.filter((s) => !setExclusion(ch, s.id)).map((s) => s.id),
  elements: elementLibrary.filter((e) => !elementExclusion(ch, e.id, e.category)).map((e) => e.id),
  figures: figuresAllowed(ch),
});

/** يقبل الرسمة إن كانت من مكتبة القناة (person/people للجميع) */
export const drawAllowed = (ch: LibraryRules) => (id: string) => id.startsWith("person") || id === "people" || !elementExclusion(ch, id);
