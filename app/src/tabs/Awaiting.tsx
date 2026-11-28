import React, { useEffect, useState } from "react";
import { api, type StockOverview } from "../api";
import { OwnerText } from "../ui/OwnerText";
import { TemplateStoryboards } from "./TemplateStoryboards";
import type { StockEpisodeView } from "../../../src/studio/stock";

/**
 * «بانتظارك» (D213، بناء المخزون): كل ما ينتظر مراجعة المالك في القنوات الثلاث في مكان واحد.
 * المسودات مجمّعة بدفعاتها (كل دفعة PR أسبوعي)، ولكل حلقة: العنوان والقناة والسلسلة وموضعها في ترتيب النشر
 * (أسبوع ويوم، ترتيب لا موعد: النشر يبدأ بعد اعتماد الشكل و«دفاتر الزمن 001» ومراجعة المتخصص)، وبنود المتخصص،
 * وفتح السكريبت والبحث ووصف المشاهد، و«اعتمدت السكريبت» (اعتماد النص وحده: لا صوت ولا رندر).
 * D234: لكل سكريبت حالته بالترتيب الثابت («بانتظار المحرر» / «بانتظار المراجعة العلمية» / «بانتظار اعتمادك» / «جاهز للإنتاج»)،
 * و«اعتمدت السكريبت» لا يظهر قبل أن يمرّ بالمحرر والمراجعة العلمية (والخادم يرفضه قبلهما).
 */
const CHANNEL_NAME: Record<string, string> = { balislam: "بالإسلام", "dafatir-alzaman": "دفاتر الزمن", "zubdat-alkutub": "زبدة الكتب" };
const FILES: { name: string; label: string; key: keyof StockEpisodeView["files"] }[] = [
  { name: "script.md", label: "السكريبت", key: "script" },
  { name: "research.md", label: "البحث والمصادر", key: "research" },
  { name: "scenes.md", label: "وصف المشاهد", key: "scenes" },
  { name: "publish.draft.json", label: "حزمة النشر (مسودة)", key: "publish" },
];
const ar = (n: number) => n.toLocaleString("ar-EG");
const batchName = (b: number | null) => (b === null ? "خارج الدفعات" : b === 1 ? "الدفعة ١ (رمضان)" : `الدفعة ${ar(b)}`);

const Row: React.FC<{ v: StockEpisodeView; onChanged: () => void }> = ({ v, onChanged }) => {
  const [open, setOpen] = useState<{ name: string; text: string | null } | null>(null);
  const [msg, setMsg] = useState("");
  const show = async (name: string) => {
    if (open?.name === name) return setOpen(null);
    try { setOpen(await api.stockFile(v.channel, v.episode!, name)); } catch (e) { setMsg((e as Error).message); }
  };
  const approve = async () => {
    if (!window.confirm(`تعتمد سكريبت «${v.title}» كما هو الآن؟ مرّ بالمحرر والمراجعة العلمية. اعتماد النص وحده: لا صوت ولا رندر، وتبقى الحلقة «مسودة» حتى تغيير حالتها.`)) return;
    try { await api.approveDraftScript(v.channel, v.episode!); setMsg("اعتُمد السكريبت"); onChanged(); } catch (e) { setMsg((e as Error).message); }
  };
  const p = v.pipeline;
  const state = v.approval.stale ? "تغيّر بعد اعتمادك" : v.approval.approved ? "اعتمدت السكريبت" : "";
  const editorNote = p.status === "بانتظار المحرر"
    ? (p.editor.partial ? `${ar(p.editor.pending)} جملة تغيّرت بعد مراجعة المحرر تنتظره وحدها.` : "لم يراجعه محرر المحتوى بعد.")
    : p.editor.grandfathered ? `المحرر: ${p.editor.grandfathered}` : "";
  return (
    <article className={`group awaiting-row${v.approval.approved && !v.approval.stale ? " is-approved" : ""}`} data-channel={v.channel} data-episode={v.episode}>
      <h4>
        <span className="pill warn">مسودة</span> {v.title} <small>{CHANNEL_NAME[v.channel] ?? v.channel} {v.episode}</small>
        {" "}<span className={`s45-pill pipeline-status${p.status === "جاهز للإنتاج" ? " is-on" : ""}`} data-status={p.status}>{p.status}</span>
      </h4>
      <p className="help">
        {v.series ? `السلسلة: ${v.seriesName ?? v.series} | ` : ""}{v.week !== null ? `ترتيب النشر: الأسبوع ${ar(v.week)}، ${v.day}` : "خارج ترتيب النشر"}{state ? <> | <strong>{state}</strong></> : null}
      </p>
      {editorNote && <p className="help">{editorNote}</p>}
      {v.specialist.length > 0
        ? <p className="warn"><strong>يحتاج المتخصص قبل الصوت:</strong> {v.specialist.join("؛ ")}</p>
        : <p className="help">لا بنود للمتخصص مسجّلة لهذه الحلقة.</p>}
      <div className="row">
        {FILES.filter((f) => v.files[f.key]).map((f) => (
          <button key={f.name} type="button" className={`btn small${open?.name === f.name ? " primary" : ""}`} onClick={() => void show(f.name)}>{f.label}</button>
        ))}
        {/* D234: الزر بعد المحرر والمراجعة العلمية وحدهما */}
        {p.status === "بانتظار اعتمادك" && <button type="button" className="btn primary small" onClick={() => void approve()}>اعتمدت السكريبت</button>}
      </div>
      {open && <pre className="awaiting-file" dir="rtl" style={{ maxHeight: 420, overflow: "auto", whiteSpace: "pre-wrap" }}>{open.text ?? "الملف غير موجود بعد."}</pre>}
      {msg && <small role="status"><OwnerText text={msg} /></small>}
    </article>
  );
};

