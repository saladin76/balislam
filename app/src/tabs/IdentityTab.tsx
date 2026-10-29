import React, { useState } from "react";
import { IdentityProvider, type Identity, type SizePair } from "../../../brand/identity/index";
import { themeIds, type ThemeId } from "../../../brand/themes";
import { Element } from "../../../brand/elements/Element";
import { LogoMark } from "../../../brand/logo/Logo";
import { useTheme } from "../../../brand/identity/index";
import { ReelPreview, type Orientation } from "../ui/Preview";
import { OverlaySwitches } from "../ui/Overlays";
import { resolveOverlays } from "../../../brand/identity/index";
import { contrast } from "../ui/contrast";
import type { ChannelInfo } from "../../../src/channel/types";

const sceneColors: [string, string][] = [
  ["bg", "الخلفية"],
  ["surface", "البطاقات"],
  ["ink", "النص"],
  ["inkSoft", "نص ثانوي"],
  ["primary", "الأساسي"],
  ["secondary", "الثانوي"],
  ["highlight", "التمييز"],
  ["onHighlight", "نص فوق التمييز"],
  ["captionBg", "شريط الترجمة"],
  ["captionInk", "نص الترجمة"],
];
const paletteColors: [string, string][] = [
  ["main", "الرئيسي"],
  ["second", "الثانوي"],
  ["accent", "التمييز"],
  ["light", "فاتح"],
  ["dark", "داكن"],
  ["edge", "خطوط فوق الخلفية"],
  ["line", "خطوط التفاصيل"],
  ["skin", "البشرة"],
  ["metal", "ذهب ومعادن"],
  ["wood", "خشب"],
  ["green", "نبات"],
  ["water", "ماء وسماء"],
];
const typeRoles: [keyof Identity["typography"], string, number, number][] = [
  ["question", "السؤال الكبير", 60, 180],
  ["bubble", "فقاعة الكلام", 36, 100],
  ["verse", "نص الآية", 50, 130],
  ["reference", "مرجع الآية", 20, 60],
  ["caption", "الترجمة السفلية", 28, 72],
  ["eyebrow", "عنوان الفصل الصغير", 18, 48],
];
const sampleEls = ["question-mark", "heart", "lightbulb", "book-open", "coin-stack", "mosque", "house-warm", "smartphone", "tree", "scale-balance", "hands-dua", "verse-frame"];

