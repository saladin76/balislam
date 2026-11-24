/**
 * بوابة المحتوى تفحص الخطة كما يقرؤها الاستوديو: نص الآية لا يُخزَّن في plan.json (stripQuran) بل يُدمج من السكريبت
 * المجاور (readPlanFile). فبطاقة آية نصها في السكريبت لا تُرفض «بنص مؤقت»، وبطاقة بلا نص في السكريبت تُرفض كما كانت.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repo = path.resolve(__dirname, "..");
const plan = { version: 1, channel: "balislam", chapters: [{ number: 1, title: "", scenes: [{ id: "c1-s1", template: "verse-card", ayahKey: "2:42", narration: "", props: { text: "", reference: "البقرة · ٤٢" } }] }] };
const script = (verse: string) => `---\nepisode: "001"\ntitle: "تجربة"\n---\n\nجملة قبل الآية.\n\n${verse}\n\nجملة بعدها.\n`;

describe("بوابة المحتوى: الخطة بنصوص آيات السكريبت", () => {
  it("بطاقة آية نصها في السكريبت تمر، وبلا نص فيه تُرفض «بنص مؤقت»", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "cg-verse-"));
    try {
      const rel = "channels/balislam/episodes/001-x/plan.json";
      mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
      writeFileSync(path.join(root, rel), JSON.stringify(plan));
      const gate = () => {
        try { return execFileSync(path.join(repo, "node_modules", ".bin", "tsx"), [path.join(repo, "scripts", "contentGate.mts"), rel], { cwd: root, encoding: "utf8", stdio: "pipe" }); }
        catch (e) { return String((e as { stderr?: string; stdout?: string }).stderr) + String((e as { stdout?: string }).stdout); }
      };
      writeFileSync(path.join(root, path.dirname(rel), "script.md"), script("[آية: البقرة 42 | وَلَا تَلْبِسُوا۟ ٱلْحَقَّ بِٱلْبَـٰطِلِ وَتَكْتُمُوا۟ ٱلْحَقَّ وَأَنتُمْ تَعْلَمُونَ]"));
      expect(gate()).not.toMatch(/بنص مؤقت/);
      writeFileSync(path.join(root, path.dirname(rel), "script.md"), script("[آية: البقرة 42]"));
      expect(gate()).toMatch(/بنص مؤقت/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60_000);
});
