import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isSacredSentence } from "../src/plan/sceneCues";

// «بالإسلام 001» shortened to ~5 minutes (owner, 18–19 Nov): the plan is rebuilt from the scenes already designed —
// a scene whose text is still in the script keeps its id and its design; the rest take the nearest design.
const E = path.join(import.meta.dirname, "..", "channels/balislam/episodes/001-know-the-truth");
type S = { id: string; template: string; narration: string; props: Record<string, unknown> };
const scenes = (f: string): S[] => JSON.parse(readFileSync(path.join(E, f), "utf8")).chapters.flatMap((c: { scenes: S[] }) => c.scenes);
const live = scenes("plan.json");
const before = new Map(scenes("versions/2026-11-19-before-5min/plan.json").map((s) => [s.id, s]));

describe("بالإسلام 001 — the short plan", () => {
  it("says what the script says: no scene differs, no script line without a scene", async () => {
    const { scriptTextDivergence } = await import("../src/plan/scriptSync");
    const { runWithChannel } = await import("../src/channel");
    const d = await runWithChannel("balislam", () => scriptTextDivergence(path.join(E, "script.md"), JSON.parse(readFileSync(path.join(E, "plan.json"), "utf8"))));
    expect(d).toEqual({ scenes: [], unplaced: [] });
  });
  it("is shorter than the 163-scene design, with unique ids", () => {
    expect(live.length).toBeLessThan(before.size / 2);
    expect(new Set(live.map((s) => s.id)).size).toBe(live.length);
  });
  it("reverence: a sentence with God's name, a dua or a verse has no gesture, no shot, nothing in the hand", () => {
    for (const s of live.filter((x) => x.template === "alley-tale" && isSacredSentence(x.narration))) {
      expect(s.props.cues ?? "", s.id).toBe("");
      expect(s.props.shot ?? "", s.id).toBe("");
      expect(String(s.props.poses ?? ""), s.id).not.toMatch(/hold/);
    }
  });
  it("a scene kept from the 163-scene design keeps its design exactly (the owner reviewed it)", () => {
    const kept = live.filter((s) => before.has(s.id));
    expect(kept.length).toBeGreaterThan(live.length / 2);
    for (const s of kept) {
      expect(s.template, s.id).toBe(before.get(s.id)!.template);
      expect(s.props, s.id).toEqual(before.get(s.id)!.props);
    }
  });
});
