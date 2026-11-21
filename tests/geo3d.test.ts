import { describe, expect, it } from "vitest";
import { angle, canonicalRing, greatArc, morphRing, partialLine, toLonLat, toV3, type LonLat } from "../src/remotion/scenes/globeSphere";
import { camAt, facing, safeKeys, sacredWindowsOf, type GlobeCam } from "../src/remotion/scenes/globeCamera";
import { assertSourced, borderAt, sourceProblems, type BorderLayer } from "../src/remotion/scenes/globeLayers";
import { screenOf } from "../src/remotion/scenes/globeProject";
import { GLOBE_LAB_FPS, LAB_BORDER, globeLabFrames, globeLabTimeline } from "../src/remotion/dafatir/geo/GlobeLab";
import { DAFATIR_GLOBE } from "../src/remotion/dafatir/geo/look";
import { at } from "../src/remotion/dafatir/horizon/timeline";
import { LIB_SACRED } from "../src/remotion/dafatir/lib/meta";
import { APPROVED_IDENTITIES } from "../brand/identity/approved";

const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe("أداة الخرائط ثلاثية الأبعاد — رياضيات الكرة", () => {
  it("خط الطول والعرض ↔ متجه على الكرة (اصطلاح خامة SphereGeometry)", () => {
    for (const p of [[44.37, 33.31], [-0.13, 51.5], [179, -40], [0, 0]] as LonLat[]) {
      const [lon, lat] = toLonLat(toV3(p));
      close(lon, p[0], 1e-9);
      close(lat, p[1], 1e-9);
    }
    expect(toV3([0, 0])).toEqual([1, 0, -0]);
    close(toV3([90, 0])[2], -1);
    close(toV3([0, 90])[1], 1);
  });

  it("قوس الدائرة العظمى يبدأ وينتهي بالمكانين ونقاطه متساوية البعد", () => {
    const arc = greatArc([39.83, 21.42], [44.37, 33.31], 20);
    expect(arc).toHaveLength(21);
    close(angle(arc[0]!, [39.83, 21.42]), 0, 1e-6);
    close(angle(arc[20]!, [44.37, 33.31]), 0, 1e-6);
    const steps = arc.slice(1).map((p, i) => angle(arc[i]!, p));
    for (const s of steps) close(s, steps[0]!, 1e-6);
  });

  it("الخط يُرسم بنسبة من طوله: لا شيء عند 0، وكله عند 1، ويطول مع النسبة", () => {
    const line = greatArc([30, 30], [60, 35], 30);
    expect(partialLine(line, 0)).toEqual([]);
    expect(partialLine(line, 1)).toEqual(line);
    const len = (pts: LonLat[]) => pts.slice(1).reduce((s, p, i) => s + angle(pts[i]!, p), 0);
    const total = len(line);
    for (const p of [0.25, 0.5, 0.75]) close(len(partialLine(line, p)) / total, p, 1e-6);
  });

  it("تحوّل الحد حتمي: يبدأ على الحد الأول، وينتهي على الثاني، ونفس المدخل يعطي نفس الناتج", () => {
    const [a, b] = [LAB_BORDER.states[0]!.ring, LAB_BORDER.states[1]!.ring];
    expect(morphRing(a, b, 0).slice(0, -1)).toEqual(canonicalRing(a));
    expect(morphRing(a, b, 1).slice(0, -1)).toEqual(canonicalRing(b));
    expect(morphRing(a, b, 0.37)).toEqual(morphRing(a, b, 0.37));
    const r = morphRing(a, b, 0.37);
    expect(r[0]).toEqual(r[r.length - 1]);
  });

  it("الصورة القياسية لا تتأثر باتجاه الرسم ولا بنقطة البداية", () => {
    const ring = LAB_BORDER.states[1]!.ring.slice(0, -1);
    const shifted = [...ring.slice(3), ...ring.slice(0, 3)];
    const reversed = [...ring].reverse();
    const c = canonicalRing([...ring, ring[0]!]);
    for (const other of [canonicalRing([...shifted, shifted[0]!]), canonicalRing([...reversed, reversed[0]!])])
      c.forEach((p, i) => expect(angle(p, other[i]!)).toBeLessThan(0.02));
  });

  it("الحد بين سنتين يُستوفى، وقبل أول سنة وبعد آخرها يثبت", () => {
    const first = borderAt(LAB_BORDER, 700);
    expect(borderAt(LAB_BORDER, 750)).toEqual(first);
    expect(borderAt(LAB_BORDER, 900)).toEqual(borderAt(LAB_BORDER, 762));
    // متصل عند سنة الحالة الأخيرة: لا قفزة بين 761.99 و762
    borderAt(LAB_BORDER, 761.99).forEach((p, i) => expect(angle(p, borderAt(LAB_BORDER, 762)[i]!)).toBeLessThan(0.01));
    expect(borderAt(LAB_BORDER, 756)).not.toEqual(first);
  });
});

