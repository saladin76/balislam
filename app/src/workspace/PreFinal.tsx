import React, { useEffect, useState } from "react";
import { api, type Loudness, type OwnRecitationsRead, type RecitationPolish, type RecitationVariant } from "../api";
import { useOwnerSession } from "../shell/ownerSession";
import "./scene-production.css";

const ar = (n: number) => n.toLocaleString("ar-EG");
const lufs = (l?: Loudness | null) => (l && Number.isFinite(l.integrated) ? `${l.integrated.toFixed(1)} LUFS · ذروة ${l.truePeak.toFixed(1)} dBTP` : "—");
const sec = (n: number) => `${n.toFixed(2)} ث`;

/**
 * Step ٤ (owner decision, 8 Nov: recitations come LAST).
 *  1. «معاينة قبل النهائية»: every current scene cut in order (approved or draft), with narration, verse
 *     scenes silent and marked «التلاوة تُضاف لاحقًا». For watching only: it is not an approval, not the
 *     assembly and never a Master.
 *  2. «التلاوات»: the owner uploads each verse he recorded; the Studio keeps the original and makes a
 *     processed copy (edge silence, gentle denoise, loudness matched to the narration), shows the loudness
 *     before/after, and the owner may switch back to the original before approving after listening.
 * The final gates are unchanged: every scene approved unconditionally with its recitation, the assembly
 * watched 1× with every seam, then Master, then publish permission.
 */
