import React, { useEffect, useState } from "react";
import { api } from "../api";
import { OwnerText } from "../ui/OwnerText";

/**
 * D228 «التصميم بالفهم والاختيار، لا بالنسخ» داخل «بانتظارك»: ستوري بورد أول ستة مشاهد لكل قالب أو شكل جديد،
 * ٢–٣ نماذج لكل مشهد (صورة ثابتة وسطر الحركة). لا يُبرمج ولا يُستعمل قالب قبل أن تختار نموذجه وتعتمده هنا؛
 * والبوابة في الرندر تمنع أي مشهد بقالب «مقترح».
 */
type Data = Awaited<ReturnType<typeof api.templateApprovals>>;
const ar = (n: number) => n.toLocaleString("ar-EG");

export const TemplateStoryboards: React.FC = () => {
  const [data, setData] = useState<Data | null>(null);
  const [msg, setMsg] = useState("");
  const load = () => api.templateApprovals().then(setData, (e) => setMsg((e as Error).message));
  useEffect(() => { void load(); }, []);
  if (!data) return msg ? <p className="warn"><OwnerText text={msg} /></p> : null;
  const entries = Object.entries(data.templates);
  if (!data.storyboards.length && !entries.length) return null;
  const approve = async (key: string, variant: string) => {
    if (!window.confirm(`تعتمد النموذج «${variant}» للقالب «${data.templates[key]?.nameAr ?? key}»؟ بعده فقط يُبرمج القالب، ثم دقيقة متحركة قبل الحلقة كاملة.`)) return;
    try { await api.approveTemplate(key, variant); setMsg("اعتُمد النموذج"); void load(); } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <section className="group awaiting-storyboards">
      <h3>قوالب جديدة بانتظار اختيارك (D228)</h3>
      <p className="help">التصاميم المرسلة إلهام لا نسخ. لكل قالب أو شكل جديد: أول ستة مشاهد، ولكل مشهد ٢–٣ نماذج. لا يُبرمج قالب ولا يُرندر مشهد به قبل اعتمادك.</p>
      {entries.map(([key, t]) => (
        <p key={key} className={t.status === "معتمد من المالك" ? "help" : "warn"}>
          <strong>{t.nameAr}</strong> <small>({key})</small>: {t.status}
          {t.approval ? ` — ${t.approval.by}، ${new Date(t.approval.at).toLocaleString("ar-EG")}، النموذج «${t.approval.variant}»` : ""}
        </p>
      ))}
      {data.storyboards.map((sb) => {
        const keys = entries.filter(([, t]) => t.storyboard === sb.folder);
        const scenes = [...new Set(sb.variants.map((v) => v.scene))].sort((a, b) => a - b);
        return (
          <article key={sb.folder} className="group">
            <h4>{sb.folder} <small>{ar(scenes.length)} مشاهد، {ar(sb.variants.length)} نموذج</small></h4>
            {sb.issues.map((x) => <p key={x} className="warn">{x}</p>)}
            {scenes.map((s) => (
              <div key={s}>
                <h5>المشهد {ar(s)}</h5>
                <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
                  {sb.variants.filter((v) => v.scene === s).map((v) => (
                    <figure key={v.file} style={{ width: 360, margin: 0 }}>
                      <img src={api.storyboardImageUrl(sb.folder, v.file)} alt={v.title ?? v.variant} style={{ width: "100%", borderRadius: 6 }} loading="lazy" />
                      <figcaption>
                        <strong>{v.variant}</strong>{v.title ? `، ${v.title}` : ""}
                        {v.motion && <p className="help">الحركة: {v.motion}</p>}
                        {v.why && <p className="help">{v.why}</p>}
                        {keys.filter(([, t]) => t.status !== "معتمد من المالك" && (!t.variants?.length || t.variants.includes(v.variant))).map(([key, t]) => (
                          <button key={key} type="button" className="btn primary small" onClick={() => void approve(key, v.variant)}>اعتمد هذا النموذج لـ«{t.nameAr}»</button>
                        ))}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ))}
          </article>
        );
      })}
      {msg && <small role="status"><OwnerText text={msg} /></small>}
    </section>
  );
};