describe("كاميرا الكرة", () => {
  const start: GlobeCam = { lon: 0, lat: 0, dist: 4 };
  it("قبل المفتاح الأول البداية، وبعد الأخير هدفه، وخط الطول بأقصر طريق عبر خط التاريخ", () => {
    const keys = [{ a: 1, b: 2, lon: 170, lat: 10, dist: 3 }, { a: 3, b: 4, lon: -170, lat: 10, dist: 2 }];
    expect(camAt(0.5, start, keys)).toEqual(start);
    const end = camAt(5, start, keys);
    close(((end.lon % 360) + 360) % 360, 190);
    close(end.dist, 2);
    // منتصف الانتقال الثاني عند خط التاريخ (180) لا عند 0
    close(((camAt(3.5, start, keys).lon % 360) + 360) % 360, 180, 1e-6);
  });

  it("السكون المقصود: المفتاح المتقاطع مع نافذة ذكر الله يتأخر كله إلى ما بعدها، والمدة كما هي", () => {
    const keys = [{ a: 1, b: 2, lon: 40, lat: 20, dist: 3 }, { a: 2.5, b: 3.5, lon: 44, lat: 33, dist: 2 }];
    const windows = sacredWindowsOf([{ w: "الله", s: 1.6, e: 2.0 }, { w: "بغداد", s: 3, e: 3.4 }], LIB_SACRED);
    expect(windows).toEqual([[1.35, 2.25]]);
    const safe = safeKeys(keys, windows);
    expect(safe[0]).toMatchObject({ a: 2.25, b: 3.25 });
    expect(safe[1]).toMatchObject({ a: 3.25, b: 4.25 });
    for (const k of safe) for (const [s, e] of windows) expect(k.a >= e || k.b <= s).toBe(true);
    // داخل النافذة لا تتحرك الكاميرا
    expect(camAt(1.4, start, safe)).toEqual(camAt(2.2, start, safe));
  });

  it("النقطة المقابلة للكاميرا في وسط الشاشة، والنقطة خلف الأفق غير مرئية", () => {
    const cam: GlobeCam = { lon: 44.37, lat: 33.31, dist: 2.5 };
    const s = screenOf([44.37, 33.31], cam, 1920, 1080, 1);
    close(s.x, 960, 1e-6);
    close(s.y, 540, 1e-6);
    expect(s.visible).toBe(1);
    expect(facing([-135.6, -33.31], cam)).toBeLessThan(0);
    expect(screenOf([-135.6, -33.31], cam, 1920, 1080).visible).toBe(0);
  });
});

describe("«كما حدثت»: لا حد تاريخي بلا مصدر", () => {
  const ok: BorderLayer = { id: "x", label: "س", states: [], source: { label: "مصدر", license: "CC BY 4.0", approximate: false } };
  it("المصدر والترخيص إلزاميان", () => {
    expect(sourceProblems([ok], "production")).toEqual([]);
    expect(sourceProblems([{ ...ok, source: { ...ok.source, license: " " } }], "production")).toHaveLength(1);
    expect(sourceProblems([{ id: "y" }], "lab")).toEqual(["y: بلا مصدر"]);
  });
  it("حد المختبر التجريبي يمر في المختبر ويرفضه الإنتاج", () => {
    expect(() => assertSourced([LAB_BORDER], "lab")).not.toThrow();
    expect(() => assertSourced([LAB_BORDER], "production")).toThrow(/لا يدخل الإنتاج/);
  });
});

describe("نموذج «دفاتر الزمن»: الكرة والحد والمدينة", () => {
  const tl = globeLabTimeline();
  it("كل حدث مربوط بكلمة منطوقة موجودة في النص، والمشهد عشر ثوانٍ على الأقل ويتسع لكلامه", () => {
    for (const w of ["سنة", "دولة", "ثلاث", "بنى", "بغداد", "دجلة"]) expect(() => at(tl, w)).not.toThrow();
    expect(() => at(tl, "سنة", 2)).not.toThrow();
    expect(globeLabFrames() / GLOBE_LAB_FPS).toBeGreaterThanOrEqual(10);
    expect(globeLabFrames() / GLOBE_LAB_FPS).toBeGreaterThan(tl.end + 1);
  });
  it("ألوان الكرة من هوية «دفتر الأفق» المعتمدة وحدها", () => {
    const a = APPROVED_IDENTITIES["dafatir-alzaman"]!;
    const allowed = new Set([...a.palette.map((p) => p.hex), ...a.signature, ...a.derived].map((x) => x.toUpperCase()));
    const used = Object.values(DAFATIR_GLOBE).filter((v): v is string => typeof v === "string");
    expect(used.filter((c) => !allowed.has(c.toUpperCase()))).toEqual([]);
  });
});

describe("لا هوية قناة في المحرك المشترك", () => {
  it("ملفات المحرك (Globe3D وglobe*) بلا ألوان: كل لون يأتي من مظهر القناة في مجلدها", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const dir = "src/remotion/scenes";
    const files = readdirSync(dir).filter((f) => /^(Globe3D\.tsx|globe[A-Z]\w*\.ts)$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(6);
    const hits = files.filter((f) => /#[0-9a-fA-F]{6}\b/.test(readFileSync(`${dir}/${f}`, "utf8")));
    expect(hits).toEqual([]);
  });
});
