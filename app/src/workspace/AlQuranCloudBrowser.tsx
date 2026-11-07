import React, { useEffect, useMemo, useState } from "react";
import { api, type AlQuranAudioEdition, type AlQuranAyahPreview } from "../api";

/** Preview preference only. Never an authorization, publication or download choice. */
export const previewReciterKey = (channelId:string,episodeId:string) =>
  `balislam:alquran-preview:${encodeURIComponent(channelId)}:${encodeURIComponent(episodeId)}`;
export const previewEditionFor = (episodeChoice:string|null,channelChoice?:string):string => {
  const valid = (s?:string|null) => !!s && /^ar\.[a-z0-9._-]{1,75}$/i.test(s);
  return valid(episodeChoice) ? episodeChoice! : valid(channelChoice) ? channelChoice! : "ar.alafasy";
};
export const filterAudioEditions = (editions:AlQuranAudioEdition[],term:string) => {
  const needle=term.trim().toLocaleLowerCase();
  return needle?editions.filter(e=>e.name.toLocaleLowerCase().includes(needle)||e.identifier.toLowerCase().includes(needle)):editions;
};
/** The single permitted external Quran service; listening does not change episode media. */
export const AlQuranCloudBrowser: React.FC<{channelId:string;episodeId:string}> = ({channelId,episodeId}) => {
  const [opened,setOpened] = useState(false);
  const [editions,setEditions] = useState<AlQuranAudioEdition[]>([]);
  const [edition,setEdition] = useState("ar.alafasy");
  const [term,setTerm] = useState("");
  const [surah,setSurah] = useState(1);
  const [ayah,setAyah] = useState(1);
  const [preview,setPreview] = useState<AlQuranAyahPreview|null>(null);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const matches = useMemo(()=>filterAudioEditions(editions,term),[editions,term]);
  useEffect(()=>{
    setOpened(false);setEditions([]);setPreview(null);setError("");setTerm("");
    const key=previewReciterKey(channelId,episodeId);
    let stored:null|string=null;
    try{stored=localStorage.getItem(key);}catch{/* private mode */}
    setEdition(previewEditionFor(stored));
  },[channelId,episodeId]);
  const open = async()=>{
    setOpened(true);setBusy(true);setError("");
    try{
      const data=await api.alquranEditions();
      setEditions(data.editions);
      if(!data.editions.some(e=>e.identifier===edition))setEdition(previewEditionFor(null));
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  };
  const request = async()=>{
    setBusy(true);setError("");setPreview(null);
    try{setPreview(await api.alquranAyah(surah,ayah,edition));}
    catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  };
  return <section className="group ew-reciter-panel" aria-label="معاينة AlQuran Cloud">
    <h4 className="ew-reciter-title">AlQuran Cloud <span>استماع اختياري فقط</span></h4>
    <p className="ew-reciter-subtitle">للاستماع والمقارنة فقط؛ لن يُنزَّل تسجيل خارجي أو يُستخدم في الفيديو. التلاوة الإنتاجية هي التسجيل الذي اعتُمد أعلاه باسم قارئه.</p>
    {!opened ? <button className="btn small" type="button" onClick={open}>استعراض التلاوات</button> : <>
      <button className="btn ghost small" type="button" onClick={()=>{setOpened(false);setPreview(null);}}>إغلاق المعاينة</button>
      {busy && <p role="status">جارٍ تحميل المعاينة…</p>}
      {error && <p role="alert">{error}</p>}
      <label htmlFor="cloud-search">ابحث عن قارئ</label>
      <input id="cloud-search" value={term} onChange={e=>setTerm(e.target.value)} placeholder="اسم القارئ"/>
      <label htmlFor="cloud-edition">القارئ</label>
      <select id="cloud-edition" value={edition} onChange={e=>{
        setEdition(e.target.value);setPreview(null);
        try{localStorage.setItem(previewReciterKey(channelId,episodeId),e.target.value);}catch{/* optional */}
      }}>
        {!matches.some(e=>e.identifier===edition) && <option value={edition}>{edition}</option>}
        {matches.map(e=><option key={e.identifier} value={e.identifier}>{e.name}</option>)}
      </select>
      <label htmlFor="cloud-surah">رقم السورة (1–114)</label>
      <input type="number" id="cloud-surah" min={1} max={114} value={surah} onChange={e=>{setSurah(Number(e.target.value));setPreview(null);}}/>
      <label htmlFor="cloud-ayah">رقم الآية</label>
      <input type="number" id="cloud-ayah" min={1} max={286} value={ayah} onChange={e=>{setAyah(Number(e.target.value));setPreview(null);}}/>
      <button className="btn small" type="button" disabled={busy||!Number.isSafeInteger(surah)||surah<1||surah>114||!Number.isSafeInteger(ayah)||ayah<1||ayah>286} onClick={request}>استمع فقط</button>
      {preview && <div className="ew-ayah-preview">
        <p lang="ar" dir="rtl">{preview.text}</p>
        <audio key={preview.audio} controls preload="none" src={preview.audio}/>
        <p className="note">سورة {preview.surah}، الآية {preview.ayah} — غير مصرح تلقائيًا بإعادة نشر التسجيل.</p>
      </div>}
    </>}
  </section>;
};
