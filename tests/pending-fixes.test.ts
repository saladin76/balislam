import { describe, expect, it } from "vitest";
import { formatPendingFix, parsePendingFixes } from "../src/studio/pendingFixes";

// c1-s3 (١٥–١٧ نوفمبر): الإصلاح كُتب في فرع لم يُدمج وبقيت ملاحظة المالك مفتوحة بلا أن يُذكر أن حلها جاهز.
describe("open notes whose fix waits in an unmerged branch", () => {
  const resolved = "channels/balislam/episodes/001-know-the-truth/notes/resolved.json";
  const grep = [
    `origin/fix/balislam-001-c1s3-witness:${resolved}`,
    `origin/fix/balislam-001-c1s3-witness-2:${resolved}`,
    `origin/feat/other:${resolved}`,
    "noise without a colon",
  ].join("\n");
  const hits = (ref: string) => (ref === "origin/feat/other" ? ["n-mentioned-only-elsewhere"] : ["nce96d54edd"]);

  it("names every branch that resolves an open note, without origin/ and without repeats", () => {
    const m = parsePendingFixes(grep, ["nce96d54edd"], hits);
    expect([...m.keys()]).toEqual(["nce96d54edd"]);
    expect(m.get("nce96d54edd")).toEqual(["fix/balislam-001-c1s3-witness", "fix/balislam-001-c1s3-witness-2"]);
  });

  it("ignores branches that resolve other notes, and notes that are not asked about", () => {
    expect(parsePendingFixes(grep, ["some-other-note"], hits).size).toBe(0);
  });

  it("says it in the owner's words under the note", () => {
    expect(formatPendingFix(["fix/a", "fix/b"])).toContain("إصلاحها جاهز ولم يُدمج في main: fix/a، fix/b");
  });
});
