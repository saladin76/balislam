/**
 * لوحة الستوري بورد المرئية للحلقة كاملة (عقد الإنتاج الجديد، المرحلة 1): لقطات ثابتة حقيقية من المحرك
 * لكل مشهد بالاتجاهين (renderStill، لا فيديو)، ثم ملف PDF بترتيب المشاهد، وورقة صور لكل فصل، وبيان بالبصمات.
 * لا تغيّر الخطة ولا الاعتمادات ولا تولّد صوتًا. المخرج: storyboard/<الإصدار>/ بجوار السكريبت، والملفات
 * التي تُسلَّم إلى Drive في storyboard/ مباشرة (أسماء ثابتة لكل خانة) بعد التحقق.
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { loadPlan } from "../plan/io";
import { prepareRenderMedia } from "../plan/collect";
import { sceneFrames } from "../plan/duration";
import { planIssues } from "../plan/validate";
import { sceneHash } from "../plan/sceneReview";
import { boardScenes, type BoardNotes, type BoardScene } from "../plan/storyboardBoard";
import { channelInfo, loadChannel, loadChannelIdentity } from "../channel";
import { resolveScriptPath } from "../script/episodes";
import { projectRoot } from "../config/paths";
import { browserExecutable, getServeUrl } from "./bundle";
import config from "../../config.json";

export type BoardManifest = {
  episode: string;
  title: string;
  version: string;
  createdAt: string;
  status: "PENDING_REVIEW";
  note: string;
  scenes: (BoardScene & { hash: string; images: { landscape: string[]; portrait: string[] } })[];
  files: { path: string; sha256: string; bytes: number; kind: string }[];
};

const sha256 = async (f: string) => createHash("sha256").update(await readFile(f)).digest("hex");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const loadBoardNotes = async (dir: string): Promise<BoardNotes> => {
  const f = path.join(dir, "board-notes.json");
  return existsSync(f) ? (JSON.parse(await readFile(f, "utf8")) as BoardNotes) : {};
};

/** اللقطات الثابتة: لكل مشهد إطاراته المختارة بالاتجاهين، بنصف الدقة (960×540 و540×960) */
export const renderBoardStills = async (o: { episode: string; outDir: string; rows: BoardScene[]; scale?: number; only?: string[]; onProgress?: (done: number, total: number, id: string) => void }) => {
  const plan = (await loadPlan(o.episode))!;
  const media = await prepareRenderMedia(o.episode, plan);
  const serveUrl = await getServeUrl(true);
  const channel = loadChannel();
  const browser = await openBrowser("chrome", { browserExecutable: browserExecutable() });
  const images: Record<string, { landscape: string[]; portrait: string[] }> = {};
  const want = o.only ? o.rows.filter((r) => o.only!.includes(r.id)) : o.rows;
  const total = want.reduce((n, r) => n + r.shots.length * 2, 0);
  let done = 0;
  try {
    for (const orientation of ["landscape", "portrait"] as const) {
      const inputProps = { plan: { ...plan, intro: false }, orientation, media, identity: loadChannelIdentity(), channel: channelInfo(channel) };
      const composition = await selectComposition({ serveUrl, id: `episode-${orientation}`, inputProps, puppeteerInstance: browser });
      for (const r of want) {
        const list: string[] = [];
        for (const f of r.shots) {
          const rel = path.join("frames", orientation, `${r.id}-f${String(f).padStart(3, "0")}.jpg`);
          const out = path.join(o.outDir, rel);
          await mkdir(path.dirname(out), { recursive: true });
          await renderStill({ serveUrl, composition, inputProps, frame: r.start + f, output: out, imageFormat: "jpeg", jpegQuality: 82, scale: o.scale ?? 0.5, overwrite: true, puppeteerInstance: browser });
          list.push(rel);
          o.onProgress?.(++done, total, r.id);
        }
        (images[r.id] ??= { landscape: [], portrait: [] })[orientation] = list;
      }
    }
  } finally {
    await browser.close({ silent: true });
  }
  return images;
};

