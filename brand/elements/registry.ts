import type { ElementDef } from "./types";
import { categoryOrder } from "./types";
import { elements as ui } from "./categories/ui";
import { elements as mind } from "./categories/mind";
import { elements as nature } from "./categories/nature";
import { elements as home } from "./categories/home";
import { elements as daily } from "./categories/daily";
import { elements as city } from "./categories/city";
import { elements as possessions } from "./categories/possessions";
import { elements as life } from "./categories/life";
import { elements as islamicPro } from "./categories/islamic-pro";
import { elements as money } from "./categories/money";
import { elements as knowledge } from "./categories/knowledge";
import { elements as islamic } from "./categories/islamic";
import { elements as hands } from "./categories/hands";
import { elements as frames } from "./categories/frames";
import { elements as backdrops } from "./categories/backdrops";

const all: ElementDef[] = [...ui, ...mind, ...nature, ...home, ...daily, ...city, ...possessions, ...life, ...money, ...knowledge, ...islamic, ...islamicPro, ...hands, ...frames, ...backdrops];

/** كل عناصر المكتبة مرتبة بالفئة. */
export const elementLibrary: ElementDef[] = [...all].sort(
  (a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category),
);

const byId = new Map<string, ElementDef>();
for (const el of elementLibrary) {
  if (byId.has(el.id)) throw new Error(`معرّف عنصر مكرر: ${el.id}`);
  byId.set(el.id, el);
}

export const hasElement = (id: string) => byId.has(id);

export const elementById = (id: string): ElementDef => {
  const el = byId.get(id);
  if (!el) throw new Error(`عنصر غير موجود في المكتبة: ${id}`);
  return el;
};
