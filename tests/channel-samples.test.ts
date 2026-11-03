import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { channelSamples } from "../src/remotion/scenes/channelSamples";
import { channelLibrary, type LibraryRules } from "../src/channel/library";

const ch = (id: string): LibraryRules => JSON.parse(readFileSync(`channels/${id}/channel.json`, "utf8"));

describe("نماذج معاينة القوالب لكل قناة", () => {
  it("نماذج كل قناة من قوالبها وعناصرها فقط، وبلا محتوى قناة أخرى", () => {
    for (const [id, samples] of Object.entries(channelSamples)) {
      const lib = channelLibrary(ch(id));
      for (const [tpl, props] of Object.entries(samples)) {
        expect(lib.templates, `${id}/${tpl}`).toContain(tpl);
        for (const k of ["element", "rightElement", "leftElement", "secondElement"]) {
          const el = props[k] as string | undefined;
          if (el) expect(lib.elements, `${id}/${tpl}/${el}`).toContain(el);
        }
        for (const el of String(props.icons ?? "").split(/\s*,\s*/).filter(Boolean)) expect(lib.elements, `${id}/${tpl}/${el}`).toContain(el);
        expect(JSON.stringify(props), `${id}/${tpl}`).not.toMatch(/التأجيل|نؤجّل|نؤجل/);
      }
    }
  });
});
