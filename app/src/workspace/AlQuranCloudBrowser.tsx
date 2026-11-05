import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, type AlQuranAudioEdition, type AlQuranAyahPreview } from "../api";
import type { EpisodeMedia } from "../../../src/plan/media";
import type { CloudRecitation } from "../../../src/quran/provider";
import { filterRecitersByRights, commercialEvidenceFor, type ReciterRightsFilter } from "./recitationRights";

/** A local preview preference only: NEVER an approved production recitation choice. */
export const previewReciterKey = (channelId: string, episodeId: string) =>
  `balislam:alquran-preview:${encodeURIComponent(channelId)}:${encodeURIComponent(episodeId)}`;

/** Channel preview choice is used only when this episode has no explicit preview override. */
export const previewEditionFor = (episodeChoice: string | null, channelChoice?: string): string => {
  const valid = (s?: string | null) => !!s && /^ar\.[a-z0-9._-]{1,75}$/i.test(s);
  return valid(episodeChoice) ? episodeChoice! : valid(channelChoice) ? channelChoice! : "ar.alafasy";
};

export const filterAudioEditions = (editions: AlQuranAudioEdition[], term: string) => {
  const query = term.trim().toLocaleLowerCase();
  return query ? editions.filter((e) =>
    e.name.toLocaleLowerCase().includes(query) || e.identifier.toLowerCase().includes(query)) : editions;
};

