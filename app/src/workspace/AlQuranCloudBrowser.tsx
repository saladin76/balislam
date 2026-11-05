import React, { useEffect, useMemo, useState } from "react";
import { api, type AlQuranAudioEdition, type AlQuranAyahPreview } from "../api";

/** A local preview preference only: NEVER an approved production recitation choice. */
export const previewReciterKey = (channelId: string, episodeId: string) =>
  `balislam:alquran-preview:${encodeURIComponent(channelId)}:${encodeURIComponent(episodeId)}`;

export const filterAudioEditions = (editions: AlQuranAudioEdition[], term: string) => {
  const query = term.trim().toLocaleLowerCase();
  return query ? editions.filter((e) =>
    e.name.toLocaleLowerCase().includes(query) || e.identifier.toLowerCase().includes(query)) : editions;
};

/** Read-only per-episode preview; never writes video plans, sound assets or rights approvals. */
export const AlQuranCloudBrowser: React.FC<{ channelId: string; episodeId: string }> = ({ channelId, episodeId }) => {
  const [enabled, setEnabled] = useState(false);
  const [editions, setEditions] = useState<AlQuranAudioEdition[]>([]);
  const [edition, setEdition] = useState("ar.alafasy");
  const [search, setSearch] = useState("");
  const [surah, setSurah] = useState(1);
  const [ayah, setAyah] = useState(1);
  const [preview, setPreview] = useState<AlQuranAyahPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const visibleEditions = useMemo(() => filterAudioEditions(editions, search), [editions, search]);

  useEffect(() => {
    setEnabled(false); setEditions([]); setPreview(null); setError(""); setSearch(""); setSurah(1); setAyah(1);
    try {
      const stored = localStorage.getItem(previewReciterKey(channelId, episodeId));
      setEdition(stored && /^ar\.[a-z0-9._-]{1,75}$/i.test(stored) ? stored : "ar.alafasy");
    } catch { setEdition("ar.alafasy"); }
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

  return (
    <section className="group" aria-label="مكتبة AlQuran Cloud للقرآن">
      <h3>AlQuran Cloud <small>مكتبة قرّاء متعددة — معاينة فقط</small></h3>
      <p>ابحث عن قارئ، استمع إلى آية، وقارن الأصوات. يُحفظ آخر قارئ للمعاينة لهذه الحلقة في هذا المتصفح فقط؛ لا يتغير صوت الرندر أو خطة الحلقة.</p>
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
      </>}
    </section>
  );
};
