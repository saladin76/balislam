/**
 * KI-056 (found by the Playwright journey, work ٤): with every scene approved, step ٣ «الوصلات» said
 * «كل المشاهد معتمدة: اجمعها في نسخة واحدة…» with NO button, and «النسخة الأساسية» only sent back to «الوصلات»:
 * the owner could not assemble the episode from the page at all («دمج المشاهد للمراجعة» was unreachable).
 * The explanation keeps its one button (D99/D102): when the scenes can be assembled, it is «دمج المشاهد للمراجعة».
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { panelSource } from "./helpers/panelSource";

const ui = panelSource("app/src/workspace/SceneProductionPanel.tsx");

describe("KI-056: step ٣ «الوصلات» before the assembly offers «دمج المشاهد للمراجعة» when every scene is approved", () => {
  it("the explanation's one button assembles the approved scenes", () => {
    const at = ui.indexOf("<h3>الوصلات تُسمع بعد التجميع</h3>");
    expect(at).toBeGreaterThan(0);
    const block = ui.slice(at, ui.indexOf("</section>", at));
    expect(block, "a button that assembles").toMatch(/data\.progress\.canAssemble\s*\n?\s*\?\s*<button[^>]*onClick=\{\(\) => void assembleScenes\(\)\}/);
    expect(block).toContain("دمج المشاهد للمراجعة");
  });
});
