import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { EpisodeMedia } from "../../../src/plan/media";

type Requested = { key: string; label: string; status: "missing" | "existing" };
type TextStatus = { required: Requested[]; missing: string[]; invalid: {ref:string;reason:string}[] };
type AudioStatus = {
  pending: Record<string,{ file:string; duration:number; sha256:string }>;
  approved: Record<string,{ reciter:string; approvedAt?:string }>;
};
const fileAsDataUrl = (file: File) => new Promise<string>((resolve,reject)=>{
  const reader = new FileReader();
  reader.onerror = () => reject(Error("تعذّر قراءة الملف الصوتي."));
  reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(Error("صيغة الملف غير صالحة."));
  reader.readAsDataURL(file);
});
/** Shared by all channels: no Quran API keys and no automatic verse/audio generation. */
export const ManualQuranPanel: React.FC<{
  episodeId:string; channelId:string; onMedia?:(media:EpisodeMedia)=>void;
}> = ({episodeId,channelId,onMedia}) => {
  const [status,setStatus] = useState<TextStatus|null>(null);
  const [audio,setAudio] = useState<AudioStatus>({pending:{},approved:{}});
  const [selected,setSelected] = useState("");
  const [text,setText] = useState("");
  const [file,setFile] = useState<File|null>(null);
  const [reviewer,setReviewer] = useState("");
  const [note,setNote] = useState("");
  const [listened,setListened] = useState(false);
  const [busy,setBusy] = useState(false);
  const [feedback,setFeedback] = useState("");
  const [error,setError] = useState("");
  const required = status?.required ?? [];
  const chosen = useMemo(()=> required.find(r=>r.key===selected),[required,selected]);
  const pending = audio.pending[selected];
  const refresh = async () => {
    const [t,a] = await Promise.all([api.missingQuranTexts(episodeId,channelId),api.ownQuranAudioStatus(episodeId,channelId)]);
    setStatus(t.status);
    setAudio(a);
    setSelected(old => t.status.required.some(r=>r.key===old) ? old : (t.status.required[0]?.key ?? ""));
  };
  useEffect(()=>{
    let alive=true;
    setStatus(null);setAudio({pending:{},approved:{}});setFeedback("");setError("");setText("");setFile(null);setListened(false);
    void Promise.all([api.missingQuranTexts(episodeId,channelId),api.ownQuranAudioStatus(episodeId,channelId)])
      .then(([t,a])=>{if(alive){setStatus(t.status);setAudio(a);setSelected(t.status.required[0]?.key ?? "");}})
      .catch(e=>{if(alive)setError((e as Error).message);});
    return ()=>{alive=false;};
  },[episodeId,channelId]);
  const operation = async (fn:()=>Promise<void>) => {
    setBusy(true);setError("");setFeedback("");
    try { await fn();await refresh(); }
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally {setBusy(false); }
  };
  const copyList = () => operation(async()=>{
    if(!required.length) throw Error("لا توجد آيات مطلوبة.");
    const lines = required.map(r=>`- ${r.label} [${r.key}] — ${r.status === "missing"?"النص مطلوب":"النص موجود"} — ${audio.approved[r.key]?"التلاوة معتمدة":"التلاوة مطلوبة"}`);
    await navigator.clipboard.writeText("الآيات المطلوبة للحلقة "+episodeId+" ("+channelId+"):\n"+lines.join("\n")+"\nأرسل النصوص العربية المضبوطة لكل مرجع والتسجيلات بصوتي للمراجعة.");
    setFeedback("نُسخت قائمة الآيات إلى الحافظة لإرسالها للمحادثة.");
  });
  const saveText = () => operation(async()=>{
    if(!selected||!text.trim())throw Error("اختر مرجع الآية والصق نصها أولًا.");
    const result=await api.saveManualQuranText(episodeId,channelId,selected,text);
    if(result.result.saved){setText("");setFeedback("حُفظ النص كما أرسلته؛ راجعه قبل الإنتاج.");}
    else setFeedback("النص موجود ومطابق؛ لم يُستبدل.");
  });
  const upload = () => operation(async()=>{
    if(!selected||!file)throw Error("اختر مرجع الآية والتسجيل الأصلي.");
    if(file.size>25*1024*1024)throw Error("حد الملف الصوتي 25 ميجابايت.");
    const data=await fileAsDataUrl(file);
    const result=await api.uploadOwnQuranAudio(episodeId,channelId,{key:selected,name:file.name,data});
    setFile(null);setListened(false);setFeedback("حُسِّن التسجيل دون تغيير طبقته أو سرعته؛ استمع إليه واعتمده بعد المراجعة. مدة النسخة: "+result.recording.duration.toFixed(1)+" ثانية.");
  });
  const approve = () => operation(async()=>{
    const result=await api.approveOwnQuranAudio(episodeId,channelId,{key:selected,reviewer,note,listened});
    onMedia?.(result.media);
    setNote("");setListened(false);setFeedback("اعتمدت التلاوة بعد الاستماع. لم يتغير السكريبت أو المشاهد.");
  });
  return <section className="group" aria-label="تجهيز الآيات والتلاوة يدويًا">
    <h4>الآيات المطلوبة وتلاوتك بصوتك</h4>
    <p className="help">مسار واحد للقنوات الثلاث: ننقل مراجع الآيات إلى المحادثة، ثم نُدخل النص والتسجيل محليًا. لا يُطلب أي مفتاح لخدمة قرآن خارجية.</p>
    {error && <p className="note err" role="alert">{error}</p>}
    {feedback && <p className="note" role="status">{feedback}</p>}
    {!status ? <p>جارٍ قراءة مراجع الآيات…</p> : <>
      <div className="toolbar">
        <strong>مراجع مطلوبة: {required.length}</strong>
        <span className="spacer"/>
        <button className="btn small" type="button" disabled={busy||!required.length} onClick={copyList}>انسخ قائمة الآيات للمحادثة</button>
      </div>
      {status.invalid.map(r=><p key={r.ref} role="alert">مرجع غير صالح: {r.ref} — {r.reason}</p>)}
      {!required.length ? <p>لا توجد آيات مطلوبة في سكريبت الحلقة الحالية.</p> : <>
        <label htmlFor="manual-quran-ref">الآية</label>
        <select id="manual-quran-ref" value={selected} onChange={e=>{setSelected(e.target.value);setText("");setFile(null);setListened(false);setNote("");}}>
          {required.map(r=><option value={r.key} key={r.key}>{r.label} — {r.key}</option>)}
        </select>
        <p className="help">النص: {chosen?.status==="existing"?"محفوظ":"لم يُدخل بعد"} · التلاوة: {audio.approved[selected]?"معتمدة":pending?"بانتظار المراجعة":"غير مرفوعة"}</p>
        {chosen?.status==="missing" && <div className="field">
          <label htmlFor="manual-quran-text">الصق النص العربي كما أرسلته في المحادثة، بالتشكيل</label>
          <textarea id="manual-quran-text" dir="rtl" lang="ar" rows={4} value={text} onChange={e=>setText(e.target.value)} placeholder="الصق نص الآية هنا دون إعادة صياغة" />
          <button className="btn small" type="button" disabled={busy||!text.trim()} onClick={saveText}>حفظ النص المحلي دون استبدال أي نص سابق</button>
        </div>}
        <div className="field">
          <label htmlFor="manual-quran-file">التسجيل الأصلي بصوتك (WAV/MP3/M4A؛ حتى 25MB)</label>
          <input id="manual-quran-file" type="file" accept=".wav,.mp3,.m4a,.aac,.ogg,.flac,audio/*" onChange={e=>setFile(e.target.files?.[0]??null)} />
          <p className="help">تحسين خفيف للمستوى والضوضاء المنخفضة فقط؛ لا نغيّر النغمة أو السرعة أو نضيف موسيقى، ولا نُنشئ صوتًا اصطناعيًا.</p>
          <button className="btn small" type="button" disabled={busy||!file||Boolean(pending)} onClick={upload}>تجهيز نسخة صوتية للمراجعة</button>
        </div>
        {pending && <div className="field">
          <strong>نسخة مراجعة — {pending.duration.toFixed(1)} ثانية</strong>
          <audio key={pending.file} controls preload="none" src={api.ownQuranPreviewUrl(episodeId,channelId,pending.file)} />
          <label><input type="checkbox" checked={listened} onChange={e=>setListened(e.target.checked)} /> استمعت إلى التلاوة كاملة وتحققت من سلامتها</label>
          <label htmlFor="manual-quran-reviewer">المراجع</label>
          <input id="manual-quran-reviewer" value={reviewer} maxLength={120} onChange={e=>setReviewer(e.target.value)}/>
          <label htmlFor="manual-quran-note">ملاحظة الاستماع</label>
          <textarea id="manual-quran-note" rows={2} value={note} onChange={e=>setNote(e.target.value)}/>
          <button className="btn small" type="button" disabled={busy||!listened||!reviewer.trim()||note.trim().length<12||chosen?.status!=="existing"} onClick={approve}>اعتماد التلاوة للمشاهد التي تحتاجها</button>
        </div>}
      </>}
    </>}
  </section>;
};
