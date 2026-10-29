/**
 * معاينة سريعة لفئة أو أكثر دون المرور بالسجل الكامل (للرسم المتوازي):
 *   npx tsx src/elements/preview.tsx <out.html> <category...> [--characters]
 * تُخرج صفحة فيها كل عنصر في الثيمات الأربعة، صفًّا لكل ثيم.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { themeIds, themes } from "../../brand/themes";
import { elementPalettes } from "../../brand/elements/palette";
import type { ElementDef } from "../../brand/elements/types";

const [out, ...rest] = process.argv.slice(2);
if (!out) throw new Error("usage: preview.tsx <out.html> <category...> [--characters]");
const cats = rest.filter((a) => !a.startsWith("--"));
const withChars = rest.includes("--characters");

const cells: string[] = [];
for (const c of cats) {
  const mod = (await import(path.resolve(import.meta.dirname, "../../brand/elements/categories", `${c}.tsx`))) as { elements: ElementDef[] };
  const ids = new Set<string>();
  for (const el of mod.elements) {
    if (ids.has(el.id)) throw new Error(`duplicate id ${el.id}`);
    ids.add(el.id);
  }
  for (const t of themeIds) {
    const p = elementPalettes[t];
    const row = mod.elements
      .map((el) => {
        if (el.kind === "backdrop") {
          const land = renderToStaticMarkup(<svg viewBox="0 0 1920 1080" width={480} height={270}>{el.draw(p, { w: 1920, h: 1080 })}</svg>);
          const port = renderToStaticMarkup(<svg viewBox="0 0 1080 1920" width={152} height={270}>{el.draw(p, { w: 1080, h: 1920 })}</svg>);
          return `<figure style="display:flex;gap:6px;flex-direction:column"><div style="display:flex;gap:6px">${land}${port}</div><figcaption>${el.id}</figcaption></figure>`;
        }
        const svg = renderToStaticMarkup(<svg viewBox="0 0 120 120" width={110} height={110} style={{ overflow: "visible" }}>{el.draw(p, { w: 120, h: 120 })}</svg>);
        return `<figure>${svg}<figcaption>${el.id}</figcaption></figure>`;
      })
      .join("");
    cells.push(`<h2>${c} · ${t}</h2><div class="row" style="background:${themes[t].colors.bg};color:${themes[t].colors.ink}">${row}</div>`);
  }
}
if (withChars) {
  const { Character, characterVariants, characterPoses } = await import("../../characters/Character");
  for (const t of themeIds) {
    const row = characterVariants
      .flatMap((v) =>
        characterPoses.map(
          (pose) => `<figure>${renderToStaticMarkup(<Character theme={themes[t]} variant={v} pose={pose} height={170} />)}<figcaption>${v}/${pose}</figcaption></figure>`,
        ),
      )
      .join("");
    cells.push(`<h2>characters · ${t}</h2><div class="row" style="background:${themes[t].colors.bg};color:${themes[t].colors.ink}">${row}</div>`);
  }
}
await writeFile(
  out,
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;font:12px monospace;background:#ddd}h2{margin:8px 12px;font-size:14px}.row{display:flex;flex-wrap:wrap;gap:10px;padding:14px}figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:4px;width:auto}figcaption{font-size:11px;opacity:.75}</style>${cells.join("")}`,
);
console.log(`preview written: ${out}`);
