import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { approveStoryboard } from "../src/plan/storyboard";
import { approveVoiceScene, approveVoiceEpisode } from "../src/voice/review";
import { assertMotionStartAuthorized } from "../src/voice/motionGate";
import { assertVoiceApproved } from "../src/voice/review";
import { scriptSignoffFile } from "../src/script/approval";
import type { Plan } from "../src/plan/types";

describe("pre-motion human approval safety", () => {
  it("fails closed when no full-episode narration exists to approve", async () => {
    const plan = { chapters: [{ number: 1, title: "Empty voice", scenes: [] }] } as unknown as Plan;
    await expect(assertVoiceApproved(path.join(os.tmpdir(), "not-an-episode", "script.md"), plan, {}))
      .rejects.toThrow(/لا توجد مقاطع تعليق صوتي/);
  });
  it("blocks approved-but-unintegrated manual Quran recordings at the final motion gate", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "studio-unintegrated-quran-"));
    const scriptPath = path.join(dir, "script.md");
    const script = `---
title: "تجربة التلاوة"
domain: psychology
episode: "999"
---
## الفصل 1 · مراجعة
[آية: النجم 39 | وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ]
`;
    try {
      await writeFile(scriptPath, script);
      await writeFile(scriptSignoffFile(scriptPath), JSON.stringify({
        version: 1, sha256: createHash("sha256").update(script).digest("hex"),
        reviewer: "مراجع", note: "راجعت هذا النص والفصل كاملًا", at: new Date().toISOString(),
      }));
      await mkdir(path.join(dir, "recitations"));
      await writeFile(path.join(dir, "recitations", "index.json"), JSON.stringify({
        "53:39": { provider: "manual", approvedAt: "2026-11-07", approvedBy: "مراجع",
          reciter: "قارئ منفصل", rightsEvidence: "وثيقة ترخيص مستقلة", parts: [] },
      }));
      await expect(assertMotionStartAuthorized(scriptPath, {
        chapters: [{ number: 1, title: "مراجعة", scenes: [{
          id: "c1-s1", template: "verse-card", ayahKey: "53:39",
          props: { text: "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ" }, narration: "", sfx: [],
        }] }],
      } as unknown as Plan, {})).rejects.toThrow(/غير موصول|تغيّر/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("rejects forged or stale verse cards instead of trusting a separate script approval", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "studio-stale-verse-plan-"));
    const scriptPath = path.join(dir, "script.md");
    const source = `---
title: "آية معتمدة"
domain: psychology
episode: "999"
---
## الفصل 1 · اختبار
[آية: النجم 39 | وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ]
`;
    try {
      await writeFile(scriptPath, source);
      await writeFile(scriptSignoffFile(scriptPath), JSON.stringify({
        version: 1, sha256: createHash("sha256").update(source).digest("hex"),
        reviewer: "مراجع", note: "فحص السكريبت والمصادر يدويًا", at: new Date().toISOString(),
      }));
      const plan = { chapters: [{ number: 1, title: "اختبار", scenes: [{
        id: "c1-s1", template: "verse-card", ayahKey: "53:39",
        props: { text: "نص آية مستبدل" }, narration: "", sfx: [],
      }] }] } as unknown as Plan;
      await expect(assertMotionStartAuthorized(scriptPath, plan, {})).rejects.toThrow(/بطاقة آية/);
      plan.chapters[0]!.scenes = [];
      await expect(assertMotionStartAuthorized(scriptPath, plan, {})).rejects.toThrow(/دون بطاقة/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it("requires separate storyboard and full-episode voice decisions, and rechecks audio bytes", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "studio-final-motion-gate-"));
    const scriptPath = path.join(dir, "script.md");
    const voiceDir = path.join(dir, "voice");
    const scene = { id: "c1-s1", template: "noor-text", line: 8,
      narration: "تعليق تجريبي", tone: "calm", sfx: [], props: { text: "اختبار المراجعة" } };
    const plan = { chapters: [{ number: 1, title: "الاختبار", scenes: [scene] }] } as unknown as Plan;
    const voice = { "c1-s1": { file: "clip.mp3", text: scene.narration,
      duration: 1.2, hash: "test-hash", words: [] } };
    try {
      await mkdir(voiceDir);
      await writeFile(scriptPath, `---
title: "اختبار"
domain: psychology
episode: "999"
---
## الفصل 1 · تجربة
نص تعليق دون آيات.
`);
      execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=430:duration=1.2",
        "-c:a", "libmp3lame", path.join(voiceDir, "clip.mp3")]);
      await expect(assertMotionStartAuthorized(scriptPath, plan, voice)).rejects.toThrow();
      await writeFile(scriptSignoffFile(scriptPath), JSON.stringify({
        version: 1, sha256: createHash("sha256").update(await (await import("node:fs/promises")).readFile(scriptPath, "utf8")).digest("hex"),
        reviewer: "مراجع", note: "مراجعة كاملة للسكريبت مع اعتماد مستقل", at: new Date().toISOString(),
      }));
      await approveStoryboard(scriptPath, plan, { note: "راجعت اللوحة الاختبارية بصريًا قبل اعتماد الصوت الكامل" });
      await expect(assertMotionStartAuthorized(scriptPath, plan, voice)).rejects.toThrow(/اعتماد|الصوت/);
      await approveVoiceScene(scriptPath, plan, voice, "c1-s1", "مراجع", "استمعت للمقطع بعناية وراجعت مخارجه", true);
      await expect(assertMotionStartAuthorized(scriptPath, plan, voice)).rejects.toThrow(/الحلقة|كامل/);
      await approveVoiceEpisode(scriptPath, plan, voice, "مراجع", "استمعت إلى كل التسجيل بالترتيب الطبيعي وأوافق على بدء الحركة", true);
      await expect(assertMotionStartAuthorized(scriptPath, plan, voice)).resolves.toBe(true);
      await writeFile(path.join(voiceDir, "clip.mp3"), "BROKEN");
      await expect(assertMotionStartAuthorized(scriptPath, plan, voice)).rejects.toThrow();
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
