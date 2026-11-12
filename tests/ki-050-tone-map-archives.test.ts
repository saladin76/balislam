import { describe, expect, it } from "vitest";
import { isOwnerContentPath } from "../scripts/contentPaths.mjs";
import { commitMessage } from "../app/server/contentSync";
import { archiveNameFor } from "../src/voice/toneMapOverride";

/**
 * KI-050 (D113): تغيير نبرة جملة يرفع خريطة النبرة إلى إصدار جديد ويحفظ السابق باسمه (tone-map.v1.9.json)،
 * و`previous` في tone-map.json يشير إليه. الحفظ الآلي (D101) كان يرفع tone-map.json وحده، فبقي main يشير إلى
 * ملف ليس فيه. نسخ الإصدارات السابقة محتوى مالك يُرفع معها.
 */
const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";

describe("KI-050: نسخ خريطة النبرة السابقة تُحفظ في main مع الجديدة", () => {
  it("اسم النسخة الذي يكتبه الاستوديو محتوى مالك، لكل شكل إصدار", () => {
    for (const v of ["v1", "v1.9", "v1.10", "v2", "v12.3.4"])
      expect(isOwnerContentPath(`${EP}/${archiveNameFor(v)}`), v).toBe(true);
  });
  it("ما يشبه الاسم وليس نسخة لا يُرفع", () => {
    for (const f of [`${EP}/tone-map.v1.9.json.tmp`, `${EP}/tone-map.v1.9.json.write.lock`, `${EP}/tone-map.vx.json`,
      `${EP}/tone-map.v1.9.backup.json`, `${EP}/voice/tone-map.v1.9.json`, `${EP}/tone-map.v.json`, `${EP}/sub/tone-map.v1.json`])
      expect(isOwnerContentPath(f), f).toBe(false);
  });
  it("رسالة الحفظ تسميها «نسخة خريطة النبرة السابقة»", () => {
    expect(commitMessage([`${EP}/tone-map.json`, `${EP}/tone-map.v1.9.json`])).toContain("دفاتر الزمن 001: خريطة النبرة، نسخة خريطة النبرة السابقة");
  });
});
