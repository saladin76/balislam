import React, { useEffect, useState } from "react";
import { api } from "../api";
import type { ChannelConfig, ChannelDomain } from "../../../src/channel/types";
import { langPacks } from "../../../src/i18n/packs";
import { useTheme } from "../../../brand/identity/index";
import { LogoMark, emblemNamesAr, type EmblemId } from "../../../brand/logo/Logo";
import { ChannelBrand } from "./ChannelBrand";
import { ChannelIdentity } from "./ChannelIdentity";
import { ChannelSeasons } from "./Seasons";
import { approvedIdentity, reservedEmblems } from "../../../brand/identity/approved";
import type { Identity } from "../../../brand/identity/index";
import { versesAreCitations } from "../../../src/quran/citation";
import { OwnerText } from "../ui/OwnerText";

const SLOTS: ChannelDomain["theme"][] = ["paper", "family", "night", "warm"];

const Swatch: React.FC<{ slot: ChannelDomain["theme"] }> = ({ slot }) => {
  const t = useTheme(slot);
  return <span title={t.nameAr} style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, background: t.colors.primary, border: `3px solid ${t.colors.bg}`, boxShadow: "0 0 0 1px var(--line)" }} />;
};


/** حقل وسوم يحتفظ بالنص كما يُكتب (حتى الفاصلة الأخيرة) ويحوّله إلى قائمة عند كل تغيير. */
const TagsInput: React.FC<{ value: string[]; onChange: (tags: string[]) => void; id?: string; label?: string }> = ({ value, onChange, id, label }) => {
  const [text, setText] = React.useState(value.join("، "));
  const joined = value.join("، ");
  React.useEffect(() => {
    // مزامنة عند تغيّر القيمة من الخارج (تراجع/تحميل)
    if (text.split(/[,،]\s*/).map((t) => t.trim()).filter(Boolean).join("، ") !== joined) setText(joined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);
  return (
    <input id={id} type="text" aria-label={label} value={text} onChange={(e) => { setText(e.target.value); onChange(e.target.value.split(/[,،]\s*/).map((t) => t.trim()).filter(Boolean)); }} />
  );
};

/** إعدادات القناة (channel.json) وإنشاء قناة جديدة. */
export const ChannelTab: React.FC<{ onCreated: (id: string) => void; onSaved: () => void; identity?: Identity }> = ({ onCreated, onSaved, identity }) => {
  const [c, setC] = useState<ChannelConfig | null>(null);
  const [saved, setSaved] = useState("");
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const logoTheme = useTheme(c?.masterTheme ?? "warm");
  const themeNames: Record<string, string> = { paper: useTheme("paper").nameAr, family: useTheme("family").nameAr, night: useTheme("night").nameAr, warm: useTheme("warm").nameAr };

  useEffect(() => {
    api.channel().then((x) => {
      setC(x);
      setSaved(JSON.stringify(x));
    }).catch((x) => setMsg({ text: `تعذّر تحميل إعدادات القناة: ${(x as Error).message}`, err: true }));
  }, []);
  if (!c) return <div className="empty-state"><h2>{msg?.err ? msg.text : "جارٍ التحميل…"}</h2></div>;
  const dirty = JSON.stringify(c) !== saved;
  const set = (patch: Partial<ChannelConfig>) => setC({ ...c, ...patch });
  const setDomain = (id: string, patch: Partial<ChannelDomain>) => set({ domains: { ...c.domains, [id]: { ...c.domains[id]!, ...patch } } });

  return (
    <div className="channel-tab">
      <div className="toolbar">
        <h2 title={`channels/${c.id}/channel.json`}>القناة</h2>
        <span className="spacer" />
        <span className="status" role="status"><i className={`dot ${dirty ? "dirty" : ""}`} />{saving ? "جارٍ الحفظ…" : dirty ? "تغييرات غير محفوظة" : "محفوظ"}</span>
        {/* No disabled primary (D52): the save pair appears only when there is something to save. */}
        {dirty || saving ? <>
        <button className="btn" disabled={saving} onClick={() => setC(JSON.parse(saved))}>تراجع</button>
        <button
          className="btn primary"
          aria-busy={saving}
          onClick={async () => {
            if (saving) return;
            setSaving(true);
            try {
              await api.saveChannel(c);
              setSaved(JSON.stringify(c));
              setMsg({ text: "حُفظت إعدادات القناة." });
              onSaved();
            } catch (e) {
              setMsg({ text: (e as Error).message, err: true });
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "جارٍ الحفظ…" : "حفظ"}
        </button>
        </> : null}
      </div>
      {msg ? <div className={`note ${msg.err ? "err" : ""}`}><OwnerText text={msg.text} /></div> : null}

      <nav className="channel-section-nav" aria-label="أقسام إعدادات القناة">
        <a href="#channel-identity">الهوية</a>
        <a href="#channel-basics">الأساسيات</a>
        <a href="#channel-domains">المجالات</a>
        <a href="#channel-rules">قواعد المحتوى</a>
        {c.rules.quran && <a href="#channel-quran">{versesAreCitations(c) ? "القرآن" : "القرآن والتلاوات"}</a>}
        <a href="#channel-youtube">النشر</a>
        <a href="#channel-brand">بصمة القناة</a>
        <a href="#channel-new">قناة جديدة</a>
      </nav>
      <div className="ch-grid channel-settings-grid">
        <div id="channel-identity" className="channel-identity-slot"><ChannelIdentity c={c} identity={identity} /></div>

        <section id="channel-basics" className="group channel-settings-section">
          <h3>الأساسيات</h3>
          <label className="field"><span>اسم القناة</span><input id="ch-name" type="text" value={c.name} onChange={(e) => set({ name: e.target.value })} /></label>
          <label className="field"><span>الاسم كما يُرسم على الصور <small>(بالتشكيل إن لزم؛ فارغ = اسم القناة)</small></span><input id="ch-display" type="text" value={c.nameDisplay ?? ""} onChange={(e) => set({ nameDisplay: e.target.value || undefined })} /></label>
          <label className="field"><span>الاسم بالحروف اللاتينية</span><input id="ch-latin" type="text" dir="ltr" value={c.nameLatin} onChange={(e) => set({ nameLatin: e.target.value })} /></label>
          <label className="field"><span>وصف قصير</span><textarea id="ch-desc" rows={2} value={c.description} onChange={(e) => set({ description: e.target.value })} /></label>
          <label className="field">
            <span>اللغة</span>
            <select id="ch-lang" value={c.language} onChange={(e) => {
              const language = e.target.value;
              if (language !== c.language) {
                set({ language });
              }
            }}>
              {Object.values(langPacks).map((p) => <option key={p.code} value={p.code}>{p.nameAr} — {p.nativeName}{p.ready ? "" : " (تجهيز)"}</option>)}
            </select>
          </label>
          <div className="field">
            <span style={{ fontWeight: 600, fontSize: 13 }}>الرمز</span>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <LogoMark size={64} colors={logoTheme.logo} mark={c.logo} />
              {approvedIdentity(c.id) ? (
                <span className="locked">🔒 شارة «{approvedIdentity(c.id)!.nameAr}» المعتمدة</span>
              ) : <select id="ch-logo" value={c.logo?.type === "emblem" ? `emblem:${c.logo.emblem}` : (c.logo?.type ?? "baa")} onChange={(e) => { const v = e.target.value; set({ logo: v === "letter" ? { type: "letter", letter: [...c.name][0] ?? "؟" } : v.startsWith("emblem:") ? { type: "emblem", emblem: v.slice(7) as EmblemId } : { type: "baa" } }); }}>
                <option value="baa">باء التشغيل</option>
                <option value="letter">حرف القناة + زر التشغيل</option>
                {(Object.keys(emblemNamesAr) as EmblemId[]).filter((e) => !reservedEmblems().has(e)).map((e) => <option key={e} value={`emblem:${e}`}>شارة: {emblemNamesAr[e]}</option>)}
              </select>}
              {c.logo?.type === "letter" ? <input id="ch-letter" type="text" value={c.logo.letter} maxLength={2} onChange={(e) => set({ logo: { type: "letter", letter: e.target.value } })} style={{ width: 60, textAlign: "center", fontSize: 20 }} /> : null}
            </div>
          </div>
        </section>

        <section id="channel-domains" className="group channel-settings-section ch-wide">
          <h3>المجالات <small>كل مجال له ثيم يحدد ألوان حلقاته</small></h3>
          <table className="dom-table">
            <thead><tr><th>المعرّف</th><th>الاسم</th><th>الثيم</th><th>الوسوم</th><th /></tr></thead>
            <tbody>
              {Object.entries(c.domains).map(([id, d]) => (
                <tr key={id}>
                  <td><code style={{ direction: "ltr" }}>{id}</code></td>
                  <td><input type="text" value={d.name} onChange={(e) => setDomain(id, { name: e.target.value })} aria-label={`اسم ${id}`} /></td>
                  <td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <Swatch slot={d.theme} />
                      <select value={d.theme} onChange={(e) => setDomain(id, { theme: e.target.value as ChannelDomain["theme"] })} aria-label={`ثيم ${id}`} style={{ minWidth: 120 }}>
                        {SLOTS.map((s) => <option key={s} value={s}>{themeNames[s]}</option>)}
                      </select>
                    </div>
                  </td>
                  <td><TagsInput value={d.tags} onChange={(tags) => setDomain(id, { tags })} label={`وسوم ${id}`} /></td>
                  <td>
                    <button className="btn ghost small" disabled={Object.keys(c.domains).length < 2} onClick={() => { const { [id]: _drop, ...rest } = c.domains; set({ domains: rest }); }}>حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="new-domain-id" type="text" dir="ltr" placeholder="معرّف جديد بالإنجليزية، مثل health" value={newDomain} onChange={(e) => setNewDomain(e.target.value.toLowerCase())} style={{ maxWidth: 260 }} />
            <button className="btn small" disabled={!/^[a-z0-9-]+$/.test(newDomain) || newDomain in c.domains} onClick={() => { setDomain(newDomain, { name: newDomain, theme: c.masterTheme, tags: [] }); setNewDomain(""); }}>إضافة مجال</button>
          </div>
          <label className="field">
            <span>الثيم الأساسي (للصور العامة)</span>
            <select id="ch-master" value={c.masterTheme} onChange={(e) => set({ masterTheme: e.target.value as ChannelConfig["masterTheme"] })}>
              {SLOTS.map((s) => <option key={s} value={s}>{themeNames[s]}</option>)}
            </select>
          </label>
        </section>

        <section id="channel-rules" className="group channel-settings-section">
          <h3>قواعد المحتوى <small>ما تلتزم به القناة في كل حلقاتها؛ أي تعديل يُظهر زر الحفظ أعلى الصفحة</small></h3>
          <label className="check"><input type="checkbox" checked={c.rules.quran} onChange={(e) => set({ rules: { ...c.rules, quran: e.target.checked } })} /><span>القناة تستشهد بالقرآن (بطاقات الآيات بنصها المكتوب في السكريبت)</span></label>
          <label className="check"><input type="checkbox" checked={c.rules.hadith} onChange={(e) => set({ rules: { ...c.rules, hadith: e.target.checked } })} /><span>القناة تستشهد بالحديث (المقبول: {c.rules.hadithGrades.join(" و")})</span></label>
          <label className="check"><input type="checkbox" checked={!c.rules.faces} onChange={(e) => set({ rules: { ...c.rules, faces: !e.target.checked } })} /><span>إخفاء ملامح وجوه الشخصيات</span></label>
          <label className="check"><input type="checkbox" checked={!c.rules.music} onChange={(e) => set({ rules: { ...c.rules, music: !e.target.checked } })} /><span>منع الموسيقى (السماح بالمؤثرات غير الموسيقية فقط)</span></label>
        </section>

        {c.rules.quran && <section id="channel-quran" className="group channel-settings-section channel-settings-quran ch-wide">
          <h3>{versesAreCitations(c) ? "الآيات" : "الآيات والتلاوات"}</h3>
          {versesAreCitations(c) ? (
            <p className="help">الآية في هذه القناة استشهاد مكتوب صامت: يقول الراوي «كما جاء في سورة كذا»، وتظهر بطاقة الآية بنصها ومرجعها بلا تلاوة. اكتب نص كل آية ومرجعها في سكريبت الحلقة. لا يُرفع تسجيل للآيات، ولا يُجلب القرآن ولا يُولَّد بالصوت.</p>
          ) : (
            <p className="help">اكتب الآيات وأرقامها في سكريبت الحلقة. سجّل التلاوة بنفسك وارفعها من الاستوديو: في «الجمل» تحت مشهد الآية، أو في الخطوة ٣ «التلاوات». يُحفظ الأصل كما سُجّل بجوار نسخة معالجة، وتعتمدها بعد الاستماع. لا جلب ولا توليد للقرآن.</p>
          )}
        </section>}

        <section id="channel-youtube" className="group channel-settings-section">
          <h3>يوتيوب والنشر</h3>
          <label className="field"><span>وسوم القناة</span><TagsInput id="ch-tags" value={c.youtube.tags} onChange={(tags) => set({ youtube: { ...c.youtube, tags } })} /></label>
          <label className="field"><span>وقت النشر والمنطقة الزمنية</span><input id="ch-time" type="text" dir="ltr" placeholder="19:00 Asia/Riyadh" aria-describedby="ch-time-help" value={c.youtube.postingTime} onChange={(e) => set({ youtube: { ...c.youtube, postingTime: e.target.value } })} /><small className="help" id="ch-time-help">الصيغة المقترحة: 19:00 Asia/Riyadh. يُحفظ وقت النشر كإعداد للقناة ولا ينشر تلقائيًا.</small></label>
          <label className="field"><span>توقيع القناة (سطر ثابت في آخر كل وصف)</span><textarea id="ch-footer" rows={3} value={c.youtube.footer ?? ""} onChange={(e) => set({ youtube: { ...c.youtube, footer: e.target.value } })} /></label>
        </section>

        <section id="channel-seasons" className="group channel-settings-section ch-wide">
          <h3>مواسم السنة <small>المواسم المتفق عليها بالتقويم الهجري، وموعد «جاهز قبل» (ستة أسابيع على الأقل)، وحلقات كل موسم</small></h3>
          <ChannelSeasons />
        </section>

        <div id="channel-brand" className="channel-brand-slot"><ChannelBrand c={c} set={set} identity={identity} /></div>

        <div id="channel-new" className="channel-new-slot"><NewChannel onCreated={onCreated} /></div>
      </div>
    </div>
  );
};

const NewChannel: React.FC<{ onCreated: (id: string) => void }> = ({ onCreated }) => {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [lang, setLang] = useState("ar");
  const [quran, setQuran] = useState(true);
  const [err, setErr] = useState("");
  return (
    <form
      className="group"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr("");
        try {
          await api.createChannel({ id, name, language: lang, quran });
          onCreated(id);
        } catch (x) {
          setErr((x as Error).message);
        }
      }}
    >
      <h3>قناة جديدة <small>المحرك مشترك؛ تبدأ بهوية مؤقتة محايدة (بلا بصمة أي قناة) حتى تُعتمد هويتها بستوري بورد</small></h3>
      <label className="field"><span>اسم القناة</span><input id="nc-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="تقنية بوعي" /></label>
      <label className="field"><span>المعرّف بالإنجليزية</span><input id="nc-id" type="text" dir="ltr" value={id} onChange={(e) => setId(e.target.value.toLowerCase())} required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="tech" /></label>
      <label className="field">
        <span>اللغة</span>
        <select id="nc-lang" value={lang} onChange={(e) => setLang(e.target.value)}>
          {Object.values(langPacks).map((p) => <option key={p.code} value={p.code}>{p.nameAr}</option>)}
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={quran} onChange={(e) => setQuran(e.target.checked)} /><span>تستشهد بالقرآن والحديث</span></label>
      {err ? <span className="help" style={{ color: "var(--err)" }}><OwnerText text={err} /></span> : null}
      <button className="btn primary" type="submit" style={{ alignSelf: "flex-start" }}>إنشاء القناة</button>
    </form>
  );
};
