import React, { useEffect, useMemo, useState } from "react";
import { api, type AlQuranAudioEdition, type AlQuranAyahPreview } from "../api";
import type { EpisodeMedia } from "../../../src/plan/media";
import type { CloudRecitation } from "../../../src/quran/provider";

/** A local preview preference only: NEVER an approved production recitation choice. */
export const previewReciterKey = (channelId: string, episodeId: string) =>
  `balislam:alquran-preview:${encodeURIComponent(channelId)}:${encodeURIComponent(episodeId)}`;

export const filterAudioEditions = (editions: AlQuranAudioEdition[], term: string) => {
  const query = term.trim().toLocaleLowerCase();
  return query ? editions.filter((e) =>
    e.name.toLocaleLowerCase().includes(query) || e.identifier.toLowerCase().includes(query)) : editions;
};

/** Read-only per-episode preview; never writes video plans, sound assets or rights approvals. */
export const AlQuranCloudBrowser: React.FC<{ channelId: string; episodeId: string; onMedia?: (media: EpisodeMedia) => void }> = ({ channelId, episodeId, onMedia }) => {
  const [enabled, setEnabled] = useState(false);
  const [editions, setEditions] = useState<AlQuranAudioEdition[]>([]);
  const [edition, setEdition] = useState("ar.alafasy");
  const [search, setSearch] = useState("");
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
  const visibleEditions = useMemo(() => filterAudioEditions(editions, search), [editions, search]);

  useEffect(() => {
    setEnabled(false); setEditions([]); setPreview(null); setError(""); setSearch(""); setSurah(1); setAyah(1);
    setLicenceHolder(""); setLicenceEvidence(""); setConfirmed(false); setProductionStatus(""); setActiveProduction(null);
    let alive = true;
    api.recitationChoice(episodeId, channelId).then(({ recitation }) => {
      if (!alive) return;
      setActiveProduction(recitation);
    }).catch(() => { /* the production form handles API failures when used */ });
    try {
      const stored = localStorage.getItem(previewReciterKey(channelId, episodeId));
      setEdition(stored && /^ar\.[a-z0-9._-]{1,75}$/i.test(stored) ? stored : "ar.alafasy");
    } catch { setEdition("ar.alafasy"); }
    return () => { alive = false; };
  }, [channelId, episodeId]);

  const selectEdition = (id: string) => {
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
          onMedia(episode.media);
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

  return (
    <section className="group" aria-label="مكتبة AlQuran Cloud للقرآن">
      <h3>AlQuran Cloud <small>معاينة القرّاء وربط التلاوة بالإنتاج</small></h3>
      <p>ابحث عن قارئ واستمع إلى الآية. يمكن ربط القارئ تلقائيًا بفيديو <strong>هذه الحلقة فقط</strong> بعد توثيق إذن تسجيله؛ الاختيار التجريبي لا يغير الرندر.</p>
      {activeProduction && <p role="status" className="ew-production-ok">القارئ الإنتاجي للحلقة: {activeProduction.name} ({activeProduction.edition})</p>}
      {!enabled ? <button className="btn small" type="button" onClick={open}>استعراض القرّاء لهذه الحلقة</button> : <>
        <button className="btn ghost small" type="button" onClick={() => {
          setEnabled(false); setPreview(null); setEditions([]); setError("");
        }}>إغلاق المكتبة وإيقاف الاستماع</button>
        {loading && <p role="status">جارٍ الاتصال بمكتبة القرآن…</p>}
        {error && <p role="alert">{error}</p>}
        {!!editions.length && <div className="key-row">
          <label htmlFor="alquran-search">البحث عن قارئ</label>
          <input id="alquran-search" type="search" value={search} placeholder="اسم القارئ أو معرّفه" onChange={(e) => setSearch(e.target.value)} />
          <span role="status">{visibleEditions.length} من {editions.length} تسجيلًا صوتيًا</span>
          <label htmlFor="alquran-edition">القارئ للمعاينة</label>
          <select id="alquran-edition" value={edition} onChange={(e) => selectEdition(e.target.value)}>
            {!visibleEditions.some((e) => e.identifier === edition) && editions.some((e) => e.identifier === edition) &&
              <option value={edition}>{editions.find((e) => e.identifier === edition)?.name} (المختار)</option>}
            {visibleEditions.map((e) => <option key={e.identifier} value={e.identifier}>{e.name} — {e.identifier}</option>)}
          </select>
          {!visibleEditions.length && <p>لا توجد نتائج مطابقة. امسح البحث لعرض القائمة كاملة.</p>}
          <label htmlFor="alquran-surah">رقم السورة (1–114)</label>
          <input id="alquran-surah" type="number" min={1} max={114} value={surah} onChange={(e) => {
            setSurah(Number(e.target.value)); setAyah(1); setPreview(null);
          }} />
          <label htmlFor="alquran-ayah">رقم الآية</label>
          <input id="alquran-ayah" type="number" min={1} max={286} value={ayah} onChange={(e) => {
            setAyah(Number(e.target.value)); setPreview(null);
          }} />
          <button className="btn small" type="button" disabled={loading || !edition ||
            !Number.isSafeInteger(surah) || surah < 1 || surah > 114 ||
            !Number.isSafeInteger(ayah) || ayah < 1 || ayah > 286} onClick={listen}>
            عرض الآية والاستماع
          </button>
        </div>}
        {preview && <div>
          <p dir="rtl" lang="ar">{preview.text}</p>
          <audio key={preview.audio} controls preload="none" src={preview.audio} />
          <p className="note">سورة {preview.surah}، الآية {preview.ayah} · القارئ: {editions.find((e) => e.identifier === preview.reciter)?.name ?? preview.reciter}</p>
        </div>}
        <p className="note">المعاينة ليست إذن نشر. حقوق التسجيلات لأصحابها؛ لا يتاح إدراج تلاوة AlQuran Cloud في الرندر أو التصدير قبل توثيق ترخيص التسجيل المحدد. يبقى مصدر التلاوة الإنتاجي الحالي دون تغيير.</p>
        <details className="ew-production-licence">
          <summary>إدراج القارئ المحدد تلقائيًا في فيديو هذه الحلقة — بعد توثيق الإذن</summary>
          <div className="ew-licence-fields">
            <p>بعد التفعيل، سيجلب محرك الآيات صوت القارئ المحدد لكل آية ويضعه في بطاقة الآية أثناء الرندر، بنفس مسار Quran Foundation. هذا الاختيار <strong>خاص بهذه الحلقة فقط</strong>، ولا يبدّل قرّاء الحلقات الأخرى أو خطة الحلقة.</p>
            <p>لا يُعتبر رابط AlQuran Cloud نفسه ترخيصًا. يلزم إذن فعلي صريح من صاحب حقوق التسجيل يسمح بالنشر على يوتيوب والاستخدام التجاري؛ إدخال الرابط هنا توثيق منك وليس تحققًا قانونيًا آليًا.</p>
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