export const PreFinalPanel: React.FC<{ episodeId: string; channelId: string; onChanged?: () => void }> = ({ episodeId, channelId, onChanged }) => {
  const owner = useOwnerSession();
  const [pre, setPre] = useState<{ preview: string | null; entry: { version: number; updatedAt: string | null } | null } | null>(null);
  const [recs, setRecs] = useState<OwnRecitationsRead | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<Record<string, { reciter: string; rights: string; note: string; listened: boolean }>>({});

  const load = async () => {
    const [p, r] = await Promise.all([api.preFinal(episodeId, channelId).catch(() => null), api.ownRecitations(episodeId, channelId).catch(() => null)]);
    setPre(p);
    setRecs(r);
  };
  useEffect(() => { setError(""); setMsg(""); void load(); }, [episodeId, channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const guard = async (label: string, work: () => Promise<void>) => {
    if (!owner.open) return setError("افتح جلسة المالك من أعلى الصفحة أولًا.");
    setBusy(label);
    setError("");
    setMsg("");
    try {
      await work();
      await load();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const makePreFinal = () => guard("prefinal", async () => {
    const r = await api.makePreFinal(episodeId, channelId, owner.secret);
    setMsg(`جُمعت ${ar(r.scenes)} مشاهد${r.recitationPending.length ? `؛ ${ar(r.recitationPending.length)} آية صامتة بانتظار تلاوتها` : ""}.`);
  });
  const upload = (key: string, file: File) => guard(`up:${key}`, async () => {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("تعذّر قراءة الملف."));
      reader.readAsDataURL(file);
    });
    await api.ownRecitationAction(episodeId, channelId, owner.secret, { action: "upload", key, name: file.name, data });
    setMsg("رُفعت التلاوة وجُهّزت نسختها المعالجة؛ استمع إليها ثم اعتمدها.");
  });
  const select = (key: string, variant: "processed" | "original") => guard(`sel:${key}`, async () => {
    await api.ownRecitationAction(episodeId, channelId, owner.secret, { action: "select", key, variant });
  });
  const approve = (key: string) => guard(`ok:${key}`, async () => {
    const f = form[key] ?? { reciter: "", rights: "", note: "", listened: false };
    await api.ownRecitationAction(episodeId, channelId, owner.secret, { action: "approve", key, reciter: f.reciter, rightsEvidence: f.rights, note: f.note, listened: f.listened });
    setMsg("اعتُمدت التلاوة. مشهدها وحده يُفتح لمراجعة سريعة بالتلاوة في «المشاهد».");
  });

  const audioUrl = (file: string) => `/api/episodes/${encodeURIComponent(episodeId)}/media/recitations/${encodeURIComponent(file)}?channel=${encodeURIComponent(channelId)}`;
  const verses = recs?.verses ?? [];
  const keys = [...new Set(verses.map((v) => v.key))];
  const missing = keys.filter((k) => !recs?.approved[k]);

  const variants = (key: string, vs: Record<"processed" | "original", RecitationVariant>, chosen: string | null, polish: RecitationPolish | null) => (
    <div className="pf-variants">
      {(["processed", "original"] as const).map((id) => (
        <label key={id} className={`pf-variant${chosen === id ? " is-on" : ""}`}>
          <input type="radio" name={`v-${key}`} checked={chosen === id} disabled={Boolean(busy) || !owner.open} onChange={() => void select(key, id)} />
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
    <section className="scene-first-panel sp pf" aria-label="معاينة قبل النهائية والتلاوات">
      <div className="sp-row">
        <div>
          <h3>معاينة قبل النهائية</h3>
          <p className="sp-hint">كل المشاهد الحالية بالترتيب (المعتمدة والمسودات) بصوت الراوي، والآيات صامتة بعلامة «التلاوة تُضاف لاحقًا». للمشاهدة فقط: ليست اعتمادًا ولا تجميعًا ولا نسخة نهائية.</p>
        </div>
        <div className="sp-actions">
          <button type="button" className="btn primary" disabled={Boolean(busy) || !owner.open} onClick={() => void makePreFinal()}>
            {busy === "prefinal" ? "جارٍ التجميع…" : pre?.preview ? "حدّث المعاينة قبل النهائية" : "اصنع المعاينة قبل النهائية"}
          </button>
        </div>
      </div>
      {pre?.preview ? (
        <video key={`${pre.entry?.version ?? 0}`} className="scene-first-video" controls preload="metadata"
          src={api.previewUrl(episodeId, pre.preview)} aria-label="المعاينة قبل النهائية بلا تلاوات" />
      ) : null}

      {keys.length ? (
        <div className="pf-recs">
          <h3>التلاوات ({ar(keys.length - missing.length)} من {ar(keys.length)} معتمدة)</h3>
          <p className="sp-hint">سجّل الآيات بنفسك وارفع كل تلاوة هنا. تُحفظ نسختك الأصلية كما هي، وتُجهَّز نسخة معالجة (قصّ صمت الطرفين، تنقية خفيفة، وعلوّ مطابق للراوي)؛ ولك أن تختار الأصل. لا جلب ولا توليد للقرآن.</p>
          <ul className="pf-rec-list">
            {keys.map((key) => {
              const approved = recs!.approved[key];
              const pending = recs!.pending[key];
              const scenes = verses.filter((v) => v.key === key).map((v) => v.sceneId);
              const f = form[key] ?? { reciter: "", rights: "", note: "", listened: false };
              const set = (patch: Partial<typeof f>) => setForm({ ...form, [key]: { ...f, ...patch } });
              return (
                <li key={key} className="pf-rec">
                  <div className="pf-rec-head">
                    <b dir="ltr">{key}</b> <span className="sp-hint">المشهد {scenes.join("، ")}</span>
                    <span className={`pf-st is-${approved ? "ok" : pending ? "review" : "missing"}`}>{approved ? "معتمدة" : pending ? "بانتظار استماعك" : "لم تُرفع"}</span>
                  </div>
                  {approved ? (
                    approved.variants ? variants(key, approved.variants, approved.variant, approved.polish) : <audio controls preload="none" src={audioUrl(approved.file)} />
                  ) : pending ? (
                    <>
                      {pending.variants ? variants(key, pending.variants, pending.variant ?? "processed", pending.polish ?? null) : <audio controls preload="none" src={audioUrl(pending.file)} />}
                      <div className="pf-approve">
                        <input placeholder="اسم القارئ" value={f.reciter} onChange={(e) => set({ reciter: e.target.value })} aria-label="اسم القارئ" />
                        <input placeholder="دليل حق الاستخدام (مثل: تسجيلي الخاص بتاريخ…)" value={f.rights} onChange={(e) => set({ rights: e.target.value })} aria-label="دليل حق الاستخدام" />
                        <textarea rows={2} placeholder="ملاحظة الاستماع" value={f.note} onChange={(e) => set({ note: e.target.value })} aria-label="ملاحظة الاستماع" />
                        <label className="sp-confirm"><input type="checkbox" checked={f.listened} onChange={(e) => set({ listened: e.target.checked })} /> استمعت إلى التلاوة كاملة</label>
                        {!(f.reciter.trim() && f.rights.trim().length >= 12 && f.note.trim().length >= 12) ? (
                          <p className="sp-hint">اكتب اسم القارئ، ودليل حق الاستخدام وملاحظة الاستماع (١٢ حرفًا على الأقل لكل منهما).</p>
                        ) : null}
                        <button type="button" className="btn primary" disabled={Boolean(busy) || !owner.open || !f.listened || !f.reciter.trim() || f.rights.trim().length < 12 || f.note.trim().length < 12} onClick={() => void approve(key)}>اعتمد التلاوة</button>
                      </div>
                    </>
                  ) : null}
                  {!pending ? (
                    <label className="btn ghost pf-upload">
                      {busy === `up:${key}` ? "جارٍ الرفع والمعالجة…" : approved ? "استبدل التسجيل" : "ارفع التلاوة"}
                      <input type="file" accept=".wav,.mp3,.m4a,.aac,.ogg,.flac,audio/*" hidden disabled={Boolean(busy) || !owner.open}
                        onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(key, file); }} />
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {error ? <p className="scene-first-error" role="alert">{error}</p> : null}
      {msg ? <p className="sp-hint" role="status">{msg}</p> : null}
    </section>
  );
};
