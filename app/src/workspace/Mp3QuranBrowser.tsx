import React, { useEffect, useState } from "react";
import { api, type Mp3QuranReciter, type Mp3QuranSurah } from "../api";

/**
 * Explicit opt-in per displayed channel. Browse and listen only;
 * do not download, attach to episode plans or change Quran Foundation.
 */
export const Mp3QuranBrowser: React.FC<{ channelId: string }> = ({ channelId }) => {
  const [enabled, setEnabled] = useState(false);
  const [reciters, setReciters] = useState<Mp3QuranReciter[]>([]);
  const [suwar, setSuwar] = useState<Mp3QuranSurah[]>([]);
  const [reciterId, setReciterId] = useState(0);
  const [moshafId, setMoshafId] = useState(0);
  const [surahId, setSurahId] = useState(1);
  const [audio, setAudio] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reciter = reciters.find((r) => r.id === reciterId);
  const moshaf = reciter?.moshaf.find((m) => m.id === moshafId);
  const availableSurahs = moshaf?.surah_list.split(",").map((x) => Number(x.trim())) ?? [];

  // A channel change must never inherit a browsing opt-in or audio URL.
  useEffect(() => {
    setEnabled(false); setAudio(""); setReciterId(0); setMoshafId(0); setError("");
  }, [channelId]);

  const loadCatalogue = async () => {
    setEnabled(true);
    setLoading(true);
    setError("");
    try {
      const [r, s] = await Promise.all([api.mp3quranReciters(), api.mp3quranSuwar()]);
      setReciters(r.reciters.filter((x) => x.moshaf.length));
      setSuwar(s.suwar);
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  };

  const preview = async () => {
    if (!reciter || !moshaf || !availableSurahs.includes(surahId)) return;
    setAudio(""); setLoading(true); setError("");
    try {
      const result = await api.mp3quranPreview(reciter.id, moshaf.id, surahId);
      setAudio(result.url);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <section className="group" aria-label="مكتبة MP3Quran للتصفح">
      <h3>مكتبة MP3Quran <small>مصدر خارجي اختياري — معاينة فقط</small></h3>
      <p>استعراض القراء والروايات والسور دون تغيير مصدر التلاوة المعتمد، ودون إدخال ملفات في الحلقة.</p>
      {!enabled ? (
        <button className="btn small" type="button" onClick={loadCatalogue}>فتح المكتبة لهذه القناة مؤقتًا</button>
      ) : (
        <>
          <button className="btn ghost small" type="button" onClick={() => {
            setEnabled(false); setAudio(""); setError(""); setReciters([]); setSuwar([]);
          }}>إغلاق المكتبة وإيقاف الصوت</button>
          {loading && <p role="status">جارٍ تحميل بيانات المكتبة…</p>}
          {error && <p role="alert">{error}</p>}
          {!!reciters.length && (
            <div className="key-row">
              <label htmlFor="mp3quran-reciter">القارئ</label>
              <select id="mp3quran-reciter" value={reciterId} onChange={(e) => {
                setReciterId(Number(e.target.value)); setMoshafId(0); setSurahId(1); setAudio("");
              }}>
                <option value={0}>اختر القارئ</option>
                {reciters.map((r) => <option value={r.id} key={r.id}>{r.name}</option>)}
              </select>
              <label htmlFor="mp3quran-moshaf">الرواية / المصحف</label>
              <select id="mp3quran-moshaf" value={moshafId} onChange={(e) => {
                const nextId = Number(e.target.value);
                const next = reciter?.moshaf.find((m) => m.id === nextId);
                const first = Number(next?.surah_list.split(",")[0]?.trim());
                setMoshafId(nextId); setSurahId(Number.isInteger(first) && first >= 1 && first <= 114 ? first : 1); setAudio("");
              }}>
                <option value={0}>اختر الرواية</option>
                {reciter?.moshaf.map((m) => <option value={m.id} key={m.id}>{m.name}</option>)}
              </select>
              <label htmlFor="mp3quran-surah">السورة</label>
              <select id="mp3quran-surah" value={surahId} onChange={(e) => {
                setSurahId(Number(e.target.value)); setAudio("");
              }}>
                {suwar.filter((s) => availableSurahs.includes(s.id)).map((s) =>
                  <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button type="button" className="btn small" disabled={!moshaf || !availableSurahs.includes(surahId) || loading} onClick={preview}>
                معاينة التلاوة
              </button>
            </div>
          )}
          {audio && <audio key={audio} controls preload="none" src={audio} />}
          <p className="note">الاستماع لا يعني ترخيص إعادة الاستخدام أو النشر. لا تُحمّل التلاوة أو تُدمج في الفيديو دون مراجعة حقوقها والحصول على الإذن اللازم. المصدر: MP3Quran.net.</p>
        </>
      )}
    </section>
  );
};