/** Per-episode preview and explicit rights-gated reciter selection; never writes plan.json. */
export const AlQuranCloudBrowser: React.FC<{ channelId: string; episodeId: string; onMedia?: (media: EpisodeMedia) => void }> = ({ channelId, episodeId, onMedia }) => {
  const [enabled, setEnabled] = useState(false);
  const [editions, setEditions] = useState<AlQuranAudioEdition[]>([]);
  const [edition, setEdition] = useState("ar.alafasy");
  const [search, setSearch] = useState("");
  const [rightsFilter, setRightsFilter] = useState<ReciterRightsFilter>("all");
  const [surah, setSurah] = useState(1);
  const [ayah, setAyah] = useState(1);
  const [preview, setPreview] = useState<AlQuranAyahPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [licenceHolder, setLicenceHolder] = useState("");
  const [licenceEvidence, setLicenceEvidence] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [productionStatus, setProductionStatus] = useState("");
  const [activeProduction, setActiveProduction] = useState<CloudRecitation | null>(null);
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);
  const previewManuallyChanged = useRef(false);
  const visibleEditions = useMemo(() => filterAudioEditions(filterRecitersByRights(editions, rightsFilter), search), [editions, search, rightsFilter]);

  useEffect(() => {
    setEnabled(false); setEditions([]); setPreview(null); setError(""); setSearch(""); setSurah(1); setAyah(1);
    setLicenceHolder(""); setLicenceEvidence(""); setConfirmed(false); setProductionStatus(""); setActiveProduction(null);
    let alive = true;
    previewManuallyChanged.current = false;
    mounted.current = true;
    api.recitationChoice(episodeId, channelId).then(({ recitation }) => {
      if (!alive) return;
      setActiveProduction(recitation);
    }).catch(() => { /* the production form handles API failures when used */ });
    // Episode preview preference overrides the channel preview default.
    // Neither preference is an authorisation for production or publication.
    let stored: string | null = null;
    try { stored = localStorage.getItem(previewReciterKey(channelId, episodeId)); }
    catch { /* storage may be disabled */ }
    if (stored && /^ar\.[a-z0-9._-]{1,75}$/i.test(stored)) {
      setEdition(previewEditionFor(stored));
    } else {
      setEdition(previewEditionFor(null));
      api.channelFor(channelId).then((channel) => {
        const preferred = channel.alquranPreviewRecitation?.edition;
        if (alive && !previewManuallyChanged.current) setEdition(previewEditionFor(null, preferred));
      }).catch(() => { /* keep safe preview fallback */ });
    }
    return () => { alive = false; mounted.current = false; };
  }, [channelId, episodeId]);

  const selectEdition = (id: string) => {
    previewManuallyChanged.current = true;
    setEdition(id); setPreview(null);
    try { localStorage.setItem(previewReciterKey(channelId, episodeId), id); } catch { /* restricted browser storage */ }
  };

  const open = async () => {
    setEnabled(true); setLoading(true); setError(""); setPreview(null);
    try {
      const res = await api.alquranEditions();
      setEditions(res.editions);
      if (!res.editions.some((e) => e.identifier === edition)) {
        const fallback = res.editions.some((e) => e.identifier === "ar.alafasy")
          ? "ar.alafasy" : (res.editions[0]?.identifier ?? "");
        selectEdition(fallback);
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };

  const listen = async () => {
    setLoading(true); setPreview(null); setError("");
    try { setPreview(await api.alquranAyah(surah, ayah, edition)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };

  const activateProduction = async () => {
    if (!confirmed || !licenceHolder.trim()) {
      setError("لا بد من تحديد صاحب التسجيل وتأكيد امتلاك إذن النشر قبل الاعتماد.");
      return;
    }
    try {
      const evidence = new URL(licenceEvidence.trim());
      if (evidence.protocol !== "https:" || !evidence.hostname || evidence.username || evidence.password)
        throw new Error("رابط الإذن يجب أن يكون HTTPS صالحًا.");
    } catch {
      setError("أضف رابط HTTPS مباشرًا إلى مستند الإذن الفعلي من صاحب التسجيل.");
      return;
    }
    setSaving(true); setError(""); setProductionStatus("");
    try {
      const original = (await api.recitationChoice(episodeId, channelId)).recitation;
      const selectedName = editions.find((e) => e.identifier === edition)?.name || edition;
      const selected: CloudRecitation = {
        provider: "alquran-cloud", edition, name: selectedName,
        licence: {
          holder: licenceHolder.trim(), evidence: licenceEvidence.trim(),
          scope: "إذن نشر تسجيل القارئ على يوتيوب للاستخدام التجاري",
          verifiedAt: new Date().toISOString(),
        },
      };
      await api.saveRecitationChoice(episodeId, channelId, selected);
      try {
        const r = await api.quran(episodeId, channelId);
        if (r.result.failed.length)
          throw new Error(r.result.failed.map((x) => `${x.ref}: ${x.reason}`).join("؛ "));
        if (onMedia) {
          const episode = await api.episode(episodeId, channelId);
          if (mounted.current) onMedia(episode.media);
        }
        setActiveProduction(selected);
        setProductionStatus(`تم ربط ${selectedName} بإنتاج هذه الحلقة وحدها وجلب تلاواتها؛ راجع معاينة الرندر قبل النشر.`);
      } catch (e) {
        await api.saveRecitationChoice(episodeId, channelId, original);
        throw e;
      }
    } catch (e) { setError(`فشل اعتماد التلاوة، ولم يُستكمل تغيير المصدر: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setSaving(false); }
  };

  const restoreChannelDefault = async () => {
    setSaving(true); setError(""); setProductionStatus("");
    try {
      const original = (await api.recitationChoice(episodeId, channelId)).recitation;
      await api.saveRecitationChoice(episodeId, channelId, null);
      try {
        const r = await api.quran(episodeId, channelId);
        if (r.result.failed.length) throw new Error(r.result.failed.map((x) => x.reason).join("؛ "));
        if (onMedia) {
          const episode = await api.episode(episodeId, channelId);
          if (mounted.current) onMedia(episode.media);
        }
        setActiveProduction(null);
        setProductionStatus("أُلغي تخصيص قارئ هذه الحلقة؛ عاد المصدر الافتراضي للقناة.");
      } catch (e) {
        await api.saveRecitationChoice(episodeId, channelId, original);
        throw e;
      }
    } catch (e) { setError(`تعذر الرجوع للمصدر الافتراضي: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setSaving(false); }
  };

  return (
    <section className="group ew-reciter-panel" aria-label="مكتبة AlQuran Cloud للقرآن">
      <h4 className="ew-reciter-title">مكتبة القرّاء <span>AlQuran Cloud</span></h4>
      <p className="ew-reciter-subtitle">اختر قارئًا واستمع إلى آية أولًا. ربط صوته بفيديو الحلقة إجراء مستقل يتطلب إذن استخدام التسجيل.</p>
      {activeProduction && <div className="ew-current-reciter" role="status">
        <span>القارئ الإنتاجي لهذه الحلقة: <strong>{activeProduction.name}</strong> ({activeProduction.edition})</span>
        <button type="button" className="btn ghost small" disabled={saving} onClick={restoreChannelDefault}>العودة لقارئ القناة الافتراضي</button>
      </div>}
      {!enabled ? <button className="btn small" type="button" onClick={open}>استعراض القرّاء لهذه الحلقة</button> : <>
        <button className="btn ghost small ew-reciter-close" type="button" onClick={() => {
          setEnabled(false); setPreview(null); setEditions([]); setError("");
        }}>إغلاق مكتبة القرّاء</button>
        {loading && <p role="status">جارٍ الاتصال بمكتبة القرآن…</p>}
        {error && <p role="alert">{error}</p>}
        {!!editions.length && <div className="ew-reciter-controls">
          <label htmlFor="alquran-rights">تصنيف حقوق الاستخدام التجاري</label>
          <select id="alquran-rights" value={rightsFilter} onChange={(e) => setRightsFilter(e.target.value as ReciterRightsFilter)}>
            <option value="all">جميع القرّاء</option>
            <option value="verified">استخدام تجاري موثّق</option>
            <option value="review">يحتاج مراجعة</option>
          </select>
          <span className="help">الظهور في AlQuran Cloud ليس دليلًا على تصريح تجاري. حالة «موثّق» تتطلب دليلًا تمت مراجعته لتسجيل محدد.</span>
          <label htmlFor="alquran-search">البحث عن قارئ</label>
          <input id="alquran-search" type="search" value={search} placeholder="اسم القارئ أو معرّفه" onChange={(e) => setSearch(e.target.value)} />
          <span className="ew-reciter-count" role="status">{visibleEditions.length} نتيجة من أصل {editions.length} تسجيلًا{rightsFilter === "verified" && !visibleEditions.length ? " — لا يوجد دليل ترخيص تجاري متحقق منه في السجل الحالي" : ""}</span>
          <label htmlFor="alquran-edition">اختر القارئ</label>
          <select id="alquran-edition" value={edition} onChange={(e) => selectEdition(e.target.value)}>
            {!visibleEditions.some((e) => e.identifier === edition) && editions.some((e) => e.identifier === edition) &&
              <option value={edition}>{editions.find((e) => e.identifier === edition)?.name} (المختار خارج نتائج الفلتر)</option>}
            {visibleEditions.map((e) => <option key={e.identifier} value={e.identifier}>{e.name} — {e.identifier}</option>)}
          </select>
          {!visibleEditions.length && <p>{rightsFilter === "verified" ? "لا توجد تسجيلات موثقة تجاريًا في سجل المراجعة حاليًا. يمكنك اختيار «جميع القرّاء» للاستماع." : "لا توجد نتائج مطابقة. غيّر التصنيف أو امسح البحث."}</p>}
          <p className="help">القارئ المحدد: {commercialEvidenceFor(edition) ? "استخدام تجاري موثّق" : "حقوق الاستخدام التجاري تحتاج مراجعة"}</p>
          <div className="ew-reciter-verse-row"><label htmlFor="alquran-surah">رقم السورة (1–114)</label>
          <input id="alquran-surah" type="number" min={1} max={114} value={surah} onChange={(e) => {
            setSurah(Number(e.target.value)); setAyah(1); setPreview(null);
          }} />
          <label htmlFor="alquran-ayah">رقم الآية</label>
          <input id="alquran-ayah" type="number" min={1} max={286} value={ayah} onChange={(e) => {
            setAyah(Number(e.target.value)); setPreview(null);
          }} />
          <button className="btn small ew-listen-action" type="button" disabled={loading || !edition ||
            !Number.isSafeInteger(surah) || surah < 1 || surah > 114 ||
            !Number.isSafeInteger(ayah) || ayah < 1 || ayah > 286} onClick={listen}>
            عرض الآية والاستماع
          </button></div>
        </div>}
        {preview && <div className="ew-ayah-preview">
          <p dir="rtl" lang="ar">{preview.text}</p>
          <audio key={preview.audio} controls preload="none" src={preview.audio} />
          <p className="note">سورة {preview.surah}، الآية {preview.ayah} · القارئ: {editions.find((e) => e.identifier === preview.reciter)?.name ?? preview.reciter}</p>
        </div>}
        <p className="ew-reciter-rights-note">الاستماع لا يغيّر صوت الفيديو ولا يمنح إذن إعادة نشر التسجيل. يمكنك مقارنة القرّاء بحرية؛ تفعيل الإنتاج خطوة منفصلة.</p>
        <details className="ew-production-licence">
          <summary><strong>ربط صوت القارئ بفيديو هذه الحلقة</strong><span>إعداد متقدم · يتطلب توثيق حقوق التسجيل</span></summary>
          <div className="ew-licence-fields">
            <p>بعد اعتماد هذا القارئ، سيجلب المحرك تلاوة كل آية للحلقة ويضعها في بطاقة الآية أثناء الرندر. <strong>لا تتأثر الحلقات الأخرى.</strong></p>
            <p className="ew-licence-help">هذا المسار مخصص للتسجيلات التي لديك إذن فعلي بإعادة نشرها على يوتيوب، بما يشمل الاستخدام التجاري. رابط مكتبة التلاوة ليس وثيقة إذن، ولا يتحقق النظام تلقائيًا من صحة الترخيص.</p>
            <label htmlFor="alquran-holder">اسم صاحب حقوق التسجيل أو الجهة المخوِّلة</label>
            <input id="alquran-holder" value={licenceHolder} onChange={(e) => setLicenceHolder(e.target.value)} placeholder="الجهة التي منحت الإذن" />
            <label htmlFor="alquran-evidence">رابط HTTPS إلى وثيقة الإذن الخاصة بهذا التسجيل</label>
            <input id="alquran-evidence" type="url" value={licenceEvidence} onChange={(e) => setLicenceEvidence(e.target.value)} placeholder="https://..." dir="ltr" />
            <label className="ew-licence-confirm">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              لديّ إذن صريح من صاحب الحقوق لنشر تسجيل هذا القارئ على يوتيوب، بما يشمل الاستخدام التجاري.
            </label>
            <button type="button" className="btn small" onClick={activateProduction} disabled={saving || loading || !edition || !confirmed || !licenceHolder.trim() || !licenceEvidence.trim()}>
              {saving ? "جارٍ اعتماد المصدر وجلب الآيات…" : "اعتماد القارئ للإنتاج وجلب آيات الحلقة"}
            </button>
            {productionStatus && <p role="status" className="ew-production-ok">{productionStatus}</p>}
          </div>
        </details>
      </>}
    </section>
  );
};
