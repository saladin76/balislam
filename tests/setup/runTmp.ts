/**
 * مجلد مؤقت واحد لكل تشغيل اختبارات (سلامة الاختبارات، ٨ نوفمبر): كل ما تكتبه الاختبارات في os.tmpdir()
 * (نسخ القنوات، ملفات البيئة، نغمات mp3، فتحات الرندر…) يقع داخله، ويُحذف كله في نهاية التشغيل،
 * ولو تخطّى ملفٌّ afterAll بعد فشل في التحميل. لا يمس شيئًا خارجه في /tmp.
 */
import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

export default function setup() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bal-test-run-"));
  const prev = { TMPDIR: process.env.TMPDIR, TMP: process.env.TMP, TEMP: process.env.TEMP };
  process.env.TMPDIR = dir;
  process.env.TMP = dir;
  process.env.TEMP = dir;
  process.env.BAL_TEST_RUN_TMP = dir;
  return () => {
    rmSync(dir, { recursive: true, force: true });
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    delete process.env.BAL_TEST_RUN_TMP;
  };
}
