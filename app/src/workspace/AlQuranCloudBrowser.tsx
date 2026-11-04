import React, { useEffect, useState } from "react";
import { api, type AlQuranAudioEdition, type AlQuranAyahPreview } from "../api";

/** A read-only, per-channel ayah text/audio preview; never writes into video plans. */
export const AlQuranCloudBrowser: React.FC<{ channelId: string }> = ({ channelId }) => {
  const [enabled, setEnabled] = useState(false);
  const [editions, setEditions] = useState<AlQuranAudioEdition[]>([]);
  const [edition, setEdition] = useState("ar.alafasy");
  const [surah, setSurah] = useState(1);
  const [ayah, setAyah] = useState(1);
  const [preview, setPreview] = useState<AlQuranAyahPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // No state or playback inherited across channels.
  useEffect(() => {
    setEnabled(false); setEditions([]); setPreview(null); setError(""); setSurah(1); setAyah(1);
  }, [channelId]);
  const open = async () => {
    setEnabled(true); setLoading(true); setError(""); setPreview(null);
    try {
      const res = await api.alquranEditions();
      setEditions(res.editions);
      setEdition(res.editions.some((e) => e.identifier === "ar.alafasy") ? "ar.alafasy" : (res.editions[0]?.identifier ?? ""));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };
  const listen = async () => {
    setLoading(true); setPreview(null); setError("");
    try { setPreview(await api.alquranAyah(surah, ayah, edition)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };
  return (
    <section className="group" aria-label="مكتبة AlQuran Cloud للقرآن">
      <h3>AlQuran Cloud <small>نص الآية وصوتها — استماع فقط</small></h3>
      <p>استعراض نص المصحف العثماني ومعاينة صوت آية منفردة. لا يغيّر أي حلقة أو مصدر صوت في الرندر.</p>
      {!enabled ? <button className="btn small" type="button" onClick={open}>فتح مكتبة القرآن لهذه القناة</button> : <>
        <button className="btn ghost small" type="button" onClick={() => {
          setEnabled(false); setPreview(null); setEditions([]); setError("");
        }}>إغلاق المكتبة وإيقاف الاستماع</button>
        {loading && <p role="status">جارٍ الاتصال بمكتبة القرآن…</p>}
        {error && <p role="alert">{error}</p>}
        {!!editions.length && <div className="key-row">
          <label htmlFor="alquran-edition">القارئ</label>
          <select id="alquran-edition" value={edition} onChange={(e) => { setEdition(e.target.value); setPreview(null); }}>
            {editions.map((e) => <option key={e.identifier} value={e.identifier}>{e.name}</option>)}
          </select>
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
          <p className="note">سورة {preview.surah}، الآية {preview.ayah} · القارئ: {preview.reciter}</p>
        </div>}
        <p className="note">هذا استماع تجريبي؛ حقوق التسجيلات محفوظة لأصحابها. لا تُدمج التلاوة في فيديو للنشر دون التحقق من الإذن. المصدر: alquran.cloud.</p>
      </>}
    </section>
  );
};