/** الخطوط: Tajawal بمجموعتيه العربية واللاتينية (unicode-range)، فلا يسقط رقم أو علامة إلى خط بديل في PDF (الأمر 019) */
const AR_RANGE = "U+0600-06FF, U+0750-077F, U+0870-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F";
const LATIN_RANGE = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2190-2193, U+2212, U+2215, U+FEFF, U+FFFD";
const fontCss = () => {
  const f = (n: string) => `file://${path.join(projectRoot, "public", "fonts", n)}`;
  const face = (w: number, file: string, range: string) => `@font-face{font-family:Tajawal;font-weight:${w};src:url(${f(file)});unicode-range:${range}}`;
  return [
    face(400, "Tajawal-arabic-400.woff2", AR_RANGE),
    face(400, "Tajawal-latin-400.woff2", LATIN_RANGE),
    face(700, "Tajawal-arabic-700.woff2", AR_RANGE),
    face(700, "Tajawal-latin-700.woff2", LATIN_RANGE),
    `@font-face{font-family:Plex;font-weight:700;src:url(${f("IBMPlexSansArabic-Bold.ttf")})}`,
    `@font-face{font-family:Plex;font-weight:400;src:url(${f("IBMPlexSansArabic-Medium.ttf")})}`,
    `@font-face{font-family:Ruqaa;font-weight:700;src:url(${f("ArefRuqaa-Bold.ttf")})}`,
    `@font-face{font-family:Mono;src:url(${f("IBMPlexMono-500.woff2")})}`,
  ].join("");
};

/** حالة المشهد مقارنة بإصدار سابق: بصمة الخطة وبايتات كل صورة في اللحظة نفسها (الأمر 019) */
export type SceneChange = { status: "changed" | "same" | "new"; against?: string; reasons: string[] };
type BoardSceneOut = BoardScene & { hash: string; images: { landscape: string[]; portrait: string[] }; change?: SceneChange };

/**
 * صفحات اللوحة (تخطيط v3، الأمر 019): صفحة عريضة لكل مشهد؛ لكل لحظة صورة أفقية وعمودية متجاورتان بالارتفاع نفسه
 * للمقارنة، وصور أكبر، ولوحة تفاصيل جانبية، وشارة «معدّل / دون تغيير / جديد» محسوبة من الملفات لا من الذاكرة.
 */