export const Awaiting: React.FC = () => {
  const [data, setData] = useState<StockOverview[] | null>(null);
  const [err, setErr] = useState("");
  const load = () => api.stockAll().then((r) => setData(r.channels), (e) => setErr((e as Error).message));
  useEffect(() => { void load(); }, []);
  if (err) return <p className="warn" role="alert"><OwnerText text={err} /></p>;
  if (!data) return <p className="help">جارٍ التحميل…</p>;
  const drafts = data.flatMap((c) => c.views.filter((v) => v.exists && v.draft));
  const waiting = drafts.filter((v) => v.pipeline.status === "بانتظار اعتمادك").length;
  const count = (st: string) => drafts.filter((v) => v.pipeline.status === st).length;
  const batches = [...new Set(drafts.map((v) => v.batch))].sort((a, b) => (a ?? 999) - (b ?? 999));
  return (
    <div className="awaiting">
      <TemplateStoryboards />
      <p className="help">
        الترتيب ثابت (D234): مسودة ← محرر المحتوى ← المراجعة العلمية ← اعتمادك ← صوت ← رندر. {`بانتظار المحرر ${ar(count("بانتظار المحرر"))}، والمراجعة العلمية ${ar(count("بانتظار المراجعة العلمية"))}، واعتمادك ${ar(count("بانتظار اعتمادك"))}، وجاهز للإنتاج ${ar(count("جاهز للإنتاج"))}.`} ترتيب النشر أسابيع لا مواعيد:
        يبدأ النشر بعد اعتمادك الشكل و«دفاتر الزمن 001» ومراجعة المتخصص. {waiting ? `بانتظارك ${ar(waiting)} من ${ar(drafts.length)}.` : drafts.length ? "لا شيء بانتظارك الآن." : "لا مسودات بعد."}
      </p>
      {data.filter((c) => c.frozen).map((c) => (
        <p key={c.channel} className="warn">«{CHANNEL_NAME[c.channel] ?? c.channel}»: إنتاج الفيديو مجمّد ({c.frozen!.decision}). {c.frozen!.note ?? ""}</p>
      ))}
      {data.flatMap((c) => c.issues.map((x) => <p key={`${c.channel}:${x}`} className="warn"><OwnerText text={`${CHANNEL_NAME[c.channel] ?? c.channel}: ${x}`} /></p>))}
      {batches.map((b) => (
        <section key={String(b)} className="group awaiting-batch">
          <h3>{batchName(b)}</h3>
          {drafts.filter((v) => v.batch === b).sort((x, y) => (x.week ?? 99) - (y.week ?? 99) || x.channel.localeCompare(y.channel))
            .map((v) => <Row key={`${v.channel}/${v.episode}`} v={v} onChanged={load} />)}
        </section>
      ))}
    </div>
  );
};
