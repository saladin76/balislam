import React, { useEffect, useMemo, useState } from "react";
import { Element } from "../../../brand/elements/Element";
import { elementLibrary } from "../../../brand/elements/registry";
import { categoryNamesAr, categoryOrder, type ElementCategory } from "../../../brand/elements/types";
import { HistoricFigure, figureNamesAr, type FigureId } from "../../../characters/HistoricFigure";
import { Character, characterNamesAr, characterPoseNamesAr, characterPoses, characterVariants } from "../../../characters/Character";
import { useTheme } from "../../../brand/identity/index";
import { themeIds, type ThemeId } from "../../../brand/themes";
import { api, type LongJob, type SfxItem } from "../api";
import { SetsGallery, TemplatesGallery } from "./LibraryGalleries";
import { ChannelImages } from "../ui/ChannelImages";
import { channelLibraries } from "../../../src/visual/library";
import { sceneCatalog } from "../../../src/remotion/scenes/catalog";
import { sets } from "../../../brand/sets/index";
import type { Identity } from "../../../brand/identity/index";
import type { ChannelInfo } from "../../../src/channel/types";
import { channelLibrary, type LibraryRules } from "../../../src/channel/library";
import { Figure, LOOKS, POSES, type PoseName } from "../../../src/remotion/illus/Figure";
import { PLACE_IDS, PlacePreview, placeNamesAr, PROP_IDS, PropPreview, propNamesAr } from "../../../src/remotion/illus/places";
import { CUE_WORDS, cueNamesAr } from "../../../src/plan/sceneCues";
import { RICH_SETS, SHOTS } from "../../../src/remotion/illus/shots";
import { camAt, camTransform } from "../../../src/remotion/illus/shots/kit";

/** قواعد مكتبة القناة من بياناتها في الاستوديو */
export const libraryRulesOf = (c?: ChannelInfo): LibraryRules => ({ id: c?.id ?? "", rules: { faces: Boolean(c?.rules?.faces), quran: Boolean(c?.rules?.quran), hadith: Boolean(c?.rules?.hadith) }, library: c?.library });

type Section = "templates" | "images" | "sets" | "elements" | "characters" | "sfx";

