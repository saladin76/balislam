import { channelEngineFeatures, ENGINE_STATUS_AR, engineStatus } from "../../../src/plan/engine";
import React, { useState } from "react";
import { Player } from "@remotion/player";
import { api } from "../api";
import { channelInfo, type ChannelConfig } from "../../../src/channel/types";
import type { Identity } from "../../../brand/identity/index";
import { Providers } from "../../../src/remotion/Providers";
import { ChannelIntro, introFrames, type IntroKind } from "../../../src/remotion/scenes/ChannelIntro";
import { approvedIdentity } from "../../../brand/identity/approved";
import { templateExclusion } from "../../../src/channel/library";
import { styleNameAr, styleTemplate } from "../../../src/plan/styles";
import { Thumbnail } from "../../../src/remotion/Thumbnail";
import config from "../../../config.json";
import { tones, toneIds, voiceSettingsFor } from "../../../src/voice/tones";
import type { VoiceProfile } from "../../../src/channel/types";

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
/** أنماط عامة للقنوات التي لم تُعتمد هويتها بعد (الافتتاحيات المعتمدة محجوزة لقنواتها) */
const INTROS: [NonNullable<NonNullable<ChannelConfig["brand"]>["intro"]>, string][] = [["none", "بلا افتتاحية (حتى تُعتمد الهوية)"]];
const THUMBS: [NonNullable<NonNullable<ChannelConfig["brand"]>["thumbnail"]>, string][] = [["circle", "عامة بألوان القناة (حتى تُعتمد الهوية)"]];
const INTRO_AR: Record<string, string> = { mihrab: "محراب النور", horizon: "دفتر الأفق", highlighter: "القلم المميِّز" };
const secondsAr = (frames: number) => (frames / config.video.fps).toLocaleString("ar-EG", { maximumFractionDigits: 1 });
const ALL_STYLES = ["doc-plate", "motion", "board", "map-journey", "set-scene", "sim-stage", "desk-moment", "kinetic", "glow", "sketch-board", "timeline", "templates"];

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
  const approved = approvedIdentity(c.id);
  // الأساليب المسموحة: ما في مكتبة القناة فقط
  const allowedStyles = ALL_STYLES.filter((s) => { const t = styleTemplate(s); return !t || !templateExclusion(c, t); });
  return (
    <section className="group brand-group">
      <h3>بصمة القناة <small>ثابتة في كل حلقة؛ والتنوّع يكون داخل الحلقة</small></h3>

      <div className="brand-row">
        <label className="field">
          <span>الافتتاحية {intro !== "none" ? `(${secondsAr(introFrames(intro as IntroKind))} ث في أول الحلقة الطويلة)` : ""}</span>
          {approved ? (
            <span className="locked">🔒 «{INTRO_AR[intro] ?? intro}» — افتتاحية الهوية المعتمدة</span>
          ) : (
            <select id="ch-intro" value={intro} onChange={(e) => set({ brand: { ...c.brand, intro: e.target.value as typeof intro } })}>
              {INTROS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          )}
        </label>
        {intro !== "none" ? (
          <div className="brand-prev">
            <Player key={`${intro}-${c.name}`} component={IntroComp} inputProps={{ kind: intro as IntroKind, identity, channel: info }} durationInFrames={introFrames(intro as IntroKind) + 15} fps={config.video.fps} compositionWidth={1920} compositionHeight={1080} style={{ width: "100%" }} autoPlay loop controls acknowledgeRemotionLicense />
          </div>
        ) : null}
      </div>

      <div className="brand-row">
        <label className="field">
          <span>أسلوب الصورة المصغّرة</span>
          {approved ? (
            <span className="locked">🔒 «{INTRO_AR[thumb] ?? thumb}» — أسلوب المصغّرة المعتمد</span>
          ) : (
            <select id="ch-thumb" value={thumb} onChange={(e) => set({ brand: { ...c.brand, thumbnail: e.target.value as typeof thumb } })}>
              {THUMBS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          )}
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
        <span className="help">{vmsg || "صوتك المستنسخ هو الأساس في كل القنوات؛ وما يميز كل قناة طبقتها تحت. اختر صوتًا آخر هنا فقط إن نسخت صوتك نسخة خاصة بهذه القناة."}</span>
      </div>

      <VoiceRegister c={c} set={set} />

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
          {allowedStyles.map((s) => {
            const on = styles.includes(s);
            return (
              <button key={s} className={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => set({ styles: on ? styles.filter((x) => x !== s) : [...styles, s] })}>
                {on ? "✓ " : ""}{styleNameAr(s)}
              </button>
            );
          })}
        </div>
        <span className="help">الأساليب المتاحة من مكتبة القناة فقط. غرفة العمليات تنبّهك إن تكرر أسلوب حلقتين متتاليتين، وتقترح من هذه القائمة.</span>
      </div>
      <EnginePanel c={c} set={set} />
    </section>
  );
};

/**
 * أدوات المحرك (التوجيه الدائم): حالة كل ما بُني، في قوالب مكتبة هذه القناة وحدها.
 * الأساس يصير افتراضيًا للحلقات الجديدة فقط باعتماد صاحب القناة؛ والمؤثرات متاحة ولا تُفرض.
 */
const EnginePanel: React.FC<{ c: ChannelConfig; set: (p: Partial<ChannelConfig>) => void }> = ({ c, set }) => {
  const allowed = (t: string) => !templateExclusion(c, t);
  const rows = channelEngineFeatures(c.id).map((f) => ({ f, st: engineStatus(f, c, allowed) })).filter((r) => r.st !== "unavailable");
  if (!rows.length) return null;
  const defaults = c.production?.defaults ?? [];
  const toggle = (id: string, on: boolean) => {
    const next = on ? [...defaults.filter((x) => x !== id), id] : defaults.filter((x) => x !== id);
    const approvedAt = { ...(c.production?.approvedAt ?? {}) };
    if (on) approvedAt[id] = new Date().toISOString();
    else delete approvedAt[id];
    set({ production: { defaults: next, approvedAt } });
  };
  return (
    <div className="field" id="engine-panel">
      <span>أدوات المحرك <small>حالة ما بُني في الأوامر 005–011 لهذه القناة</small></span>
      <table className="engine-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          {rows.map(({ f, st }) => (
            <tr key={f.id} data-engine={f.id} data-status={st} style={{ borderTop: "1px solid var(--line, #0002)" }}>
              <td style={{ padding: "8px 4px", verticalAlign: "top" }}>
                <b>{f.nameAr}</b> <small style={{ opacity: 0.6 }}>({f.order})</small>
                <div className="help">{f.summary}</div>
                <div className="help">التحكم: {f.control}</div>
                {f.limits ? <div className="help">حدود: {f.limits}</div> : null}
              </td>
              <td style={{ padding: "8px 4px", verticalAlign: "top", whiteSpace: "nowrap" }}>
                <span className={`chip ${st === "default" || st === "always" ? "on" : ""}`}>{ENGINE_STATUS_AR[st]}</span>
                {f.kind === "base" ? (
                  <div style={{ marginTop: 6 }}>
                    {st === "default" ? (
                      <button className="btn small ghost" onClick={() => toggle(f.id, false)} title="الحلقات الجديدة تعود للسلوك القديم؛ القائمة لا تتغير">إلغاء الافتراضي</button>
                    ) : (
                      <button className="btn small" onClick={() => toggle(f.id, true)} title="يُختم في خطط الحلقات الجديدة فقط؛ الحلقات القائمة لا تتغير">اعتمده افتراضيًا للحلقات الجديدة</button>
                    )}
                    {c.production?.approvedAt?.[f.id] ? <div className="help">اعتُمد {new Date(c.production.approvedAt[f.id]!).toLocaleDateString("ar")}</div> : null}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="help">الاعتماد الافتراضي يُختم في خطة كل حلقة جديدة لحظة إنشائها، فلا يغيّر حلقة قائمة ولا فيديو معتمدًا، ويبقى تعديله لكل مشهد من محرر المشهد. المؤثرات (الإضاءة والانتقالات) لا تُفرض أبدًا.</span>
    </div>
  );
};

/** طبقات جاهزة: نقطة بداية لكل قناة، وتُضبط بالمنزلقات */
const REGISTERS: VoiceProfile[] = [
  { nameAr: "وقور هادئ", speed: 0.9, stability: 0.6, style: 0.08 },
  { nameAr: "راوٍ وثائقي", speed: 0.95, stability: 0.5, style: 0.22 },
  { nameAr: "سريع واضح", speed: 1.02, stability: 0.45, style: 0.28 },
  { nameAr: "حكّاء قريب", speed: 0.94, stability: 0.45, style: 0.3 },
];
const pct = (x: number) => `${Math.round(x * 100)}٪`;

/**
 * طبقة صوت القناة: صوت صاحب القناة نفسه بسرعة وثبات وتعبير خاصة بها، والنبرات (لكل حلقة أو مشهد) تتحرك حولها.
 * يظهر جدول بما تصير إليه كل نبرة في هذه القناة.
 */
const VoiceRegister: React.FC<{ c: ChannelConfig; set: (p: Partial<ChannelConfig>) => void }> = ({ c, set }) => {
  const p = c.voice?.profile;
  const put = (profile: VoiceProfile | undefined) => set({ voice: { ...c.voice, profile } });
  const [play, setPlay] = useState<PlayState>({ busy: false });
  const slider = (key: "speed" | "stability" | "style", label: string, help: string, min: number, max: number) => (
    <label className="field">
      <span>{label}: <b>{key === "speed" ? `${p![key].toFixed(2)}×` : pct(p![key])}</b> <small>{help}</small></span>
      <input type="range" min={min} max={max} step={0.01} value={p![key]} onChange={(e) => put({ ...p!, nameAr: p!.nameAr, [key]: Number(e.target.value) })} />
    </label>
  );
  return (
    <div className="field voice-register">
      <span>طبقة صوت القناة <small>(صوتك نفسه بإيقاع وإحساس أساسي خاص بهذه القناة؛ والنبرة تختارها لكل حلقة أو مشهد)</small></span>
      <div className="chips">
        {REGISTERS.map((r) => (
          <button key={r.nameAr} className={`chip ${p?.nameAr === r.nameAr ? "on" : ""}`} onClick={() => put({ ...r })}>{p?.nameAr === r.nameAr ? "✓ " : ""}{r.nameAr}</button>
        ))}
        {p ? <button className="chip" onClick={() => put(undefined)}>بلا طبقة (إعدادات الصوت العامة)</button> : null}
      </div>
      {p ? (
        <>
          <label className="field"><span>اسم الطبقة</span><input type="text" value={p.nameAr ?? ""} onChange={(e) => put({ ...p, nameAr: e.target.value })} /></label>
          {slider("speed", "السرعة", "أبطأ للتأمل، أسرع للخلاصات", 0.8, 1.1)}
          {slider("stability", "الثبات", "أعلى = أهدأ وأثبت، أقل = تلوين أكثر", 0.3, 0.8)}
          {slider("style", "التعبير", "أعلى = أداء أكثر حيوية (ومعه احتمال تذبذب أكبر)", 0, 0.5)}
        </>
      ) : null}
      <ListenPanel c={c} profile={p} play={play} setPlay={setPlay} />
      <table className="dom-table tone-table">
        <thead><tr><th>النبرة في الحلقة</th><th>السرعة</th><th>الثبات</th><th>التعبير</th><th>استمع</th></tr></thead>
        <tbody>
          {[undefined, ...toneIds].map((t) => {
            const v = voiceSettingsFor(p, t) ?? { speed: config.voice.speed, stability: config.voice.stability, style: config.voice.style };
            return (
              <tr key={t ?? "base"}>
                <td>{t ? <>{tones[t].nameAr} <small className="help">{tones[t].useAr}</small></> : <b>طبقة القناة وحدها</b>}</td>
                <td dir="ltr">{v.speed.toFixed(2)}×</td>
                <td>{pct(v.stability)}</td>
                <td>{pct(v.style)}</td>
                <td><button className="btn ghost small" disabled={play.busy} aria-label="استمع" onClick={() => setPlay({ ...play, request: { tone: t, n: Date.now() } })}>{play.playing === (t ?? "base") ? "■" : "▶"}</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <span className="help">تغيير الطبقة يعيد توليد صوت المشاهد غير المنشورة عند التوليد التالي (المشاهد التي لم يتغير صوتها لا يُعاد توليدها).</span>
    </div>
  );
};

type PlayState = { busy: boolean; playing?: string; request?: { tone?: string; n: number }; msg?: string };

/** نص تجربة لكل قناة: سطران بروح محتواها (بلا آيات: الصوت المستنسخ لا يتلو القرآن). */
const SAMPLE_TEXT: Record<string, string> = {
  balislam: "أحيانًا نؤجّل ما نعرف أنه مهم، لا لأننا كسالى، بل لأننا نخاف من الشعور الذي ينتظرنا عند البداية. فماذا لو بدأنا بخطوةٍ واحدةٍ صغيرة؟",
  "dafatir-alzaman": "في صيف عام ألفٍ ومئتين وثمانيةٍ وخمسين، وقف رجلٌ على أسوار بغداد يراقب الأفق، ولم يكن يعلم أن الأيام القادمة ستغيّر وجه التاريخ.",
  "zubdat-alkutub": "الفكرة الأولى في هذا الكتاب بسيطة جدًا: العادات الصغيرة تصنع النتائج الكبيرة. تحسّنٌ بواحدٍ في المئة كل يوم، يجعلك بعد سنةٍ شخصًا مختلفًا تمامًا.",
};

/** تجربة السماع: النص والنموذج، ويُشغَّل الصوت من أزرار جدول النبرات. */
const ListenPanel: React.FC<{ c: ChannelConfig; profile?: VoiceProfile; play: PlayState; setPlay: (s: PlayState) => void }> = ({ c, profile, play, setPlay }) => {
  const [text, setText] = useState(SAMPLE_TEXT[c.id] ?? "اكتب هنا سطرين بروح القناة لتسمع صوتك بطبقتها ونبراتها.");
  const [models, setModels] = useState<{ id: string; name: string; arabic: boolean }[] | null>(null);
  const [model, setModel] = useState("");
  const [spent, setSpent] = useState(0);
  const audio = React.useRef<HTMLAudioElement | null>(null);
  React.useEffect(() => {
    const r = play.request;
    if (!r) return;
    const key = r.tone ?? "base";
    if (play.playing === key && audio.current) {
      audio.current.pause();
      setPlay({ busy: false });
      return;
    }
    audio.current?.pause();
    setPlay({ busy: true, msg: "جارٍ التوليد…" });
    api.voiceSample(c.id, { text, tone: r.tone, model: model || undefined, profile })
      .then((x) => {
        setSpent((n) => n + x.chars);
        const a = new Audio(api.voiceSampleUrl(c.id, x.file));
        audio.current = a;
        a.onended = () => setPlay({ busy: false });
        a.play().catch(() => {});
        setPlay({ busy: false, playing: key, msg: x.cached ? "عيّنة محفوظة (بلا رصيد)" : `صُرف ${x.chars} حرفًا` });
      })
      .catch((e) => setPlay({ busy: false, msg: (e as Error).message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play.request?.n]);
  return (
    <div className="listen-panel">
      <label className="field">
        <span>تجربة السماع <small>(صوتك بطبقة القناة الحالية — حتى قبل الحفظ — وبكل نبرة؛ اضغط ▶ في الجدول)</small></span>
        <textarea rows={2} value={text} maxLength={400} onChange={(e) => setText(e.target.value)} />
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className="help">النموذج:</span>
        {models ? (
          <select value={model} onChange={(e) => setModel(e.target.value)} style={{ minWidth: 260 }}>
            <option value="">الحالي في الإعدادات</option>
            {models.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.id}){m.arabic ? "" : " — العربية غير مذكورة"}</option>)}
          </select>
        ) : (
          <button className="btn small" onClick={() => api.voiceModels(c.id).then((r) => setModels(r.models)).catch((e) => setPlay({ ...play, msg: (e as Error).message }))}>مقارنة بنموذج آخر</button>
        )}
        <span className="help">{play.msg ?? ""}{spent ? ` · مجموع هذه الجلسة: ${spent} حرف` : ""}</span>
      </div>
    </div>
  );
};
