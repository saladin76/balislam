import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { channelLibraries, type LibrarySlot } from "../../../src/visual/library";
import { chatgptProjectInstructions, fireflyPrompt } from "../../../src/visual/prompts";

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const isVideo = (f: string) => /\.(mp4|webm|mov)$/i.test(f);

/** مكتبة صور القناة: خانات جاهزة، لكل خانة وصف Firefly للنسخ، ورفع الصورة أو المقطع، وتقدّم الإنجاز. */
export const ChannelImages: React.FC<{ channel: string }> = ({ channel }) => {
  const slots = channelLibraries[channel] ?? [];
  const [files, setFiles] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [ver, setVer] = useState(0);
  useEffect(() => {
    api.libraryImages().then((r) => setFiles(r.files)).catch(() => {});
  }, [channel]);
  const fileFor = (id: string) => files.find((f) => f.replace(/\.[^.]+$/, "") === id);
  const done = slots.filter((s) => fileFor(s.id)).length;
  const groups = useMemo(() => [...new Set(slots.map((s) => s.group))], [slots]);
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 1800);
  };

  if (!slots.length) return <div className="empty-state"><h2>لا توجد مكتبة صور لهذه القناة بعد.</h2></div>;
  return (
    <div className="channel-images">
      <div className="note">
        <b>طريقة العمل في Firefly (مرة واحدة لكل الحلقات):</b> افتح Firefly ← Text to Image. اختر <b>Aspect ratio: Widescreen (16:9)</b> و<b>Content type: Photo</b>.
        لكل خانة: «انسخ الوصف» والصقه في خانة الوصف، و«انسخ الممنوعات» والصقها في <b>Exclude from image</b> (من الإعدادات المتقدمة).
        اختر أفضل صورة من الأربع، ونزّلها بأعلى دقة، ثم ارفعها في خانتها هنا.
        نصيحة للتناسق: بعد أول صورة تعجبك، استعملها <b>Style reference</b> في باقي الصور.
        خانات الفيديو: من Firefly ← Text to Video (16:9، 5 ثوانٍ). خانات «الأرشيف» لا تُولَّد: الوثائق المولّدة تخرج بكتابة عربية مشوّهة، فننزّل الأصل الحقيقي من Wikimedia Commons مجانًا.
      </div>
      <div className="note">
        <b>الأسهل: ChatGPT (بلا حد).</b> أنشئ Project في ChatGPT باسم «صور {channel}»، والصق في Instructions التعليمات من الزر،
        ثم أرسل لكل خانة «انسخ لـ ChatGPT» فقط (وصف المشهد) فتخرج الصورة بأسلوب القناة. ووفّر كريدت Firefly للفيديو:
        Firefly ← Image to Video من أفضل الصور.
        <div style={{ marginTop: 8 }}>
          <button className="btn small primary" onClick={() => navigator.clipboard.writeText(chatgptProjectInstructions(channel)).then(() => flash("نُسخت التعليمات ✓")).catch(() => flash("تعذّر النسخ"))}>انسخ تعليمات مشروع ChatGPT</button>
        </div>
      </div>
      <div className="toolbar">
        <b>
          الإنجاز: {done} من {slots.length}
        </b>
        <div style={{ flex: "0 0 220px", height: 8, background: "var(--panel-2, #eee)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${(done / slots.length) * 100}%`, height: "100%", background: "var(--accent, #B4532F)" }} />
        </div>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> الناقصة فقط
        </label>
        <span className="spacer" />
        {msg ? <span className="help">{msg}</span> : null}
      </div>
      {groups.map((g) => {
        const list = slots.filter((s) => s.group === g && (!onlyMissing || !fileFor(s.id)));
        if (!list.length) return null;
        return (
          <section key={g} style={{ marginBottom: 22 }}>
            <h3 style={{ margin: "14px 0 10px" }}>{g}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {list.map((s) => (
                <SlotCard key={s.id} slot={s} channel={channel} file={fileFor(s.id)} ver={ver} flash={flash} onUploaded={(f) => { setFiles((x) => [...x.filter((y) => y.replace(/\.[^.]+$/, "") !== s.id), f]); setVer((v) => v + 1); }} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

const SlotCard: React.FC<{ slot: LibrarySlot; channel: string; file?: string; ver: number; flash: (m: string) => void; onUploaded: (f: string) => void }> = ({ slot, channel, file, ver, flash, onUploaded }) => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const ff = fireflyPrompt({ channel, prompt: slot.prompt, look: slot.look, video: slot.video });
  const copy = (t: string, what: string) => navigator.clipboard.writeText(t).then(() => flash(`نُسخ ${what} ✓`)).catch(() => flash("تعذّر النسخ"));
  const upload = async (f: File) => {
    setBusy(true);
    try {
      const r = await api.uploadLibraryImage({ slot: slot.id, name: f.name, data: await readAsDataUrl(f) });
      onUploaded(r.file);
      flash(`رُفعت «${slot.titleAr}» ✓`);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const url = file ? `${api.libraryImageUrl(file)}&v=${ver}` : "";
  return (
    <div
      style={{ border: "1px solid var(--line, #ddd)", borderRadius: 12, overflow: "hidden", background: "var(--panel, #fff)" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) void upload(f);
      }}
    >
      <div style={{ aspectRatio: "16 / 9", background: "#0b0806", display: "grid", placeItems: "center", color: "#E9D9B8", cursor: "pointer", position: "relative" }} onClick={() => input.current?.click()} title="اضغط أو اسحب الملف هنا">
        {url ? isVideo(file!) ? <video src={url} muted loop autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 13 }}>{busy ? "جارٍ الرفع…" : slot.video ? "🎬 مقطع مطلوب" : "صورة مطلوبة"}</span>}
        {file ? <span style={{ position: "absolute", top: 8, insetInlineStart: 8, background: "#1E6B3A", color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: 12 }}>✓ جاهزة</span> : null}
        {slot.look === "archive" ? <span style={{ position: "absolute", top: 8, insetInlineEnd: 8, background: "#0008", color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: 12 }}>وثيقة</span> : null}
      </div>
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        <b>{slot.titleAr}</b>
        <code className="help" style={{ direction: "ltr", fontSize: 12 }}>{slot.id}</code>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {slot.museum ? (
            <a className="btn small primary" href={`https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(slot.museum)}&title=Special:MediaSearch&type=image`} target="_blank" rel="noreferrer" title="صورة حقيقية بترخيص مفتوح: نزّلها بأعلى دقة واكتب اسم مصدرها في «مصدر الصورة» بالمشهد">ابحث في المتاحف</a>
          ) : (
            <>
              <button className="btn small primary" onClick={() => copy(slot.prompt, "وصف ChatGPT")} title={slot.prompt}>انسخ لـ ChatGPT</button>
              <button className="btn small" onClick={() => copy(ff.prompt, "وصف Firefly")} title={ff.prompt}>انسخ لـ Firefly</button>
              <button className="btn small" onClick={() => copy(ff.exclude, "الممنوعات")} title={`ممنوعات Firefly: ${ff.exclude}`}>ممنوعات Firefly</button>
            </>
          )}
          <button className="btn small" disabled={busy} onClick={() => input.current?.click()}>{file ? "استبدل" : "ارفع"}</button>
        </div>
      </div>
      <input ref={input} type="file" accept={slot.video ? "video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/webp"} style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
    </div>
  );
};
