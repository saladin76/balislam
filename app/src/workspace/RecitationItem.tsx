import React, { useState } from "react";
import { api, type Loudness, type OwnRecitationsRead, type RecitationPolish, type RecitationVariant } from "../api";
import { useOwnerSession } from "../shell/ownerSession";

const lufs = (l?: Loudness | null) => (l && Number.isFinite(l.integrated) ? `${l.integrated.toFixed(1)} LUFS · ذروة ${l.truePeak.toFixed(1)} dBTP` : "—");
const sec = (n: number) => `${n.toFixed(2)} ث`;

export const recitationUrl = (episodeId: string, channelId: string, file: string) =>
  `/api/episodes/${encodeURIComponent(episodeId)}/media/recitations/${encodeURIComponent(file)}?channel=${encodeURIComponent(channelId)}`;

/**
 * تلاوة آية واحدة يرفعها المالك (التلاوات آخرًا، D35): رفع ← نسخة معالجة بجوار الأصل كما سُجّل ← اختيار النسخة ←
 * اسم القارئ ودليل الحق وملاحظة الاستماع ← «اعتمد التلاوة». المسار نفسه في الخطوة ٣ («التلاوات») وفي «الجمل»
 * (صف الآية في تسلسل المشهد): `own-recitations` على الخادم، ولا توليد ولا جلب للقرآن أبدًا.
 */
export const RecitationItem: React.FC<{
  episodeId: string; channelId: string; ayahKey: string; scenes: string[];
  recs: OwnRecitationsRead | null; onChanged: () => void | Promise<void>; compact?: boolean;
}> = ({ episodeId, channelId, ayahKey: key, scenes, recs, onChanged, compact }) => {
  const owner = useOwnerSession();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [f, setF] = useState({ reciter: "", rights: "", note: "", listened: false });
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });
  const approved = recs?.approved[key];
  const pending = recs?.pending[key];
  const audioUrl = (file: string) => recitationUrl(episodeId, channelId, file);

  const guard = async (label: string, work: () => Promise<void>) => {
    if (!owner.open) return setError("افتح جلسة المالك من أعلى الصفحة أولًا.");
    setBusy(label);
    setError("");
    setMsg("");
    try {
      await work();
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const upload = (file: File) => guard("up", async () => {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("تعذّر قراءة الملف."));
      reader.readAsDataURL(file);
    });
    await api.ownRecitationAction(episodeId, channelId, owner.secret, { action: "upload", key, name: file.name, data });
    setMsg("رُفعت التلاوة وجُهّزت نسختها المعالجة؛ استمع إليها ثم اعتمدها.");
  });
  const select = (variant: "processed" | "original") => guard("sel", async () => {
    await api.ownRecitationAction(episodeId, channelId, owner.secret, { action: "select", key, variant });
  });
  const approve = () => guard("ok", async () => {
    await api.ownRecitationAction(episodeId, channelId, owner.secret, { action: "approve", key, reciter: f.reciter, rightsEvidence: f.rights, note: f.note, listened: f.listened });
    setMsg("اعتُمدت التلاوة. مشهدها وحده يُفتح لمراجعة سريعة بالتلاوة في «المشاهد».");
  });

  const variants = (vs: Record<"processed" | "original", RecitationVariant>, chosen: string | null, polish: RecitationPolish | null) => (
    <div className="pf-variants">
      {(["processed", "original"] as const).map((id) => (
        <label key={id} className={`pf-variant${chosen === id ? " is-on" : ""}`}>
          <input type="radio" name={`v-${key}`} checked={chosen === id} disabled={Boolean(busy) || !owner.open} onChange={() => void select(id)} />
          <b>{id === "processed" ? "المعالجة" : "الأصل كما سُجّل"}</b>
          <span className="sp-hint">{lufs(vs[id].loudness)} · {sec(vs[id].duration)}</span>
          <audio controls preload="none" src={audioUrl(vs[id].file)} />
        </label>
      ))}
      {polish ? (
        <p className="sp-hint">
          قبل: {lufs(polish.before)} ← بعد: {lufs(vs.processed.loudness)} (الهدف {polish.target.integrated} LUFS {polish.target.source === "narration" ? "مطابق لعلوّ صوت الراوي" : "الافتراضي"}).
          {" "}قُصّ من الصمت: أول {sec(polish.trim.trimmedHead)} وآخر {sec(polish.trim.trimmedTail)}، بلا مساس بالتلاوة ولا تغيير في طبقتها أو سرعتها.
        </p>
      ) : null}
    </div>
  );

  return (
    <li className={`pf-rec${compact ? " is-compact" : ""}`}>
      <div className="pf-rec-head">
        <b dir="ltr">{key}</b> <span className="sp-hint">المشهد {scenes.join("، ")}</span>
        <span className={`pf-st is-${approved ? "ok" : pending ? "review" : "missing"}`}>{approved ? "معتمدة" : pending ? "بانتظار استماعك" : "لم تُرفع"}</span>
      </div>
      {approved ? (
        approved.variants ? variants(approved.variants, approved.variant, approved.polish) : <audio controls preload="none" src={audioUrl(approved.file)} />
      ) : pending ? (
        <>
          {pending.variants ? variants(pending.variants, pending.variant ?? "processed", pending.polish ?? null) : <audio controls preload="none" src={audioUrl(pending.file)} />}
          <div className="pf-approve">
            <input placeholder="اسم القارئ" value={f.reciter} onChange={(e) => set({ reciter: e.target.value })} aria-label="اسم القارئ" />
            <input placeholder="دليل حق الاستخدام (مثل: تسجيلي الخاص بتاريخ…)" value={f.rights} onChange={(e) => set({ rights: e.target.value })} aria-label="دليل حق الاستخدام" />
            <textarea rows={2} placeholder="ملاحظة الاستماع" value={f.note} onChange={(e) => set({ note: e.target.value })} aria-label="ملاحظة الاستماع" />
            <label className="sp-confirm"><input type="checkbox" checked={f.listened} onChange={(e) => set({ listened: e.target.checked })} /> استمعت إلى التلاوة كاملة</label>
            {!(f.reciter.trim() && f.rights.trim().length >= 12 && f.note.trim().length >= 12) ? (
              <p className="sp-hint">اكتب اسم القارئ، ودليل حق الاستخدام وملاحظة الاستماع (١٢ حرفًا على الأقل لكل منهما).</p>
            ) : null}
            <button type="button" className={`btn ${compact ? "" : "primary"}`} disabled={Boolean(busy) || !owner.open || !f.listened || !f.reciter.trim() || f.rights.trim().length < 12 || f.note.trim().length < 12} onClick={() => void approve()}>اعتمد التلاوة</button>
          </div>
        </>
      ) : null}
      {!pending ? (
        <label className="btn ghost pf-upload">
          {busy === "up" ? "جارٍ الرفع والمعالجة…" : approved ? "استبدل التسجيل" : "ارفع التلاوة"}
          <input type="file" accept=".wav,.mp3,.m4a,.aac,.ogg,.flac,audio/*" hidden disabled={Boolean(busy) || !owner.open}
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(file); }} />
        </label>
      ) : null}
      {error ? <p className="scene-first-error" role="alert">{error}</p> : null}
      {msg ? <p className="sp-hint" role="status">{msg}</p> : null}
    </li>
  );
};