/** المكتبة: القوالب، وأماكن التصوير، والشخصيات، والعناصر، والمؤثرات — لكل قناة مكتبتها فقط (src/channel/library.ts). */
export const LibraryTab: React.FC<{ hasVoiceKeys: boolean; identity?: Identity; channel?: ChannelInfo }> = ({ hasVoiceKeys, identity, channel }) => {
  const [section, setSection] = useState<Section>("templates");
  const [themeId, setThemeId] = useState<ThemeId>("paper");
  const t = useTheme(themeId);
  const lib = useMemo(() => channelLibrary(libraryRulesOf(channel)), [channel]);
  const illus = channel?.library?.cast === "illus";
  return (
    <div className="library">
      <div className="toolbar">
        <div className="seg" role="group" aria-label="القسم">
          {([["templates", `القوالب (${sceneCatalog.filter((e) => lib.templates.includes(e.id)).length})`], ["images", `صور القناة (${channelLibraries[channel?.id ?? ""]?.length ?? 0})`], ["sets", `أماكن التصوير (${illus ? RICH_SETS.length + PLACE_IDS.length : lib.sets.length})`], ["characters", "الشخصيات"], ["elements", `العناصر (${lib.elements.length})`], ["sfx", "المؤثرات الصوتية"]] as const).map(([k, l]) => (
            <button key={k} aria-pressed={section === k} onClick={() => setSection(k)}>{l}</button>
          ))}
        </div>
        <span className="spacer" />
        {section === "elements" || (section === "characters" && !illus) ? (
          <div className="seg" role="group" aria-label="الثيم">
            {themeIds.map((id) => (
              <ThemeButton key={id} id={id} active={id === themeId} onClick={() => setThemeId(id)} />
            ))}
          </div>
        ) : null}
      </div>
      {section === "templates" ? <TemplatesGallery identity={identity} channel={channel} allowed={lib.templates} /> : null}
      {section === "images" ? <ChannelImages key={channel?.id} channel={channel?.id ?? ""} /> : null}
      {section === "sets" ? (illus ? <IllusPlaces /> : <SetsGallery allowed={lib.sets} />) : null}
      {section === "elements" ? <Elements themeId={themeId} allowed={lib.elements} channelName={channel?.name ?? ""} /> : null}
      {section === "characters" && illus ? <IllusCast /> : null}
      {section === "characters" && !illus ? (
        <div className="lib-chars" style={{ background: t.colors.bg }}>
          {/* القناة التي تكتفي بالشخصيات التاريخية لا يظهر فيها الرواة العامّون */}
          {channel?.library?.characters === "figures" ? null : characterVariants.map((v) => (
            <div key={v} className="lib-char-row">
              <b style={{ color: t.colors.ink }}>{characterNamesAr[v]}</b>
              <div className="lib-char-poses">
                {characterPoses.map((p) => (
                  <figure key={p}>
                    <Character theme={t} variant={v} pose={p} height={130} />
                    <figcaption style={{ color: t.colors.inkSoft }}>{characterPoseNamesAr[p]}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
          {lib.figures ? (
            <div className="lib-char-row">
              <b style={{ color: t.colors.ink }}>شخصيات تاريخية بملامح (لا تُستعمل لنبي ولا صحابي)</b>
              <div className="lib-char-poses">
                {(Object.keys(figureNamesAr) as FigureId[]).map((f) => (
                  <figure key={f}>
                    <HistoricFigure figure={f} height={130} />
                    <figcaption style={{ color: t.colors.inkSoft }}>{figureNamesAr[f]}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ) : (
            <p className="help" style={{ color: t.colors.inkSoft }}>القناة بلا وجوه: الشخصيات بلا ملامح فقط.</p>
          )}
        </div>
      ) : null}
      {section === "sfx" ? <Sfx hasVoiceKeys={hasVoiceKeys} /> : null}
    </div>
  );
};

const ThemeButton: React.FC<{ id: ThemeId; active: boolean; onClick: () => void }> = ({ id, active, onClick }) => {
  const t = useTheme(id);
  return (
    <button aria-pressed={active} onClick={onClick}>
      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: t.colors.primary, marginInlineEnd: 6 }} />
      {t.nameAr}
    </button>
  );
};

const Elements: React.FC<{ themeId: ThemeId; allowed: string[]; channelName: string }> = ({ themeId, allowed, channelName }) => {
  const t = useTheme(themeId);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ElementCategory | "all">("all");
  const [copied, setCopied] = useState("");
  const items = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const ok = new Set(allowed);
    return elementLibrary.filter((e) => ok.has(e.id) && (cat === "all" || e.category === cat) && (!qq || `${e.nameAr} ${e.id} ${e.tags.join(" ")}`.toLowerCase().includes(qq)));
  }, [q, cat, allowed]);
  return (
    <>
      <div className="toolbar">
        <input id="lib-search" type="text" placeholder="ابحث: قلب، هاتف، coin…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 300 }} />
        <div className="cat-row">
          <button aria-pressed={cat === "all"} onClick={() => setCat("all")}>الكل</button>
          {categoryOrder.filter((c) => elementLibrary.some((e) => e.category === c && allowed.includes(e.id))).map((c) => (
            <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{categoryNamesAr[c]}</button>
          ))}
        </div>
      </div>
      <p className="help">عناصر مكتبة «{channelName}» فقط ({allowed.length} من {elementLibrary.length}). اضغط على عنصر لنسخ معرّفه واستخدامه في السكريبت، مثل [مشهد: symbolic | element=seed].</p>
      <div className="grid-el lib-grid">
        {items.map((e) => (
          <button
            key={e.id}
            className="el-card"
            title={e.tags.join("، ")}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(e.id);
                setCopied(e.id);
                setTimeout(() => setCopied(""), 1200);
              } catch {
                /* لا شيء */
              }
            }}
          >
            <div className="stage" style={{ background: t.colors.bg, aspectRatio: e.kind === "backdrop" ? "16 / 9" : "1" }}>
              {e.kind === "backdrop" ? <Element id={e.id} theme={t} width={1920} height={1080} style={{ width: "100%", height: "100%" }} /> : <Element id={e.id} theme={t} size={78} />}
            </div>
            <span>{e.nameAr}</span>
            <code className="help" style={{ direction: "ltr", fontSize: 12 }}>{copied === e.id ? "نُسخ ✓" : e.id}</code>
          </button>
        ))}
      </div>
    </>
  );
};

const Sfx: React.FC<{ hasVoiceKeys: boolean }> = ({ hasVoiceKeys }) => {
  const [list, setList] = useState<SfxItem[] | null>(null);
  const [job, setJob] = useState<LongJob | null>(null);
  const load = () => api.sfx().then(setList).catch(() => setList([]));
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (job?.status !== "running") return;
    const t = setInterval(async () => {
      const all = await api.longJobs().catch(() => []);
      const j = all.find((x) => x.id === job.id);
      if (j) setJob(j);
      if (j && j.status !== "running") load();
    }, 1500);
    return () => clearInterval(t);
  }, [job?.id, job?.status]);
  if (!list) return <p className="help">جارٍ التحميل…</p>;
  const have = list.filter((s) => s.available).length;
  const generatable = list.filter((s) => !s.available && s.category !== "vocal").length;
  return (
    <>
      <div className="toolbar">
        <span className="help">موجود {have} من {list.length}. الآهات البشرية تُسجَّل بصوت منشد ولا تُولَّد، وكل مؤثر يُسمع ويُعتمد قبل النشر.</span>
        <span className="spacer" />
        <button className="btn primary" disabled={!hasVoiceKeys || !generatable || job?.status === "running"} title={hasVoiceKeys ? "" : "يتطلب مفاتيح ElevenLabs"} onClick={async () => { try { setJob(await api.startJob({ kind: "sfx" })); } catch (x) { window.alert((x as Error).message); } }}>
          {job?.status === "running" ? `جارٍ التوليد… ${job.log[job.log.length - 1] ?? ""}` : `ولّد الناقص (${generatable})`}
        </button>
      </div>
      <div className="tablewrap">
        <table className="sfx-table">
          <thead>
            <tr><th>المؤثر</th><th>المعرّف</th><th>الفئة</th><th>متى يُستخدم</th><th>ث</th><th>الملف</th></tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td>{s.nameAr}{s.guard ? <div className="help" style={{ color: "var(--accent)" }}>{s.guard}</div> : null}</td>
                <td><code style={{ direction: "ltr" }}>{s.id}</code></td>
                <td><span className="badge">{s.categoryAr}</span></td>
                <td>{s.useAr}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{s.seconds}</td>
                <td>{s.available ? <audio src={api.sfxUrl(s.id)} controls preload="none" style={{ height: 30, width: 200 }} /> : <span className="help">{s.category === "vocal" ? "تسجيل بشري" : "غير مولَّد"}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

const CAST_NAMES: Record<keyof typeof LOOKS, string> = { hero: "الشاب (سترة)", heroThobe: "الشاب (ثوب)", woman: "امرأة (عباءة داكنة)", womanSand: "امرأة (عباءة رملية)", elder: "شيخ كبير", friend: "صديق", stranger: "عابر", vendor: "بائع", boy: "فتى" };
const POSE_NAMES: Record<PoseName, string> = { stand: "واقف", think: "يتأمل", sit: "جالس", "sit-low": "جالس مطرق", "head-down": "مثقل", hold: "يقرأ ورقة", cross: "متمسك برأيه", point: "يشير", "look-up": "يرفع رأسه", nod: "يومئ", "turn-away": "يدير ظهره", proud: "يتعالى", apologize: "يعتذر", listen: "يُصغي", talk: "يتكلم", flinch: "يتألم من كلمة", sincere: "صادق فيما يقول", halt: "مهلًا", "sit-show": "جالس يُري ما في يده", "sit-nod": "جالس يومئ", "wave-off": "يلوّح رافضًا", "lean-rail": "متكئ على سور" };

/** شخصيات «بالإسلام» المصوَّرة: بلا ملامح، بوضعياتها كما تظهر في القوالب الثلاثة */
const IllusCast: React.FC = () => (
  <div className="lib-chars" style={{ background: "#0B1F1C" }}>
    <p className="help" style={{ color: "#C9A24A" }}>شخصيات القناة بلا ملامح وجه أبدًا. تتحرك بمفاصل (تمشي وتجلس وتومئ) في «حكايات الحارة» و«الطريق» و«ظل ونور».</p>
    {(Object.keys(LOOKS) as (keyof typeof LOOKS)[]).map((k) => (
      <div key={k} className="lib-char-row">
        <b style={{ color: "#F4EEE2" }}>{CAST_NAMES[k]}</b>
        <div className="lib-char-poses">
          {(Object.keys(POSES) as PoseName[]).map((p) => (
            <figure key={p}>
              <svg viewBox="-110 -330 220 345" width={88} height={138}>
                <Figure x={0} y={0} pose={POSES[p]} look={LOOKS[k]} flip />
              </svg>
              <figcaption style={{ color: "#C9A24A" }}>{POSE_NAMES[p]}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    ))}
  </div>
);

/** معاينة لقطة مصمَّمة: إطار من منتصفها بكاميرتها */
const ShotThumb: React.FC<{ id: string; width?: number }> = ({ id, width = 320 }) => {
  const dur = 200;
  const frame = 120;
  const shot = SHOTS[id]!.render({ frame, fps: 30, dur, portrait: false, at: (_w, f) => Math.round(f * dur) });
  return (
    <svg viewBox="0 0 1920 1080" width={width} height={(width * 9) / 16} style={{ display: "block", borderRadius: 8, background: "#0B1F1C" }}>
      <g transform={camTransform(camAt(frame, shot.cam))}>{shot.world}</g>
    </svg>
  );
};

/** أماكن «بالإسلام» المصوَّرة وعناصر مشاهدها ومعانيها: ما يظهر هنا هو ما يُرندر */
const IllusPlaces: React.FC = () => (
  <div style={{ display: "grid", gap: 24 }}>
    <h3 style={{ margin: 0 }}>أماكن مرسومة ({RICH_SETS.length})</h3>
    <p className="help">أماكن اللقطات المصمَّمة: طبقات وملمس ومصادر ضوء وتفاصيل حياة. كل مكان يُعاد استعماله في الحلقات التالية بزوايا وأحداث أخرى.</p>
    <div className="lib-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
      {RICH_SETS.map((st) => (
        <figure key={st.id} style={{ margin: 0 }}>
          <svg viewBox="-60 -40 2040 1160" width="100%" style={{ display: "block", borderRadius: 8, aspectRatio: "16 / 9" }} preserveAspectRatio="xMidYMid slice">
            {st.render(60)}
          </svg>
          <figcaption style={{ marginTop: 6 }}>{st.nameAr}</figcaption>
        </figure>
      ))}
    </div>
    <h3 style={{ margin: 0 }}>لقطات مصمَّمة ({Object.keys(SHOTS).length})</h3>
    <p className="help">مشهد مصمَّم يحكي جملة بعينها: مكانه وشخوصه وكاميرته، وأحداثه على توقيت كلماتها. يُختار في «المشاهد» بحقل «لقطة مصمَّمة»، ويُعاد استعماله لكل جملة بالمعنى نفسه.</p>
    <div className="lib-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
      {Object.entries(SHOTS).map(([id, d]) => (
        <figure key={id} style={{ margin: 0 }}>
          <ShotThumb id={id} />
          <figcaption style={{ marginTop: 6 }}>
            <b>{d.nameAr}</b>
            <div className="help" style={{ direction: "ltr", textAlign: "end", fontFamily: "monospace" }}>{id}</div>
          </figcaption>
        </figure>
      ))}
    </div>
    <h3 style={{ margin: 0 }}>أماكن الإخراج العام ({PLACE_IDS.length})</h3>
    <p className="help">للمشاهد التي لم تُصمَّم لها لقطة بعد (حكايات الحارة العامة، والطريق، وظل ونور).</p>
    <div className="lib-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
      {PLACE_IDS.map((id) => (
        <figure key={id} style={{ margin: 0 }}>
          <PlacePreview id={id} width={280} />
          <figcaption style={{ marginTop: 6 }}>{placeNamesAr[id]}</figcaption>
        </figure>
      ))}
    </div>
    <h3 style={{ margin: 0 }}>عناصر المشاهد ({PROP_IDS.length})</h3>
    <p className="help">كل عنصر صُمِّم لمعنى في الكلام، ويظهر لحظة نطق كلمته فقط. وإن لم يوجد عنصر مناسب يُصمَّم جديد ويُضاف هنا، ولا يوضع أقرب عنصر.</p>
    <div className="lib-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
      {PROP_IDS.map((id) => (
        <figure key={id} style={{ margin: 0 }}>
          <PropPreview id={id} width={180} />
          <figcaption style={{ marginTop: 6, fontSize: 13 }}>{propNamesAr[id]}</figcaption>
        </figure>
      ))}
    </div>
    <h3 style={{ margin: 0 }}>المعاني المراجَعة وكلماتها</h3>
    <p className="help">لا حدث في جملة فيها ذكر الله أو دعاء أو آية، و«في حقك» ليست الحق.</p>
    <table className="lib-cues"><tbody>
      {CUE_WORDS.map(([k, words]) => (
        <tr key={k}><td><b>{cueNamesAr[k]}</b></td><td style={{ direction: "rtl" }}>{words.join("، ")}</td></tr>
      ))}
    </tbody></table>
  </div>
);
