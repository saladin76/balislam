import React, { useEffect, useState } from "react";
import { api } from "../api";
import { searchFoundationReciters } from "../workspace/reciterSearch";
import { filterRecitersByRights, type ReciterRightsFilter, commercialEvidenceFor } from "../workspace/recitationRights";
import type { ChannelConfig, ChannelDomain } from "../../../src/channel/types";
import { langPacks } from "../../../src/i18n/packs";
import { useTheme } from "../../../brand/identity/index";
import { LogoMark, emblemNamesAr, type EmblemId } from "../../../brand/logo/Logo";
import { ChannelBrand } from "./ChannelBrand";
import { ChannelIdentity } from "./ChannelIdentity";
import { approvedIdentity, reservedEmblems } from "../../../brand/identity/approved";
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
  const [loading, setLoading] = React.useState(false);
  const load = async () => {
    if (loading) return;
    setLoading(true);
    setMsg("جارٍ التحميل…");
    try {
      const r = await api.quranTranslations(language);
      setList(r.ok ? r.list : null);
      setMsg(r.ok ? (r.list.length ? "" : "لا توجد ترجمات بهذه اللغة.") : (r.message ?? "تعذّر تحميل الترجمات."));
    } catch (e) {
      setList(null);
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="field">
      <span>ترجمة معاني الآيات {language === "ar" ? <small>(لا حاجة لها في القناة العربية)</small> : null}</span>
      <div className="channel-provider-controls">
        {list && list.length ? (
          <select id="ch-meaning" aria-label="ترجمة معاني الآيات" value={value?.id ?? ""} onChange={(e) => { const t = list.find((x) => x.id === Number(e.target.value)); onChange(t ? { id: t.id, name: t.name } : undefined); }}>
            <option value="">بلا ترجمة</option>
            {value && !list.some((t) => t.id === value.id) ? <option value={value.id}>{value.name} (محفوظ سابقًا؛ غير موجود في القائمة الحالية)</option> : null}
            {list.map((t) => <option key={t.id} value={t.id}>{t.name}{t.author ? ` — ${t.author}` : ""} (#{t.id})</option>)}
          </select>
        ) : (
          <span style={{ flex: 1 }}>{value ? <><b>{value.name}</b> <code>#{value.id}</code></> : <span className="help">بلا ترجمة</span>}</span>
        )}
        <button className="btn small" type="button" disabled={loading} onClick={load}>{loading ? "جارٍ تحميل الترجمات…" : list ? "تحديث الترجمات" : "اختيار من Quran Foundation"}</button>
        {value ? <button className="btn ghost small" onClick={() => onChange(undefined)}>إزالة</button> : null}
      </div>
      <span className="help" role={msg ? "status" : undefined}>{msg || "تظهر تحت نص الآية بخط أصغر مع اسم الترجمة؛ تُجلب مع الآيات عند «جلب الآيات»."}</span>
    </div>
  );
};

/** تلاوة الآيات من Quran Foundation: اختيار القارئ (اختياري). */
const ReciterPicker: React.FC<{ value?: { id: number; name: string }; onChange: (v: { id: number; name: string } | undefined) => void }> = ({ value, onChange }) => {
  const [list, setList] = React.useState<{ id: number; name: string; style: string }[] | null>(null);
  const [msg, setMsg] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const found = searchFoundationReciters(list ?? [], search);
  const load = async () => {
    if (loading) return;
    setLoading(true);
    setMsg("جارٍ التحميل…");
    try {
      const r = await api.quranRecitations();
      setList(r.ok ? r.list : null);
      setMsg(r.ok ? (r.list.length ? "" : "لا توجد تلاوات متاحة.") : (r.message ?? "تعذّر تحميل القرّاء."));
    } catch (e) {
      setList(null);
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const styleAr = (s: string) => (/murattal/i.test(s) ? "مرتل" : /mujawwad/i.test(s) ? "مجوّد" : /muallim/i.test(s) ? "معلّم" : s);
  return (
    <div className="field">
      <span>تلاوة الآيات</span>
      {list && list.length > 0 && <div className="field">
        <label htmlFor="ch-reciter-search">ابحث في جميع القرّاء والأداءات المتاحة</label>
        <input id="ch-reciter-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="اسم القارئ، مرتل، مجود، أو رقم التسجيل" />
        <span className="help" role="status">{found.length} تسجيلًا مطابقًا من أصل {list.length} تسجيلًا لدى Quran Foundation</span>
      </div>}
      <div className="channel-provider-controls">
        {list && list.length ? (
          <select id="ch-reciter" aria-label="القارئ المختار" value={value?.id ?? ""} onChange={(e) => { const t = list.find((x) => x.id === Number(e.target.value)); onChange(t ? { id: t.id, name: t.name } : undefined); }}>
            <option value="">بلا تلاوة (نص الآية فقط)</option>
            {value && !found.some((t) => t.id === value.id) ? <option value={value.id}>{value.name} (المختار حاليًا خارج نتائج البحث)</option> : null}
            {found.map((t) => <option key={t.id} value={t.id}>{t.name}{t.style ? ` · ${styleAr(t.style)}` : ""}</option>)}
          </select>
        ) : (
          <span style={{ flex: 1 }}>{value ? <b>{value.name}</b> : <span className="help">بلا تلاوة (نص الآية فقط)</span>}</span>
        )}
        <button className="btn small" type="button" disabled={loading} onClick={load}>{loading ? "جارٍ تحميل القرّاء…" : list ? "تحديث القرّاء" : "اختيار قارئ"}</button>
        {value ? <button className="btn ghost small" type="button" onClick={() => onChange(undefined)}>إيقاف التلاوة</button> : null}
      </div>
      <span className="help" role={msg ? "status" : undefined}>{msg || "قائمة القرّاء تُجلب كاملة من Quran Foundation بلا حصر مسبق، ويمكن البحث فيها؛ مكتبة AlQuran Cloud في مساحة الحلقة تتيح الاستماع إلى تسجيلات أخرى. توفر التسجيل لا يعني تلقائيًا إذن نشره تجاريًا."}</span>
    </div>
  );
};

/** A channel preference for listening only; production requires a separate rights-gated episode choice. */
const CloudPreviewPicker: React.FC<{
  value?: { edition: string; name: string };
  onChange: (v: { edition: string; name: string } | undefined) => void;
}> = ({ value, onChange }) => {
  const [list, setList] = React.useState<{ identifier: string; name: string }[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [rightsFilter, setRightsFilter] = React.useState<ReciterRightsFilter>("all");
  const [sample, setSample] = React.useState<{ text: string; audio: string } | null>(null);
  const [sampleBusy, setSampleBusy] = React.useState(false);
  const [sampleError, setSampleError] = React.useState("");
  const [sampleEdition, setSampleEdition] = React.useState("");
  const auditionRequest = React.useRef(0);
  const mounted = React.useRef(true);
  React.useEffect(() => () => { mounted.current = false; auditionRequest.current++; }, []);
  React.useEffect(() => {
    auditionRequest.current++;
    setSample(null); setSampleError("");
  }, [value?.edition]);
  const listen = async () => {
    if (!value || sampleBusy) return;
    setSample(null); setSampleError(""); setSampleBusy(true);
    const requested = value.edition;
    const request = ++auditionRequest.current;
    setSampleEdition(requested);
    try {
      const r = await api.alquranAyah(1, 1, requested);
      if (mounted.current && request === auditionRequest.current) setSample({ text: r.text, audio: r.audio });
    } catch (e) {
      if (mounted.current && request === auditionRequest.current) setSampleError(e instanceof Error ? e.message : String(e));
    } finally { if (mounted.current) setSampleBusy(false); }
  };
  const load = async () => {
    if (loading) return;
    setLoading(true);
    setMessage("جارٍ تحميل قرّاء AlQuran Cloud…");
    try {
      const res = await api.alquranEditions();
      if (!mounted.current) return;
      setList(res.editions);
      setMessage(res.editions.length ? "" : "لم تُرجع الخدمة أي تسجيلات متاحة.");
    } catch (e) {
      if (mounted.current) { setList(null); setMessage(e instanceof Error ? e.message : String(e)); }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };
  const byRights = filterRecitersByRights(list ?? [], rightsFilter);
  const filtered = byRights.filter((r) =>
    r.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) ||
    r.identifier.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <div className="field channel-cloud-preview">
      <strong>AlQuran Cloud — اختيار القارئ والاستماع</strong>
      <p className="help">اختر قارئًا من التسجيلات المتاحة واستمع لعينة مباشرة. اضغط «حفظ» في إعدادات القناة لاعتماد اختيار المعاينة. لا يضاف الصوت تلقائيًا إلى الفيديو.</p>
      <div className="channel-provider-controls">
        <span>{value ? <><b>{value.name}</b> <code dir="ltr">{value.edition}</code></> : <span className="help">لم يُحدد قارئ للمعاينة</span>}</span>
        <button type="button" className="btn small" disabled={loading} onClick={load}>
          {loading ? "جارٍ التحميل…" : list ? "تحديث القرّاء" : "اختيار من AlQuran Cloud"}
        </button>
        {value && <button type="button" className="btn small" disabled={sampleBusy} onClick={listen}>{sampleBusy ? "جارٍ جلب العينة…" : "استمع لعينة"}</button>}
        {value && <button type="button" className="btn ghost small" onClick={() => { setSample(null); onChange(undefined); }}>إزالة الاختيار</button>}
      </div>
      {list && list.length > 0 && (
        <div className="channel-cloud-results">
          <label htmlFor="ch-cloud-rights">تصنيف حقوق الاستخدام التجاري</label>
          <select id="ch-cloud-rights" value={rightsFilter} onChange={(e) => setRightsFilter(e.target.value as ReciterRightsFilter)}>
            <option value="all">جميع القرّاء</option>
            <option value="verified">استخدام تجاري موثّق</option>
            <option value="review">يحتاج مراجعة</option>
          </select>
          <span className="help">AlQuran Cloud لا يرسل حالة الترخيص التجاري لكل تسجيل. فئة «موثّق» تظهر فقط عند تسجيل دليل نشر تجاري تمت مراجعته.</span>
          {rightsFilter !== "all" && <button type="button" className="btn ghost small" onClick={() => { setRightsFilter("all"); setSearch(""); }}>إظهار جميع القرّاء ومسح البحث</button>}
          <label htmlFor="ch-cloud-search">البحث عن قارئ</label>
          <input id="ch-cloud-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="اسم القارئ أو معرّفه" />
          <label htmlFor="ch-cloud-edition">التسجيلات المتاحة</label>
          <select id="ch-cloud-edition" value={value?.edition ?? ""} onChange={(e) => {
            const selected = list.find((item) => item.identifier === e.target.value);
            setSample(null); setSampleError("");
            onChange(selected ? { edition: selected.identifier, name: selected.name } : undefined);
          }}>
            <option value="">اختر قارئًا للمعاينة</option>
            {value && !filtered.some((item) => item.identifier === value.edition) && <option value={value.edition}>{value.name} (الاختيار المحفوظ خارج نتائج الفلتر)</option>}
            {filtered.map((item) => <option key={item.identifier} value={item.identifier}>{item.name} — {item.identifier}</option>)}
          </select>
          <span className="help" role="status">{filtered.length} نتيجة ضمن التصنيف المحدد. {rightsFilter === "verified" && !filtered.length ? "لا توجد تسجيلات ذات دليل تجاري متحقق منه حاليًا؛ ليست هذه نتيجة تفيد منع جميع التسجيلات." : ""}</span>
          {value && <span className="help">حالة القارئ المحدد: {commercialEvidenceFor(value.edition) ? "استخدام تجاري موثّق بدليل" : "يحتاج مراجعة حقوق الاستخدام"}</span>}
        </div>
      )}
      {sampleError && <span className="help" role="alert">{sampleError}</span>}
      {sample && value?.edition === sampleEdition && <div className="channel-cloud-results">
        <span className="help">عينة استماع: الفاتحة، الآية 1 — {value.name}</span>
        <p lang="ar" dir="rtl">{sample.text}</p>
        <audio controls preload="none" src={sample.audio} aria-label={`استمع إلى عينة القارئ ${value.name}`} />
      </div>}
      {message && <span className="help" role="status">{message}</span>}
    </div>
  );
};

export type ChannelSettingsDraft = { draft: ChannelConfig; saved: string };
export const ChannelTab: React.FC<{
  onCreated: (id: string) => void; onSaved: () => void; identity?: Identity;
  channelId?: string; draftCache?: ChannelSettingsDraft | null;
  onDraftCache?: (value: ChannelSettingsDraft) => void;
}> = ({ onCreated, onSaved, identity, channelId, draftCache, onDraftCache }) => {
  const [c, setC] = useState<ChannelConfig | null>(draftCache?.draft ?? null);
  const [saved, setSaved] = useState(draftCache?.saved ?? "");
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const logoTheme = useTheme(c?.masterTheme ?? "warm");
  const themeNames: Record<string, string> = { paper: useTheme("paper").nameAr, family: useTheme("family").nameAr, night: useTheme("night").nameAr, warm: useTheme("warm").nameAr };

  useEffect(() => {
    let live = true;
    api.channel(channelId).then((x) => {
      if (!live) return;
      // Keep unsaved text in memory, even after returning from another workspace.
      const dirtyDraft = draftCache && JSON.stringify(draftCache.draft) !== draftCache.saved;
      setC(dirtyDraft ? draftCache.draft : x);
      setSaved(JSON.stringify(x));
    }).catch((x) => {
      if (live) setMsg({ text: `تعذّر تحميل إعدادات القناة: ${(x as Error).message}`, err: true });
    });
    return () => { live = false; };
    // Parent remounts this editor by its channelId. A callback identity change is not a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);
  useEffect(() => {
    if (c) onDraftCache?.({ draft: c, saved });
  }, [c, saved, onDraftCache]);
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
        <span className="status" role="status"><i className={`dot ${dirty ? "dirty" : ""}`} />{saving ? "جارٍ الحفظ…" : dirty ? "تغييرات غير محفوظة" : "محفوظ"}</span>
        <button className="btn" disabled={!dirty || saving} onClick={() => setC(JSON.parse(saved))}>تراجع</button>
        <button
          className="btn primary"
          disabled={!dirty || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await api.saveChannel(c, channelId);
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
      </div>
      {msg ? <div className={`note ${msg.err ? "err" : ""}`}>{msg.text}</div> : null}

      <nav className="channel-section-nav" aria-label="أقسام إعدادات القناة">
        <a href="#channel-identity">الهوية</a>
        <a href="#channel-basics">الأساسيات</a>
        <a href="#channel-domains">المجالات</a>
        <a href="#channel-rules">قواعد المحتوى</a>
        {c.rules.quran && <a href="#channel-quran">القرآن والتلاوات</a>}
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
                set({ language, quranTranslation: undefined });
                if (c.quranTranslation) setMsg({ text: "تغيّرت لغة القناة؛ أُزيل اختيار الترجمة السابق من المسودة فقط. راجع الترجمة المناسبة قبل الحفظ." });
              }
            }}>
              {Object.values(langPacks).map((p) => <option key={p.code} value={p.code}>{p.nameAr} · {p.nativeName}{p.ready ? "" : " (تجهيز)"}</option>)}
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
          <h3>قواعد المحتوى <small>عرض الإعدادات الحالية دون تغيير طريقة الإنتاج</small></h3>
          <label className="check"><input type="checkbox" checked={c.rules.quran} onChange={(e) => set({ rules: { ...c.rules, quran: e.target.checked } })} /><span>القناة تستشهد بالقرآن (بطاقات الآيات وجلب النصوص)</span></label>
          <label className="check"><input type="checkbox" checked={c.rules.hadith} onChange={(e) => set({ rules: { ...c.rules, hadith: e.target.checked } })} /><span>القناة تستشهد بالحديث (المقبول: {c.rules.hadithGrades.join(" و")})</span></label>
          <label className="check"><input type="checkbox" checked={!c.rules.faces} onChange={(e) => set({ rules: { ...c.rules, faces: !e.target.checked } })} /><span>إخفاء ملامح وجوه الشخصيات</span></label>
          <label className="check"><input type="checkbox" checked={!c.rules.music} onChange={(e) => set({ rules: { ...c.rules, music: !e.target.checked } })} /><span>منع الموسيقى (السماح بالمؤثرات غير الموسيقية فقط)</span></label>
        </section>

        {c.rules.quran && <section id="channel-quran" className="group channel-settings-section channel-settings-quran ch-wide">
          <h3>مصادر القرآن والتلاوات <small>Quran Foundation وAlQuran Cloud والترجمة</small></h3>
          <p className="help">إعدادات مصادر الآيات والمعاينة؛ تحديد صوت AlQuran Cloud للاستماع لا يمنح إذن نشره في الفيديو.</p>
          <ReciterPicker value={c.recitation} onChange={(recitation) => set({ recitation })} />
          <CloudPreviewPicker value={c.alquranPreviewRecitation} onChange={(alquranPreviewRecitation) => set({ alquranPreviewRecitation })} />
          <MeaningPicker key={c.language} value={c.quranTranslation} language={c.language} onChange={(quranTranslation) => set({ quranTranslation })} />
        </section>}

        <section id="channel-youtube" className="group channel-settings-section">
          <h3>يوتيوب والنشر</h3>
          <label className="field"><span>وسوم القناة</span><TagsInput id="ch-tags" value={c.youtube.tags} onChange={(tags) => set({ youtube: { ...c.youtube, tags } })} /></label>
          <label className="field"><span>وقت النشر والمنطقة الزمنية</span><input id="ch-time" type="text" dir="ltr" placeholder="19:00 Asia/Riyadh" aria-describedby="ch-time-help" value={c.youtube.postingTime} onChange={(e) => set({ youtube: { ...c.youtube, postingTime: e.target.value } })} /><small className="help" id="ch-time-help">الصيغة المقترحة: 19:00 Asia/Riyadh. يُحفظ وقت النشر كإعداد للقناة ولا ينشر تلقائيًا.</small></label>
          <label className="field"><span>توقيع القناة (سطر ثابت في آخر كل وصف)</span><textarea id="ch-footer" rows={3} value={c.youtube.footer ?? ""} onChange={(e) => set({ youtube: { ...c.youtube, footer: e.target.value } })} /></label>
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
      {err ? <span className="help" style={{ color: "var(--err)" }}>{err}</span> : null}
      <button className="btn primary" type="submit" style={{ alignSelf: "flex-start" }}>إنشاء القناة</button>
    </form>
  );
};
