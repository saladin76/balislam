import React, { useEffect, useState } from "react";
import { api } from "../api";
import type { ChannelConfig, ChannelDomain } from "../../../src/channel/types";
import { langPacks } from "../../../src/i18n/packs";
import { useTheme } from "../../../brand/identity/index";
import { LogoMark } from "../../../brand/logo/Logo";
import { ChannelBrand } from "./ChannelBrand";
import type { Identity } from "../../../brand/identity/index";

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
/** ترجمة معاني القرآن تحت بطاقة الآية (للقنوات غير العربية). */
const MeaningPicker: React.FC<{ value?: { id: number; name: string }; language: string; onChange: (v: { id: number; name: string } | undefined) => void }> = ({ value, language, onChange }) => {
  const [list, setList] = React.useState<{ id: number; name: string; author: string }[] | null>(null);
  const [msg, setMsg] = React.useState("");
  const load = async () => {
    setMsg("جارٍ التحميل…");
    try {
      const r = await api.quranTranslations(language);
      setList(r.list);
      setMsg(r.ok ? (r.list.length ? "" : "لا توجد ترجمات بهذه اللغة.") : (r.message ?? ""));
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <div className="field">
      <span>ترجمة معاني الآيات {language === "ar" ? <small>(لا حاجة لها في القناة العربية)</small> : null}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {list && list.length ? (
          <select id="ch-meaning" value={value?.id ?? ""} onChange={(e) => { const t = list.find((x) => x.id === Number(e.target.value)); onChange(t ? { id: t.id, name: t.name } : undefined); }} style={{ flex: 1, minWidth: 220 }}>
            <option value="">بلا ترجمة</option>
            {list.map((t) => <option key={t.id} value={t.id}>{t.name}{t.author ? ` — ${t.author}` : ""} (#{t.id})</option>)}
          </select>
        ) : (
          <span style={{ flex: 1 }}>{value ? <><b>{value.name}</b> <code>#{value.id}</code></> : <span className="help">بلا ترجمة</span>}</span>
        )}
        <button className="btn small" onClick={load}>اختيار من Quran Foundation</button>
        {value ? <button className="btn ghost small" onClick={() => onChange(undefined)}>إزالة</button> : null}
      </div>
      {msg ? <span className="help">{msg}</span> : <span className="help">تظهر تحت نص الآية بخط أصغر مع اسم الترجمة؛ تُجلب مع الآيات عند «جلب الآيات».</span>}
    </div>
  );
};

/** تلاوة الآيات من Quran Foundation: اختيار القارئ (اختياري). */
const ReciterPicker: React.FC<{ value?: { id: number; name: string }; onChange: (v: { id: number; name: string } | undefined) => void }> = ({ value, onChange }) => {
  const [list, setList] = React.useState<{ id: number; name: string; style: string }[] | null>(null);
  const [msg, setMsg] = React.useState("");
  const load = async () => {
    setMsg("جارٍ التحميل…");
    try {
      const r = await api.quranRecitations();
      setList(r.list);
      setMsg(r.ok ? "" : (r.message ?? ""));
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const styleAr = (s: string) => (/murattal/i.test(s) ? "مرتل" : /mujawwad/i.test(s) ? "مجوّد" : /muallim/i.test(s) ? "معلّم" : s);
  return (
    <div className="field">
      <span>تلاوة الآيات</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {list && list.length ? (
          <select id="ch-reciter" value={value?.id ?? ""} onChange={(e) => { const t = list.find((x) => x.id === Number(e.target.value)); onChange(t ? { id: t.id, name: t.name } : undefined); }} style={{ flex: 1, minWidth: 220 }}>
            <option value="">بلا تلاوة (نص الآية فقط)</option>
            {list.map((t) => <option key={t.id} value={t.id}>{t.name}{t.style ? ` · ${styleAr(t.style)}` : ""}</option>)}
          </select>
        ) : (
          <span style={{ flex: 1 }}>{value ? <b>{value.name}</b> : <span className="help">بلا تلاوة (نص الآية فقط)</span>}</span>
        )}
        <button className="btn small" onClick={load}>اختيار قارئ</button>
        {value ? <button className="btn ghost small" onClick={() => onChange(undefined)}>إيقاف التلاوة</button> : null}
      </div>
      <span className="help">{msg || "تُجلب تلاوة كل آية مع نصها من Quran Foundation وتُشغَّل في بطاقة الآية، ويُذكر القارئ في الوصف. التلاوة المرخّصة في assets/recitations لها الأولوية."}</span>
    </div>
  );
};

export const ChannelTab: React.FC<{ onCreated: (id: string) => void; onSaved: () => void; identity?: Identity }> = ({ onCreated, onSaved, identity }) => {
  const [c, setC] = useState<ChannelConfig | null>(null);
  const [saved, setSaved] = useState("");
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [newDomain, setNewDomain] = useState("");
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
        <h2>القناة</h2>
        <code className="help" style={{ direction: "ltr" }}>channels/{c.id}/channel.json</code>
        <span className="spacer" />
        <span className="status"><i className={`dot ${dirty ? "dirty" : ""}`} />{dirty ? "غير محفوظ" : "محفوظ"}</span>
        <button className="btn" disabled={!dirty} onClick={() => setC(JSON.parse(saved))}>تراجع</button>
        <button
          className="btn primary"
          disabled={!dirty}
          onClick={async () => {
            try {
              await api.saveChannel(c);
              setSaved(JSON.stringify(c));
              setMsg({ text: "حُفظت إعدادات القناة." });
              onSaved();
            } catch (e) {
              setMsg({ text: (e as Error).message, err: true });
            }
          }}
        >
          حفظ
        </button>
      </div>
      {msg ? <div className={`note ${msg.err ? "err" : ""}`}>{msg.text}</div> : null}

      <div className="ch-grid">
        <section className="group">
          <h3>الأساسيات</h3>
          <label className="field"><span>اسم القناة</span><input id="ch-name" type="text" value={c.name} onChange={(e) => set({ name: e.target.value })} /></label>
          <label className="field"><span>الاسم بالحروف اللاتينية</span><input id="ch-latin" type="text" dir="ltr" value={c.nameLatin} onChange={(e) => set({ nameLatin: e.target.value })} /></label>
          <label className="field"><span>وصف قصير</span><textarea id="ch-desc" rows={2} value={c.description} onChange={(e) => set({ description: e.target.value })} /></label>
          <label className="field">
            <span>اللغة</span>
            <select id="ch-lang" value={c.language} onChange={(e) => set({ language: e.target.value })}>
              {Object.values(langPacks).map((p) => <option key={p.code} value={p.code}>{p.nameAr} · {p.nativeName}{p.ready ? "" : " (تجهيز)"}</option>)}
            </select>
          </label>
          <div className="field">
            <span style={{ fontWeight: 600, fontSize: 13 }}>الرمز</span>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <LogoMark size={64} colors={logoTheme.logo} mark={c.logo} />
              <select id="ch-logo" value={c.logo?.type ?? "baa"} onChange={(e) => set({ logo: e.target.value === "letter" ? { type: "letter", letter: [...c.name][0] ?? "؟" } : { type: "baa" } })}>
                <option value="baa">باء التشغيل</option>
                <option value="letter">حرف القناة + زر التشغيل</option>
              </select>
              {c.logo?.type === "letter" ? <input id="ch-letter" type="text" value={c.logo.letter} maxLength={2} onChange={(e) => set({ logo: { type: "letter", letter: e.target.value } })} style={{ width: 60, textAlign: "center", fontSize: 20 }} /> : null}
            </div>
          </div>
        </section>

        <section className="group ch-wide">
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

        <section className="group">
          <h3>القواعد</h3>
          <label className="check"><input type="checkbox" checked={c.rules.quran} onChange={(e) => set({ rules: { ...c.rules, quran: e.target.checked } })} /><span>القناة تستشهد بالقرآن (بطاقات الآيات وجلب النصوص)</span></label>
          <label className="check"><input type="checkbox" checked={c.rules.hadith} onChange={(e) => set({ rules: { ...c.rules, hadith: e.target.checked } })} /><span>القناة تستشهد بالحديث (المقبول: {c.rules.hadithGrades.join(" و")})</span></label>
          <label className="check"><input type="checkbox" checked={!c.rules.faces} onChange={(e) => set({ rules: { ...c.rules, faces: !e.target.checked } })} /><span>شخصيات بلا ملامح وجه</span></label>
          <label className="check"><input type="checkbox" checked={!c.rules.music} onChange={(e) => set({ rules: { ...c.rules, music: !e.target.checked } })} /><span>بلا موسيقى (مؤثرات وآهات بشرية فقط)</span></label>
          {c.rules.quran ? <ReciterPicker value={c.recitation} onChange={(recitation) => set({ recitation })} /> : null}
          {c.rules.quran ? <MeaningPicker value={c.quranTranslation} language={c.language} onChange={(quranTranslation) => set({ quranTranslation })} /> : null}
          <h3>يوتيوب</h3>
          <label className="field"><span>وسوم القناة</span><TagsInput id="ch-tags" value={c.youtube.tags} onChange={(tags) => set({ youtube: { ...c.youtube, tags } })} /></label>
          <label className="field"><span>موعد النشر</span><input id="ch-time" type="text" dir="ltr" value={c.youtube.postingTime} onChange={(e) => set({ youtube: { ...c.youtube, postingTime: e.target.value } })} /></label>
          <label className="field"><span>سطر الإفصاح عن الصوت (في كل وصف)</span><textarea id="ch-disclosure" rows={3} value={c.youtube.voiceDisclosure} onChange={(e) => set({ youtube: { ...c.youtube, voiceDisclosure: e.target.value } })} /></label>
        </section>

        <ChannelBrand c={c} set={set} identity={identity} />

        <NewChannel onCreated={onCreated} />
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
      <h3>قناة جديدة <small>المحرك والمكتبة مشتركان؛ الهوية تبدأ نسخة من «بالإسلام» وتعدّلها</small></h3>
      <label className="field"><span>اسم القناة</span><input id="nc-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="تقنية بوعي" /></label>
      <label className="field"><span>المعرّف بالإنجليزية</span><input id="nc-id" type="text" dir="ltr" value={id} onChange={(e) => setId(e.target.value.toLowerCase())} required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="tech" /></label>
      <label className="field">
        <span>اللغة</span>
        <select id="nc-lang" value={lang} onChange={(e) => setLang(e.target.value)}>
          {Object.values(langPacks).map((p) => <option key={p.code} value={p.code}>{p.nameAr}</option>)}
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={quran} onChange={(e) => setQuran(e.target.checked)} /><span>تستشهد بالقرآن والحديث</span></label>
      {err ? <span className="help" style={{ color: "var(--err)" }}>{err}</span> : null}
      <button className="btn primary" type="submit" style={{ alignSelf: "flex-start" }}>إنشاء القناة</button>
    </form>
  );
};
