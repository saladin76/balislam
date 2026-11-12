import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CAPTION_PLATE_ALPHA, TopCaption } from "../src/remotion/illus/TopCaption";
import { ID } from "../src/remotion/illus/palette";
import { estimateTimings } from "../src/remotion/scenes/timing";

/**
 * التوجيه 033 (المسار B): مقروئية سطر الكلام العلوي في العمودي فوق الخلفيات المضيئة.
 * لوح من ليل القناة خلف السطر وحده في العمودي، والأفقي كما كان حرفًا، والمكوّن لقوالب «بالإسلام» وحدها.
 */
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const over = (top: string, a: number, bottom: string) =>
  "#" + [1, 3, 5].map((k) => Math.round(parseInt(top.slice(k, k + 2), 16) * a + parseInt(bottom.slice(k, k + 2), 16) * (1 - a)).toString(16).padStart(2, "0")).join("");
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};
const timings = estimateTimings("ورآها تشد صفحة أخرى فتمزقها عند النافذة المضيئة.", 6, 160);
const render = (portrait: boolean, Comp: React.FC<any> = TopCaption) => renderToStaticMarkup(<Comp frame={120} fps={30} timings={timings} keys={["النافذة"]} portrait={portrait} />);

describe("سطر الكلام العلوي في العمودي (033)", () => {
  it("اللوح (0.78، وأقل قدر يكفي 0.76) يعطي النص الورقي ولون الفجر للكلمة المفتاحية تباينًا 4.5:1 على الأقل فوق كل ألوان الهوية، حتى أفتحها", () => {
    for (const bg of [ID.paper, ID.dawn, ID.copper, ID.seal, ID.night]) {
      const plate = over(ID.night, CAPTION_PLATE_ALPHA, bg);
      expect(contrast(ID.paper, plate), `paper over ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(ID.dawn, plate), `dawn over ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    // وبلا لوح كان النص الورقي فوق الورق أو الفجر غير مقروء: هذا ما أصلحه اللوح
    expect(contrast(ID.paper, ID.dawn)).toBeLessThan(2);
  });
  it("اللوح في العمودي وحده، بحجم السطر لا بعرض الإطار، ومن ليل القناة", () => {
    const p = render(true);
    expect(p).toContain(`data-caption-plate="${CAPTION_PLATE_ALPHA}"`);
    expect(p).toMatch(/background:rgba\(11, 31, 28, 0\.78\)/);
    expect(render(false)).not.toContain("data-caption-plate");
  });
  it("الأفقي كما كان حرفًا (يطابق رسم المكوّن قبل 033)", async () => {
    const tmp = path.join(process.cwd(), "src/remotion/illus/__TopCaption_before_033.tsx");
    const before = fs.readFileSync(path.join(process.cwd(), "tests/fixtures/TopCaption.before-033.tsx.txt"), "utf8");
    fs.writeFileSync(tmp, before);
    try {
      const { TopCaption: Old } = await import(tmp);
      expect(render(false)).toBe(render(false, Old));
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });
  it("المكوّن لقوالب «بالإسلام» وحدها: لا يستورده قالب لقناة أخرى", () => {
    const users = fs.readdirSync("src/remotion/scenes").filter((f) => fs.readFileSync(path.join("src/remotion/scenes", f), "utf8").includes("illus/TopCaption"));
    expect(users.sort()).toEqual(["AlleyTale.tsx", "DuaBoard.tsx", "LightStage.tsx", "RoadJourney.tsx"]);
    for (const ch of ["dafatir-alzaman", "zubdat-alkutub"]) {
      const dir = path.join("channels", ch, "episodes");
      for (const ep of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
        const plan = path.join(dir, ep, "plan.json");
        if (fs.existsSync(plan)) expect(fs.readFileSync(plan, "utf8"), `${ch}/${ep}`).not.toMatch(/"template": "(alley-tale|dua-board|light-stage|road-journey)"/);
      }
    }
  });
});
