import React, { useState } from "react";
import { Player } from "@remotion/player";
import { api } from "../api";
import { channelInfo, type ChannelConfig } from "../../../src/channel/types";
import type { Identity } from "../../../brand/identity/index";
import { Providers } from "../../../src/remotion/Providers";
import { ChannelIntro, INTRO_FRAMES, type IntroKind } from "../../../src/remotion/scenes/ChannelIntro";
import { Thumbnail } from "../../../src/remotion/Thumbnail";
import { styleNamesAr } from "./OpsRoom";
import config from "../../../config.json";
import { tones, toneIds } from "../../../src/voice/tones";

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const INTROS: [NonNullable<NonNullable<ChannelConfig["brand"]>["intro"]>, string][] = [["ink", "باء وحبر (بالإسلام)"], ["archive", "ختم على رَقّ (دفاتر الزمن)"], ["book", "كتاب يُفتح (زبدة الكتب)"], ["none", "بلا افتتاحية"]];
const THUMBS: [NonNullable<NonNullable<ChannelConfig["brand"]>["thumbnail"]>, string][] = [["circle", "دائرة ورمز (بالإسلام)"], ["archive", "أرشيف ورق قديم (دفاتر الزمن)"], ["cover", "غلاف كتاب (زبدة الكتب)"]];
const ALL_STYLES = ["doc-plate", "board", "map-journey", "set-scene", "sim-stage", "desk-moment", "kinetic", "glow", "sketch-board", "timeline", "templates"];

const IntroComp: React.FC<{ kind: IntroKind; identity?: Identity; channel: ReturnType<typeof channelInfo> }> = ({ kind, identity, channel }) => (
  <Providers identity={identity} channel={channel}>
    <ChannelIntro kind={kind} orientation="landscape" />
  </Providers>
);

/**
 * «بصمة القناة»: ما يثبت في كل حلقة ويميز القناة من أول ثانية (الافتتاحية، والصورة المصغّرة، والصوت)،
 * والجدول، والأساليب التي تتناوب عليها الحلقات.
 */
