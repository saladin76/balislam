import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { at, end } from "../src/remotion/dafatir/horizon/timeline";
import { ARCHIVE_COLORS, ARCHIVE_LAB_FPS, ARCHIVE_LAB_SENTENCES, START, archiveLabFrames, archiveLabTimeline, archiveStations, writtenTokens } from "../src/remotion/dafatir/archive/ArchiveLab";
import { deskCamAt, inkAt, repeatedNeighbours, shadowOf, stampAt } from "../src/remotion/dafatir/archive/desk";
import { APPROVED_IDENTITIES } from "../brand/identity/approved";

const tl = archiveLabTimeline();
const keys = archiveStations(tl);

describe("«اللوح – خزانة الأرشيف» (D185)", () => {
  it("كل حدث عند كلمة منطوقة، والمحطات بالترتيب بلا تداخل", () => {
    for (const w of ["سنة", "وأربعين", "للهجرة", "بدأ", "بغداد", "دجلة", "مدينة"]) expect(() => at(tl, w)).not.toThrow();
    expect(() => end(tl, "دجلة")).not.toThrow();
    for (let i = 1; i < keys.length; i++) expect(keys[i]!.a).toBeGreaterThanOrEqual(keys[i - 1]!.b - 1e-9);
    expect(archiveLabFrames() / ARCHIVE_LAB_FPS).toBeGreaterThan(tl.end + 1);
  });

  it("قرار المالك ٣: لا محطتان متتاليتان بالتكوين نفسه، وأربع لقطات مختلفة على الأقل", () => {
    const seq = [START, ...keys];
    expect(repeatedNeighbours(seq)).toEqual([]);
    expect(new Set(seq.map((s) => s.shot)).size).toBeGreaterThanOrEqual(4);
  });

  it("لا سكون للكاميرا أطول من ثانيتين بلا كتابة (القاعدة الثانية)", () => {
    const busy = [...keys.map((k) => [k.a, k.b] as const), ...tl.words.map((w) => [w.s, w.e + 0.3] as const)].sort((a, b) => a[0] - b[0]);
    let reach = 0.4;
    for (const [a, b] of busy) {
      expect(a - reach).toBeLessThan(2);
      reach = Math.max(reach, b);
    }
    expect(archiveLabFrames() / ARCHIVE_LAB_FPS - reach).toBeLessThan(2);
  });

  it("الكاميرا حتمية ومستمرة: لا قفزة بين إطارين متتاليين (أقل من ١٦٠ بكسلًا على الشاشة في الإطار)", () => {
    let prev = deskCamAt(0, START, keys);
    for (let f = 1; f < archiveLabFrames(); f++) {
      const c = deskCamAt(f / ARCHIVE_LAB_FPS, START, keys);
      expect(Math.hypot(c.x - prev.x, c.y - prev.y) * Math.max(c.z, prev.z)).toBeLessThan(160);
      expect(Math.abs(Math.log(c.z / prev.z))).toBeLessThan(0.08);
      // لا يتجمد الكادر أبدًا: بين محطتين تنجرف الكاميرا (مقياس التفاعلية من A)
      expect(c.x !== prev.x || c.y !== prev.y || c.z !== prev.z).toBe(true);
      prev = c;
    }
    expect(deskCamAt(4.2, START, keys)).toEqual(deskCamAt(4.2, START, keys));
  });

  it("الحبر يُكتب مع النطق ثم يجف، والختم يُضغط بعد كلمته لا قبلها", () => {
    expect(inkAt(1, 2, 3)).toEqual({ write: 0, wet: 1 });
    expect(inkAt(3, 2, 3).write).toBe(1);
    expect(inkAt(4.5, 2, 3).wet).toBe(0);
    expect(stampAt(1.9, 2).ink).toBe(0);
    expect(stampAt(2.2, 2).ink).toBe(1);
  });

  it("الظل من ضوء نافذة واحد: كلما ارتفعت الوثيقة طال ظلها ونعم، في الاتجاه نفسه", () => {
    const [a, b] = [shadowOf(0), shadowOf(2)];
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.blur).toBeGreaterThan(a.blur);
    expect(Math.sign(a.x)).toBe(Math.sign(b.x));
    expect(Math.sign(a.y)).toBe(Math.sign(b.y));
  });

  it("السجل يكتب النص كما كُتب (بتشكيله وترقيمه)، كلمة لكل كلمة توقيت", () => {
    expect(writtenTokens()).toHaveLength(tl.words.length);
    expect(writtenTokens()).toContain("وسمّاها");
    expect(ARCHIVE_LAB_SENTENCES.join(" ")).toContain("مدينة السلام");
  });

  it("الألوان من هوية «دفتر الأفق» المعتمدة وحدها", () => {
    const a = APPROVED_IDENTITIES["dafatir-alzaman"]!;
    const ok = new Set([...a.palette.map((p) => p.hex), ...a.signature, ...a.derived].map((x) => x.toUpperCase()));
    expect(Object.values(ARCHIVE_COLORS).filter((c) => !ok.has(c.toUpperCase()))).toEqual([]);
  });

  it("قرار المالك (٢١ نوفمبر): لا أدوات القوالب الشائعة في ملفات القالب", () => {
    const dir = "src/remotion/dafatir/archive";
    const banned: [RegExp, string][] = [
      [/boxShadow|textShadow|drop-shadow/, "ظل CSS الجاهز أو الوهج"],
      [/backdrop-?[Ff]ilter/, "بطاقة زجاجية"],
      [/\bInter\b|Poppins/, "خطوط Inter/Poppins"],
      [/particle|sparkle|lens.?flare|glow/i, "جسيمات أو لمعة أو وهج"],
      [/spring\(|bounce/i, "كلام قافز"],
      [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, "إيموجي أو أيقونة جاهزة"],
      [/@remotion\/transitions/, "انتقال جاهز"],
    ];
    const hits = readdirSync(dir).flatMap((f) => {
      const src = readFileSync(`${dir}/${f}`, "utf8");
      return banned.filter(([re]) => re.test(src)).map(([, why]) => `${f}: ${why}`);
    });
    expect(hits).toEqual([]);
  });
});