export const boardHtml = (m: Pick<BoardManifest, "episode" | "title" | "version" | "createdAt" | "note" | "scenes">, imgBase: string, summary: string[]) => {
  const scenes = m.scenes as BoardSceneOut[];
  const chapters = [...new Map(scenes.map((s) => [s.chapter, s.chapterTitle])).entries()];
  const total = scenes.reduce((n, s) => n + s.seconds, 0);
  const li = (xs: string[]) => (xs.length ? `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="muted">—</p>`);
  const badge = (c?: SceneChange) =>
    !c ? "" : c.status === "changed" ? `<span class="chg on">معدّل عن ${esc(c.against ?? "")}</span>` : c.status === "same" ? `<span class="chg off">دون تغيير عن ${esc(c.against ?? "")}</span>` : `<span class="chg new">جديد في هذا الإصدار</span>`;
  const page = (s: BoardSceneOut) => {
    const n = s.shots.length;
    // ارتفاع الزوج حسب عدد اللحظات: لحظتان كبيرتان في عمود، أو شبكة بعمودين
    const h = n <= 2 ? 560 : n <= 4 ? 330 : 300;
    const pair = (i: number) => `<figure class="pair"><div class="pi"><img class="l" style="height:${h}px" src="${imgBase}/${s.images.landscape[i]}"><img class="p" style="height:${h}px" src="${imgBase}/${s.images.portrait[i]}"></div><figcaption>إطار ${s.shots[i]} · أفقي وعمودي في اللحظة نفسها</figcaption></figure>`;
    return `<div class="page sp">
    <header><span class="id">${esc(s.id)}</span><span class="ch">الفصل ${s.chapter} · ${esc(s.chapterTitle)}</span><span class="tag">${esc(s.kind)}</span><span class="tag">${s.seconds} ث تقريبًا</span><span class="tag">${s.order} / ${scenes.length}</span>${s.event ? `<span class="tag event">${esc(s.event)}</span>` : ""}${badge(s.change)}<span class="ver">${esc(m.version)} · ${esc(s.hash)}</span></header>
    <div class="say">${s.narration ? `«${esc(s.narration)}»` : `<span class="muted">بلا تعليق منطوق</span>`}</div>
    <div class="body">
      <div class="shots ${n <= 2 ? "one" : "two"}">${s.shots.map((_, i) => pair(i)).join("")}</div>
      <aside>
        ${s.change && s.change.status === "changed" ? `<h4 class="hot">ما تغيّر</h4>${li(s.change.reasons)}` : ""}
        <h4>التكوين والعناصر والشخصيات</h4>${li(s.composition)}
        <h4>الكاميرا</h4><p>${esc(s.camera)}</p>
        <h4>الانتقال والقطع</h4><p>${esc(s.transition)}</p>
        <h4>النصوص والكابشن</h4><p>${esc(s.captions)}${s.onScreen ? `<br>على الشاشة: ${esc(s.onScreen)}` : ""}</p>
        <h4>الإحساس المقترح</h4><p>${s.feeling ? esc(s.feeling) : `<span class="muted">—</span>`}</p>
        <h4>القيود الشرعية والفنية</h4>${li(s.constraints)}
        <h4>ملاحظات المراجعة والفحص</h4>${li([...s.notes, ...s.issues])}
      </aside>
    </div></div>`;
  };
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${fontCss()}
  @page{size:2400px 1500px;margin:0}
  *{box-sizing:border-box}body{margin:0;background:#0B1F1C;color:#F4EEE2;font-family:Tajawal,Plex;font-size:19px;line-height:1.5}
  .page{width:2400px;height:1500px;padding:34px 44px;page-break-after:always;overflow:hidden;display:flex;flex-direction:column;gap:16px}
  h1{font-family:Ruqaa;font-size:60px;margin:0;color:#F2B35B}h2{font-family:Ruqaa;font-size:36px;margin:8px 0 4px;color:#C9A24A}
  h4{margin:10px 0 2px;color:#C9A24A;font-size:18px}h4.hot{color:#F2B35B}p{margin:0}ul{margin:0;padding-inline-start:20px}.muted{opacity:.55}
  .badge{display:inline-block;border:2px solid #F2B35B;color:#F2B35B;border-radius:30px;padding:2px 16px;font-size:22px;margin-inline-start:12px;font-family:Tajawal,Plex;vertical-align:middle}
  .sp header{display:flex;gap:14px;align-items:baseline;flex-wrap:wrap}.id{font-family:Mono;font-size:40px;color:#F2B35B;direction:ltr}.ch{font-weight:700;font-size:24px}
  .tag{font-size:17px;border:1px solid #C9A24A77;border-radius:20px;padding:0 12px}.event{background:#C2412D;border-color:#C2412D}
  .ver{font-family:Mono;direction:ltr;opacity:.6;font-size:15px;margin-inline-start:auto}
  .chg{font-size:18px;font-weight:700;border-radius:20px;padding:1px 14px}.chg.on{background:#F2B35B;color:#0B1F1C}.chg.off{border:1px solid #F4EEE266;opacity:.7}.chg.new{background:#C9A24A;color:#0B1F1C}
  .say{font-size:27px;font-weight:700;line-height:1.45}
  .body{flex:1;display:flex;gap:26px;min-height:0}
  .shots{flex:1;display:grid;gap:14px;align-content:start}.shots.one{grid-template-columns:1fr}.shots.two{grid-template-columns:1fr 1fr}
  .pair{margin:0}.pi{display:flex;gap:10px;justify-content:center}.pi img{display:block;border-radius:6px}
  figcaption{font-size:14px;opacity:.7;text-align:center;margin-top:3px}
  aside{width:620px;flex:none;font-size:18px;background:#0E2622;border:1px solid #C9A24A44;border-radius:12px;padding:12px 18px;overflow:hidden}
  table{border-collapse:collapse;width:100%;font-size:21px}td,th{border-bottom:1px solid #C9A24A44;padding:6px 8px;text-align:start}
  </style></head><body>
  <div class="page"><h1>${esc(m.title)} · الحلقة ${esc(m.episode)}<span class="badge">ستوري بورد مرئي · ${esc(m.version)} · PENDING_REVIEW</span></h1>
  <p style="font-size:22px">${esc(m.note)}</p>
  <h2>الحالة</h2>${li(summary)}
  <h2>الفصول</h2><table><tr><th>الفصل</th><th>العنوان</th><th>المشاهد</th><th>معدّل</th><th>المدة التقريبية</th><th>من – إلى</th></tr>${chapters
    .map(([n, t]) => {
      const ss = scenes.filter((s) => s.chapter === n);
      return `<tr><td>${n}</td><td>${esc(t)}</td><td>${ss.length}</td><td>${ss.filter((s) => s.change?.status === "changed").length}</td><td>${Math.round(ss.reduce((a, s) => a + s.seconds, 0))} ث</td><td style="font-family:Mono;direction:ltr;text-align:end">${esc(ss[0]!.id)} – ${esc(ss[ss.length - 1]!.id)}</td></tr>`;
    })
    .join("")}<tr><th></th><th>المجموع</th><th>${scenes.length}</th><th>${scenes.filter((s) => s.change?.status === "changed").length}</th><th>${Math.round(total / 6) / 10} د</th><th></th></tr></table>
  <h2>كيف تُقرأ اللوحة</h2>${li([
    "صفحة لكل مشهد بترتيبه. لكل لحظة صورة أفقية وعمودية متجاورتان بالارتفاع نفسه، من المحرك نفسه (لقطات ثابتة، لا فيديو).",
    "شارة «معدّل» محسوبة بمقارنة بصمة خطة المشهد وبايتات كل صورة بالإصدار السابق في اللحظة نفسها، و«ما تغيّر» يذكر السبب؛ «دون تغيير» تعني صورًا مطابقة.",
    "المدد تقديرية بسرعة الكلام بلا صوت؛ تُضبط على توقيت الكلمات المسجلة بعد اعتماد الصوت.",
    "«الإحساس المقترح» اقتراح للمراجعة لا قرار؛ النبرة تُحدَّد بعد اعتماد اللوحة.",
    "النص العربي في هذا الملف مرسوم بخط Tajawal كاملًا (حروف وأرقام)؛ والنص القابل للنسخ بلا تشويه في board.html بجواره.",
  ])}
  </div>
  ${scenes.map(page).join("")}
  </body></html>`;
};

/** يقارن مشاهد الإصدار الحالي بإصدار سابق في المجلد نفسه (بصمة الخطة، ولحظات اللقطة، وبايتات كل صورة) */
export const compareWithVersion = async (sbDir: string, against: string, scenes: BoardSceneOut[], outDir: string): Promise<void> => {
  const f = path.join(sbDir, against, "board-manifest.json");
  if (!existsSync(f)) throw new Error(`لا إصدار سابق للمقارنة: ${against}`);
  const prev = JSON.parse(await readFile(f, "utf8")) as BoardManifest;
  const prevDir = path.join(sbDir, against);
  for (const s of scenes) {
    const p = prev.scenes.find((x) => x.id === s.id);
    if (!p) {
      s.change = { status: "new", against, reasons: [] };
      continue;
    }
    const reasons: string[] = [];
    if (p.hash !== s.hash) reasons.push("تغيّرت خطة المشهد (اللقطة أو الحقول)");
    if (JSON.stringify(p.shots) !== JSON.stringify(s.shots)) reasons.push(`تغيّرت لحظات اللوحة (${p.shots.join("، ")} ← ${s.shots.join("، ")})`);
    for (const o of ["landscape", "portrait"] as const) {
      const diff: number[] = [];
      s.shots.forEach((fr, i) => {
        const j = p.shots.indexOf(fr);
        const a = path.join(outDir, s.images[o][i]!);
        const b = j >= 0 ? path.join(prevDir, p.images[o][j]!) : "";
        if (!b || !existsSync(b) || createHash("sha256").update(require_(a)).digest("hex") !== createHash("sha256").update(require_(b)).digest("hex")) diff.push(fr);
      });
      if (diff.length) reasons.push(`${o === "landscape" ? "الأفقي" : "العمودي"}: الصورة مختلفة في ${diff.length === s.shots.length ? "كل اللحظات" : `الإطار ${diff.join("، ")}`}`);
    }
    s.change = { status: reasons.length ? "changed" : "same", against, reasons };
  }
};
const require_ = (f: string) => readFileSync(f);

/** ورقة صور مصغّرة لفصل: كل مشاهده بلقطتها الأساسية الأفقية والعمودية، للتصفح السريع بالترتيب */
export const chapterSheetHtml = (m: Pick<BoardManifest, "title" | "version" | "scenes">, chapter: number, imgBase: string) => {
  const ss = m.scenes.filter((s) => s.chapter === chapter);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${fontCss()}
  body{margin:0;background:#0B1F1C;color:#F4EEE2;font-family:Tajawal,Plex;width:2400px;padding:30px 36px;box-sizing:border-box}
  h1{font-family:Ruqaa;color:#F2B35B;font-size:46px;margin:0 0 18px}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
  .c{background:#0E2622;border:1px solid #C9A24A55;border-radius:10px;padding:10px}.r{display:flex;gap:8px;align-items:flex-start}
  .r img.l{width:390px;border-radius:5px}.r img.p{width:140px;border-radius:5px}.id{font-family:Mono;color:#F2B35B;direction:ltr;display:inline-block}
  .t{font-size:15px;line-height:1.45;margin-top:6px;max-height:66px;overflow:hidden}
  </style></head><body><h1>${esc(m.title)} · الفصل ${chapter}: ${esc(ss[0]?.chapterTitle ?? "")} · ${esc(m.version)} · PENDING_REVIEW</h1><div class="g">${ss
    .map((s) => {
      const k = s.images.landscape.length - 1;
      const ch = (s as BoardSceneOut).change;
      const mark = ch?.status === "changed" ? ` <span style="background:#F2B35B;color:#0B1F1C;border-radius:12px;padding:0 8px;font-weight:700">معدّل</span>` : ch?.status === "same" ? ` <span style="opacity:.6">دون تغيير</span>` : "";
      return `<div class="c"><div><span class="id">${esc(s.id)}</span> · ${esc(s.kind)} · ${s.seconds} ث${mark}</div><div class="r"><img class="l" src="${imgBase}/${s.images.landscape[k]}"><img class="p" src="${imgBase}/${s.images.portrait[k]}"></div><div class="t">${esc(s.narration || "—")}</div></div>`;
    })
    .join("")}</div></body></html>`;
};

/** ورقة اختبار الهاتف: كل مشهد من الفصل بلقطته الأساسية العمودية بعرض 390 بكسل، كما تُرى على شاشة الهاتف */
export const phoneSheetHtml = (m: Pick<BoardManifest, "title" | "version" | "scenes">, chapter: number, imgBase: string) => {
  const ss = m.scenes.filter((s) => s.chapter === chapter);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${fontCss()}
  body{margin:0;background:#0B1F1C;color:#F4EEE2;font-family:Tajawal,Plex;padding:24px;width:max-content}
  h1{font-family:Ruqaa;color:#F2B35B;font-size:34px;margin:0 0 6px}p{margin:0 0 14px;font-size:17px;opacity:.85}
  .g{display:grid;grid-template-columns:repeat(4,390px);gap:16px}.c img{width:390px;display:block;border-radius:4px}.id{font-family:Mono;color:#F2B35B;direction:ltr;display:block;margin-bottom:4px}
  </style></head><body><h1>اختبار القراءة بعرض 390 بكسل · الفصل ${chapter} · ${esc(m.version)} · PENDING_REVIEW</h1><p>كل صورة معروضة بعرض 390 بكسل فعليًا (عرض شاشة هاتف شائع)، من اللقطة الأساسية العمودية لكل مشهد.</p><div class="g">${ss
    .map((s) => `<div class="c"><span class="id">${esc(s.id)}</span><img src="${imgBase}/${s.images.portrait[s.images.portrait.length - 1]}"></div>`)
    .join("")}</div></body></html>`;
};

/**
 * يبني اللوحة كاملة: الصور، وPDF، وورقة لكل فصل، والبيان. يعيد البيان.
 * deliver: نسخ الملفات المسلَّمة إلى storyboard/ بأسماء ثابتة (visual-board.pdf، chapter-N.png، board-manifest.json).
 */
export const buildStoryboardBoard = async (o: { episode: string; version: string; note: string; only?: string[]; chapter?: number; compare?: string; onProgress?: (msg: string) => void }) => {
  const log = o.onProgress ?? (() => {});
  const scriptPath = await resolveScriptPath(o.episode);
  const epDir = path.dirname(scriptPath);
  const sbDir = path.join(epDir, "storyboard");
  const outDir = path.join(sbDir, o.version);
  await mkdir(outDir, { recursive: true });
  const plan = (await loadPlan(o.episode))!;
  const media = await prepareRenderMedia(o.episode, plan);
  const channel = loadChannel();
  const notes = await loadBoardNotes(sbDir);
  const rows = boardScenes(plan, (s) => sceneFrames(s, media), notes, planIssues(plan, channel), config.video.fps);
  // فصل واحد (الأمر 018): لوحة إصدار جديد لفصل بعينه، في مجلد إصداره وحده؛ لا تُنسخ فوق ملفات الإصدار الكامل
  const only = o.chapter ? rows.filter((r) => r.chapter === o.chapter).map((r) => r.id) : o.only;
  const partial = Boolean(only);
  log(`لقطات ${only?.length ?? rows.length} مشهدًا بالاتجاهين…`);
  const images = await renderBoardStills({ episode: o.episode, outDir, rows, only, onProgress: (d, t, id) => d % 20 === 0 && log(`${d}/${t} · ${id}`) });
  const hashOf = new Map(plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, sceneHash(s)]));
  const scenes: BoardSceneOut[] = rows.filter((r) => images[r.id]).map((r) => ({ ...r, hash: hashOf.get(r.id)!, images: images[r.id]! }));
  if (o.compare) await compareWithVersion(sbDir, o.compare, scenes, outDir);
  const manifest: BoardManifest = { episode: plan.episode, title: plan.title, version: o.version, createdAt: new Date().toISOString(), status: "PENDING_REVIEW", note: o.note, scenes, files: [] };
  const summary = [
    `${scenes.length} مشهدًا في ${new Set(scenes.map((s) => s.chapter)).size} فصول؛ كلها «بانتظار المراجعة». لا اعتماد بمجرد إنشاء اللوحة أو رفعها.`,
    `مشاهد فيها تنبيه أو خطأ من فحص الخطة: ${scenes.filter((s) => s.issues.length).length}؛ وآيات بلا نص بعد: ${scenes.filter((s) => s.constraints.some((c) => c.startsWith("نص الآية لم يُجلب"))).length}.`,
    `مشاهد بإطارات محددة (أحداث متعددة الزوايا): ${scenes.filter((s) => notes.keyframes?.[s.id]).map((s) => s.id).join("، ") || "—"}.`,
    ...(o.compare ? [`مقارنة بـ${o.compare}: معدّل ${scenes.filter((s) => s.change?.status === "changed").length}، دون تغيير ${scenes.filter((s) => s.change?.status === "same").length}، جديد ${scenes.filter((s) => s.change?.status === "new").length}.`] : []),
  ];
  // Playwright مثبّت في البيئة لا في تبعيات المشروع؛ يُحمَّل باسمه وقت التشغيل
  const { chromium } = createRequire(import.meta.url)("playwright") as { chromium: { launch: () => Promise<any> } };
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 2400, height: 1500 } });
    const htmlFile = path.join(outDir, "board.html");
    await writeFile(htmlFile, boardHtml(manifest, ".", summary));
    await page.goto(`file://${htmlFile}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = path.join(outDir, "visual-board.pdf");
    log("PDF…");
    await page.pdf({ path: pdf, width: "2400px", height: "1500px", printBackground: true });
    const sheets: string[] = [];
    for (const ch of [...new Set(scenes.map((s) => s.chapter))]) {
      const f = path.join(outDir, `chapter-${ch}.html`);
      await writeFile(f, chapterSheetHtml(manifest, ch, "."));
      const p = await browser.newPage({ viewport: { width: 2400, height: 1000 } });
      await p.goto(`file://${f}`, { waitUntil: "load" });
      await p.evaluate(() => document.fonts.ready);
      const png = path.join(outDir, `chapter-${ch}.png`);
      await p.screenshot({ path: png, fullPage: true });
      await p.close();
      sheets.push(png);
      // اختبار القراءة على الهاتف: كل مشهد بلقطته الأساسية العمودية بعرض 390 بكسل فعليًا (لا تصغير لاحق)
      const ph = path.join(outDir, `phone-390-chapter-${ch}.html`);
      await writeFile(ph, phoneSheetHtml(manifest, ch, "."));
      const pp = await browser.newPage({ viewport: { width: 1800, height: 900 }, deviceScaleFactor: 1 });
      await pp.goto(`file://${ph}`, { waitUntil: "load" });
      await pp.evaluate(() => document.fonts.ready);
      const ppng = path.join(outDir, `phone-390-chapter-${ch}.png`);
      await pp.screenshot({ path: ppng, fullPage: true });
      await pp.close();
      sheets.push(ppng);
    }
    for (const f of [pdf, ...sheets]) manifest.files.push({ path: path.relative(epDir, f), sha256: await sha256(f), bytes: (await readFile(f)).length, kind: f.endsWith(".pdf") ? "board-pdf" : f.includes("phone-390") ? "phone-390" : "chapter-sheet" });
  } finally {
    await browser.close();
  }
  const mf = path.join(outDir, "board-manifest.json");
  await writeFile(mf, JSON.stringify(manifest, null, 2) + "\n");
  // الملفات المسلَّمة بأسماء ثابتة في storyboard/ (خانة ثابتة لكل منها، كما يطلب ناقل Drive)؛
  // لوحة جزئية (فصل) تبقى في مجلد إصدارها، فلا تحل محل ملفات الإصدار الكامل السابق
  const delivered: { path: string; sha256: string }[] = [];
  if (partial) {
    for (const f of [...manifest.files.map((x) => path.join(epDir, x.path)), mf]) delivered.push({ path: path.relative(epDir, f), sha256: await sha256(f) });
    return { manifest, outDir, delivered };
  }
  for (const f of [path.join(outDir, "visual-board.pdf"), ...manifest.files.filter((x) => x.kind === "chapter-sheet").map((x) => path.join(epDir, x.path)), mf]) {
    const dest = path.join(sbDir, path.basename(f) === "board-manifest.json" ? "board-manifest.json" : path.basename(f));
    await copyFile(f, dest);
    delivered.push({ path: path.relative(epDir, dest), sha256: await sha256(dest) });
  }
  return { manifest, outDir, delivered };
};