export const ChannelBrand: React.FC<{ c: ChannelConfig; set: (p: Partial<ChannelConfig>) => void; identity?: Identity }> = ({ c, set, identity }) => {
  const info = channelInfo(c);
  const intro = c.brand?.intro ?? "none";
  const thumb = c.brand?.thumbnail ?? "circle";
  const [voices, setVoices] = useState<{ id: string; name: string; category: string }[] | null>(null);
  const [vmsg, setVmsg] = useState("");
  const sch = c.schedule ?? { longDay: 6, time: "19:00", shortsPerDay: 1 };
  const styles = c.styles ?? [];
  return (
    <section className="group brand-group">
      <h3>بصمة القناة <small>ثابتة في كل حلقة؛ والتنوّع يكون داخل الحلقة</small></h3>

      <div className="brand-row">
        <label className="field">
          <span>الافتتاحية (ثانيتان ونصف في أول الحلقة الطويلة)</span>
          <select id="ch-intro" value={intro} onChange={(e) => set({ brand: { ...c.brand, intro: e.target.value as typeof intro } })}>
            {INTROS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {intro !== "none" ? (
          <div className="brand-prev">
            <Player key={`${intro}-${c.name}`} component={IntroComp} inputProps={{ kind: intro as IntroKind, identity, channel: info }} durationInFrames={INTRO_FRAMES + 15} fps={config.video.fps} compositionWidth={1920} compositionHeight={1080} style={{ width: "100%" }} autoPlay loop controls acknowledgeRemotionLicense />
          </div>
        ) : null}
      </div>

      <div className="brand-row">
        <label className="field">
          <span>أسلوب الصورة المصغّرة</span>
          <select id="ch-thumb" value={thumb} onChange={(e) => set({ brand: { ...c.brand, thumbnail: e.target.value as typeof thumb } })}>
            {THUMBS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <div className="brand-prev">
          <Player key={`${thumb}-${c.name}`} component={Thumbnail} inputProps={{ themeId: c.masterTheme, title: "عنوان الحلقة يظهر هنا بخط كبير", highlight: "بخط كبير", element: "", identity, channel: info }} durationInFrames={1} fps={30} compositionWidth={1280} compositionHeight={720} style={{ width: "100%" }} acknowledgeRemotionLicense />
        </div>
      </div>

      <div className="field">
        <span>صوت القناة في ElevenLabs</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {voices ? (
            <select id="ch-voice" value={c.voice?.id ?? ""} onChange={(e) => { const v = voices.find((x) => x.id === e.target.value); set({ voice: { ...c.voice, id: v?.id, name: v?.name } }); }} style={{ flex: 1, minWidth: 220 }}>
              <option value="">الصوت العام من «الإعدادات»</option>
              {voices.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.category})</option>)}
            </select>
          ) : (
            <span style={{ flex: 1 }}>{c.voice?.id ? <b>{c.voice.name ?? c.voice.id}</b> : <span className="help">الصوت العام من «الإعدادات»</span>}</span>
          )}
          <button className="btn small" onClick={async () => { setVmsg("جارٍ التحميل…"); try { const r = await api.testService("elevenlabs"); if (r.ok && r.voices) { setVoices(r.voices); setVmsg(""); } else setVmsg(r.message ?? "تعذّر جلب الأصوات"); } catch (e) { setVmsg((e as Error).message); } }}>اختيار من أصوات حسابك</button>
          {c.voice?.id ? <button className="btn ghost small" onClick={() => set({ voice: { ...c.voice, id: undefined, name: undefined } })}>رجوع للصوت العام</button> : null}
        </div>
        <span className="help">{vmsg || "صوت مختلف لكل قناة يقوّي شخصيتها. تغيير الصوت يعني إعادة توليد صوت الحلقات غير المنشورة."}</span>
      </div>

      <label className="field">
        <span>النبرة الافتراضية للقناة <small>(الصوت نفسه بإحساس مختلف؛ تتغير لكل حلقة أو مشهد من تبويب «المشاهد»)</small></span>
        <select id="ch-tone" value={c.voice?.tone ?? ""} onChange={(e) => set({ voice: { ...c.voice, tone: e.target.value || undefined } })}>
          <option value="">عادية (إعدادات الصوت الأساسية)</option>
          {toneIds.map((t) => <option key={t} value={t}>{tones[t].nameAr}: {tones[t].useAr}</option>)}
        </select>
      </label>

      <div className="field">
        <span>أصوات الشخصيات <small>(للحوار في الحلقات التاريخية مثلًا؛ تختارها لكل مشهد)</small></span>
        {(c.cast ?? []).map((v, i) => (
          <div key={v.id + i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <b style={{ flex: 1 }}>{v.name}</b>
            <input type="text" placeholder="الدور: القائد، العالم، الراوية…" value={v.role ?? ""} onChange={(e) => set({ cast: (c.cast ?? []).map((x, k) => (k === i ? { ...x, role: e.target.value } : x)) })} style={{ flex: 1 }} />
            <button className="btn ghost small" onClick={() => set({ cast: (c.cast ?? []).filter((_, k) => k !== i) })}>حذف</button>
          </div>
        ))}
        {voices ? (
          <select value="" onChange={(e) => { const v = voices.find((x) => x.id === e.target.value); if (v && !(c.cast ?? []).some((x) => x.id === v.id)) set({ cast: [...(c.cast ?? []), { id: v.id, name: v.name }] }); }}>
            <option value="">+ أضف صوتًا من حسابك…</option>
            {voices.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.category})</option>)}
          </select>
        ) : <span className="help">اضغط «اختيار من أصوات حسابك» فوق لتظهر قائمة الأصوات وتضيف منها. أضف الأصوات الجاهزة أولًا لمكتبتك في ElevenLabs (Voice Library).</span>}
      </div>

      <div className="brand-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <label className="field">
          <span>يوم الحلقة الطويلة</span>
          <select id="ch-day" value={sch.longDay} onChange={(e) => set({ schedule: { ...sch, longDay: Number(e.target.value) } })}>
            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </label>
        <label className="field"><span>الساعة</span><input id="ch-hour" type="text" dir="ltr" value={sch.time ?? ""} onChange={(e) => set({ schedule: { ...sch, time: e.target.value } })} placeholder="19:00" /></label>
        <label className="field"><span>شورتس في اليوم</span><input id="ch-shorts" type="number" min={0} max={3} value={sch.shortsPerDay ?? 1} onChange={(e) => set({ schedule: { ...sch, shortsPerDay: Number(e.target.value) } })} /></label>
      </div>

      <div className="field">
        <span>الأساليب التي تتناوب عليها حلقات القناة</span>
        <div className="chips">
          {ALL_STYLES.map((s) => {
            const on = styles.includes(s);
            return (
              <button key={s} className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => set({ styles: on ? styles.filter((x) => x !== s) : [...styles, s] })}>
                {on ? "✓ " : ""}{styleNamesAr[s] ?? s}
              </button>
            );
          })}
        </div>
        <span className="help">غرفة العمليات تنبّهك إن تكرر أسلوب حلقتين متتاليتين، وتقترح من هذه القائمة.</span>
      </div>
    </section>
  );
};