const Color: React.FC<{ label: string; value: string; onChange: (v: string) => void; id: string }> = ({ label, value, onChange, id }) => {
  const valid = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <div className="color">
      <input id={id} type="color" value={valid ? value : "#000000"} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label={label} />
      <div className="cl">
        <b>{label}</b>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} hex`} />
      </div>
    </div>
  );
};

const Ratio: React.FC<{ a: string; b: string; label: string; min?: number }> = ({ a, b, label, min = 4.5 }) => {
  const r = contrast(a, b);
  return <span className={r >= min ? "good" : "poor"} title={`الحد الأدنى ${min}`}>{label}: {r.toFixed(1)}</span>;
};

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string }> = ({ label, value, min, max, step = 1, onChange, unit = "" }) => (
  <label className="slider">
    <span>{label}</span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    <output>{value}{unit}</output>
  </label>
);

const ElementStrip: React.FC<{ themeId: ThemeId }> = ({ themeId }) => {
  const t = useTheme(themeId);
  return (
    <div className="el-strip" style={{ background: t.colors.bg }}>
      <div style={{ display: "grid", placeItems: "center" }}><LogoMark size={56} colors={t.logo} /></div>
      {sampleEls.map((id) => (
        <div key={id} style={{ display: "grid", placeItems: "center" }}><Element id={id} theme={t} size={60} /></div>
      ))}
    </div>
  );
};

/** تعديل الهوية: الألوان والخطوط والحركة، مع معاينة حية قبل الحفظ. */
export const IdentityTab: React.FC<{
  channel?: ChannelInfo;
  draft: Identity;
  saved: Identity;
  defaults: Identity;
  onChange: (i: Identity) => void;
  onSave: () => Promise<void>;
}> = ({ channel, draft, saved, defaults, onChange, onSave }) => {
  const [themeId, setThemeId] = useState<ThemeId>("paper");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [sizeO, setSizeO] = useState<Orientation>("landscape");
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const th = draft.themes[themeId];
  const pal = draft.palettes[themeId];

  const setThemeColor = (k: string, v: string) => onChange({ ...draft, themes: { ...draft.themes, [themeId]: { ...th, colors: { ...th.colors, [k]: v } } } });
  const setLogo = (k: string, v: string) => onChange({ ...draft, themes: { ...draft.themes, [themeId]: { ...th, logo: { ...th.logo, [k]: v } } } });
  const setChar = (patch: Partial<typeof th.character>) => onChange({ ...draft, themes: { ...draft.themes, [themeId]: { ...th, character: { ...th.character, ...patch } } } });
  const setPal = (k: string, v: string) => onChange({ ...draft, palettes: { ...draft.palettes, [themeId]: { ...pal, [k]: v } } });
  const setSize = (k: keyof Identity["typography"], v: number) => onChange({ ...draft, typography: { ...draft.typography, [k]: { ...draft.typography[k], [sizeO]: v } as SizePair } });
  const setMotion = (patch: Partial<Identity["motion"]>) => onChange({ ...draft, motion: { ...draft.motion, ...patch } });
  const c = th.colors;

  return (
    <div className="work identity-grid">
      <div className="col side" style={{ borderInlineStart: 0, borderInlineEnd: "1px solid var(--line)" }}>
        <div className="col-head" style={{ flexWrap: "wrap" }}>
          <h2>الهوية</h2>
          <span className="spacer" />
          <span className="status"><i className={`dot ${dirty ? "dirty" : ""}`} />{dirty ? "غير محفوظة" : "محفوظة"}</span>
          <button className="btn small" disabled={!dirty} onClick={() => onChange(saved)}>تراجع</button>
          <button
            className="btn primary small"
            disabled={!dirty || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave();
              } finally {
                setSaving(false);
              }
            }}
          >
            حفظ الهوية
          </button>
        </div>
        <div className="id-form">
          <div className="seg" role="group" aria-label="الثيم" style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
            {themeIds.map((id) => (
              <button key={id} aria-pressed={themeId === id} onClick={() => setThemeId(id)}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: draft.themes[id].colors.primary, marginInlineEnd: 6 }} />
                {draft.themes[id].nameAr}
              </button>
            ))}
          </div>

          <div className="group">
            <h3>ألوان المشهد <small>{th.domainAr}</small></h3>
            <div className="colors">
              {sceneColors.map(([k, l]) => <Color key={k} id={`c-${k}`} label={l} value={(c as Record<string, string>)[k]!} onChange={(v) => setThemeColor(k, v)} />)}
            </div>
            <div className="contrast">
              <Ratio a={c.ink} b={c.bg} label="النص/الخلفية" />
              <Ratio a={c.ink} b={c.surface} label="النص/البطاقة" />
              <Ratio a={c.inkSoft} b={c.bg} label="الثانوي/الخلفية" />
              <Ratio a={c.onHighlight} b={c.highlight} label="التمييز" />
              <Ratio a={c.captionInk} b={c.captionBg} label="الترجمة" />
            </div>
            <span className="help">الأخضر يعني أن النص مقروء بوضوح (تباين 4.5 أو أكثر).</span>
          </div>

          <div className="group">
            <h3>ألوان العناصر <small>{pal.style === "line" ? "أسلوب خطي بالحبر" : "أسلوب مسطح"}</small></h3>
            <div className="colors">
              {paletteColors.map(([k, l]) => <Color key={k} id={`p-${k}`} label={l} value={(pal as Record<string, string | number>)[k] as string} onChange={(v) => setPal(k, v)} />)}
            </div>
          </div>

          <div className="group">
            <h3>الشعار والشخصيات</h3>
            <div className="colors">
              <Color id="l-tile" label="خلفية الشعار" value={th.logo.tile} onChange={(v) => setLogo("tile", v)} />
              <Color id="l-baa" label="حرف الباء" value={th.logo.baa} onChange={(v) => setLogo("baa", v)} />
              <Color id="l-play" label="زر التشغيل" value={th.logo.play} onChange={(v) => setLogo("play", v)} />
              <Color id="ch-outline" label="حدود الشخصيات" value={th.character.outline} onChange={(v) => setChar({ outline: v })} />
              <Color id="ch-skin0" label="بشرة" value={th.character.skin[0]} onChange={(v) => setChar({ skin: [v, th.character.skin[1]] })} />
              <Color id="ch-skin1" label="بشرة الكبار" value={th.character.skin[1]} onChange={(v) => setChar({ skin: [th.character.skin[0], v] })} />
              {["الراوي", "الراوية", "الطفل", "الكبير", "الكبيرة"].map((l, i) => (
                <Color key={l} id={`ch-g${i}`} label={`ثوب ${l}`} value={th.character.garments[i]!} onChange={(v) => { const g = [...th.character.garments] as typeof th.character.garments; g[i] = v; setChar({ garments: g }); }} />
              ))}
              <Color id="ch-cap" label="الطاقية والخمار" value={th.character.cap} onChange={(v) => setChar({ cap: v })} />
            </div>
          </div>

          <div className="group">
            <h3>أحجام الخطوط <small>بالبكسل على مقاس الفيديو</small></h3>
            <div className="seg" role="group" style={{ alignSelf: "flex-start" }}>
              <button aria-pressed={sizeO === "landscape"} onClick={() => setSizeO("landscape")}>الحلقة 16:9</button>
              <button aria-pressed={sizeO === "portrait"} onClick={() => setSizeO("portrait")}>الشورت 9:16</button>
            </div>
            {typeRoles.map(([k, l, min, max]) => <Slider key={k} label={l} value={draft.typography[k][sizeO]} min={min} max={max} onChange={(v) => setSize(k, v)} />)}
          </div>

          <div className="group">
            <h3>الحركة <small>تنطبق على كل الثيمات</small></h3>
            <Slider label="سرعة الحركات" value={draft.motion.speed} min={0.5} max={2} step={0.05} unit="×" onChange={(v) => setMotion({ speed: v })} />
            <Slider label="بين كل كلمة" value={draft.motion.wordInterval} min={2} max={14} unit=" إطار" onChange={(v) => setMotion({ wordInterval: v })} />
            <Slider label="كلمات سطر الترجمة" value={draft.motion.captionWords} min={3} max={10} onChange={(v) => setMotion({ captionWords: v })} />
            <Slider label="طفو العناصر" value={draft.motion.float} min={0} max={2} step={0.1} unit="×" onChange={(v) => setMotion({ float: v })} />
            <label className="slider">
              <span>اهتزاز الحبر</span>
              <input type="range" min={0} max={2} step={0.1} value={draft.motion.boil ? draft.motion.boilAmount : 0} onChange={(e) => { const v = Number(e.target.value); setMotion({ boil: v > 0, boilAmount: v || draft.motion.boilAmount }); }} />
              <output>{draft.motion.boil ? draft.motion.boilAmount : "مطفأ"}</output>
            </label>
            <span className="help">اهتزاز الحبر يظهر في ثيم «حبر وورق» فقط، ويعطي إحساس الرسم باليد.</span>
          </div>

          <div className="group">
            <h3>عناصر الشاشة <small>الافتراضي لكل حلقات القناة</small></h3>
            <OverlaySwitches value={resolveOverlays(draft.overlays)} onChange={(overlays) => onChange({ ...draft, overlays })} />
            <span className="help">يمكن تغييرها لحلقة واحدة أو مشهد واحد من تبويب «المشاهد».</span>
          </div>

          <button className="btn" onClick={() => onChange(defaults)} style={{ alignSelf: "flex-start" }}>استرجاع الهوية الأصلية</button>
        </div>
      </div>

      <div className="col preview-col">
        <div className="toolbar">
          <b style={{ fontFamily: "var(--f-head)", fontSize: 18 }}>معاينة حية</b>
          <span className="help">ترى التعديل قبل الحفظ</span>
          <span className="spacer" />
          <div className="seg" role="group">
            <button aria-pressed={orientation === "landscape"} onClick={() => setOrientation("landscape")}>أفقي</button>
            <button aria-pressed={orientation === "portrait"} onClick={() => setOrientation("portrait")}>عمودي</button>
          </div>
        </div>
        <div className={`player-wrap ${orientation}`}>
          <div><ReelPreview themeId={themeId} orientation={orientation} identity={draft} channel={channel} /></div>
        </div>
        <IdentityProvider identity={draft}>
          <ElementStrip themeId={themeId} />
        </IdentityProvider>
      </div>
    </div>
  );
};
