import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseScript } from "../src/script/parse";
import { quranFromScript, historicalMeanings } from "../src/quran/scriptText";
import { readPlanFile } from "../src/plan/io";
import { reviewItems, type ReviewLedger } from "../src/script/review";
import { verifiedOwnRecitations } from "../src/quran/manualAudio";
import { alignDiff } from "../src/quran/audit";
import type { Plan } from "../src/plan/types";

const verse = "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ";
const makeScript = (text: string) => `---
title: "اختبار بدون نشر"
domain: psychology
episode: "999"
---
## الفصل 1 · اختبار
[آية: النجم 39 | ${text}]

## الاستشهادات
- آية | النجم 39 | المصحف المعتمد
`;
const sha = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");

describe("Quran script-first text, review and historical meanings", () => {
  it("retains exact author text and makes every tashkeel difference reviewable", () => {
    const parsed = parseScript(makeScript(verse));
    const extracted = quranFromScript(parsed);
    expect(extracted.texts["53:39"]).toBe(verse);
    expect(extracted.problems).toEqual([]);
    const ops = alignDiff(extracted.texts["53:39"]!, verse.replace("وَأَنْ", "وَأَنِ"));
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.some((op) => op.cls === "haraka")).toBe(true);
  });

  it("invalidates human citation approval after editing only a Quranic diacritic", () => {
    const item = reviewItems(parseScript(makeScript(verse)), null)[0]!;
    const ledger: ReviewLedger = { version: 1, items: {
      [item.key]: { status: "verified", hash: item.hash, ref: item.ref, at: "2026-11-01T00:00:00Z" },
    } };
    expect(reviewItems(parseScript(makeScript(verse)), ledger)[0]?.status).toBe("verified");
    expect(reviewItems(parseScript(makeScript(verse.replace("وَأَنْ", "وَأَنِ"))), ledger)[0]?.status).toBe("changed");
  });

  it("never allows old quran.json verses to override the script, nor new channel attribution to rewrite historical translations", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "script-quran-plan-"));
    const scriptPath = path.join(dir, "script.md");
    const plan: Plan = { chapters: [{ number: 1, title: "اختبار", scenes: [{
      id: "c1-s1", template: "verse-card", ayahKey: "53:39",
      narration: "", line: 7, sfx: [], props: { text: "نص قديم", reference: "النجم 39", meaningSource: "المترجم التاريخي" },
    }] }] } as unknown as Plan;
    try {
      await writeFile(scriptPath, makeScript(verse));
      await writeFile(path.join(dir, "plan.json"), JSON.stringify(plan));
      await writeFile(path.join(dir, "quran.json"), JSON.stringify({
        "53:39": "هذا ليس نص السكريبت", "53:39#meaning": "معنى تاريخي",
      }));
      const rendered = await readPlanFile(scriptPath);
      expect(rendered?.chapters[0]?.scenes[0]?.props.text).toBe(verse);
      expect(rendered?.chapters[0]?.scenes[0]?.props.meaning).toBe("معنى تاريخي");
      expect(rendered?.chapters[0]?.scenes[0]?.props.meaningSource).toBe("المترجم التاريخي");
      await writeFile(scriptPath, makeScript(verse.replace("وَأَنْ", "وَأَنِ")));
      expect((await readPlanFile(scriptPath))?.chapters[0]?.scenes[0]?.props.text).not.toBe(verse);
      expect(historicalMeanings({ "53:39": "forbidden", "53:39#meaning": "saved" })["53:39"]).toBeUndefined();
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

describe("local approved Quran recordings are bound to script text and real playable files", () => {
  it("rejects modified text and corrupt audio without touching the historical approval file", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "quran-script-recitation-"));
    const scriptPath = path.join(dir, "script.md");
    const recitations = path.join(dir, "recitations");
    const name = "manual-53-39-abcdef123456.mp3";
    const file = path.join(recitations, name);
    try {
      await mkdir(recitations);
      await writeFile(scriptPath, makeScript(verse));
      execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=420:duration=1.2",
        "-c:a", "libmp3lame", file]);
      const bytes = await readFile(file);
      const approved = { "53:39": {
        provider: "manual", reciter: "قارئ مسموح بنشره", rightsEvidence: "https://rights.example.com/permission",
        parts: [{ file: name, duration: 1.2 }], fetchedAt: "2026-11-01", approvedAt: "2026-11-02",
        approvedBy: "مراجع شرعي", reviewNote: "استمعت إلى المقطع كاملًا وراجعت الإذن والنطق", sha256: sha(bytes), textSha256: sha(verse),
      } };
      const indexFile = path.join(recitations, "index.json");
      await writeFile(indexFile, JSON.stringify(approved));
      expect(Object.keys(await verifiedOwnRecitations(scriptPath))).toEqual(["53:39"]);
      await writeFile(scriptPath, makeScript(verse.replace("وَأَنْ", "وَأَنِ")));
      expect(await verifiedOwnRecitations(scriptPath)).toEqual({});
      await writeFile(scriptPath, makeScript(verse));
      expect(Object.keys(await verifiedOwnRecitations(scriptPath))).toEqual(["53:39"]);
      await writeFile(file, "corrupt MP3 with no sound");
      expect(await verifiedOwnRecitations(scriptPath)).toEqual({});
      expect(JSON.parse(await readFile(indexFile, "utf8"))).toEqual(approved);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
