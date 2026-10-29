import React, { useEffect, useMemo, useState } from "react";
import { Element } from "../../../brand/elements/Element";
import { elementLibrary } from "../../../brand/elements/registry";
import { categoryNamesAr, categoryOrder, type ElementCategory } from "../../../brand/elements/types";
import { Character, characterNamesAr, characterPoseNamesAr, characterPoses, characterVariants } from "../../../characters/Character";
import { useTheme } from "../../../brand/identity/index";
import { themeIds, type ThemeId } from "../../../brand/themes";
import { api, type LongJob, type SfxItem } from "../api";

type Section = "elements" | "characters" | "sfx";

/** مكتبة القناة: العناصر والشخصيات والمؤثرات، بألوان الهوية الحالية. */
export const LibraryTab: React.FC<{ hasVoiceKeys: boolean }> = ({ hasVoiceKeys }) => {
  const [section, setSection] = useState<Section>("elements");
  const [themeId, setThemeId] = useState<ThemeId>("paper");
  const t = useTheme(themeId);
  return (
    <div className="library">
      <div className="toolbar">
        <div className="seg" role="group" aria-label="القسم">
          {([["elements", `العناصر (${elementLibrary.length})`], ["characters", "الشخصيات"], ["sfx", "المؤثرات الصوتية"]] as const).map(([k, l]) => (
            <button key={k} aria-pressed={section === k} onClick={() => setSection(k)}>{l}</button>
          ))}
        </div>
        <span className="spacer" />
        {section !== "sfx" ? (
          <div className="seg" role="group" aria-label="الثيم">
            {themeIds.map((id) => (
              <ThemeButton key={id} id={id} active={id === themeId} onClick={() => setThemeId(id)} />
            ))}
          </div>
        ) : null}
      </div>
      {section === "elements" ? <Elements themeId={themeId} /> : null}
      {section === "characters" ? (
        <div className="lib-chars" style={{ background: t.colors.bg }}>
          {characterVariants.map((v) => (
            <div key={v} className="lib-char-row">
              <b style={{ color: t.colors.ink }}>{characterNamesAr[v]}</b>
              <div className="lib-char-poses">
                {characterPoses.map((p) => (
                  <figure key={p}>
                    <Character theme={t} variant={v} pose={p} height={130} />
                    <figcaption style={{ color: t.colors.inkSoft }}>{characterPoseNamesAr[p]}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {section === "sfx" ? <Sfx hasVoiceKeys={hasVoiceKeys} /> : null}
    </div>
  );
};

const ThemeButton: React.FC<{ id: ThemeId; active: boolean; onClick: () => void }> = ({ id, active, onClick }) => {
  const t = useTheme(id);
  return (
    <button aria-pressed={active} onClick={onClick}>
      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: t.colors.primary, marginInlineEnd: 6 }} />
      {t.nameAr}
    </button>
  );
};

const Elements: React.FC<{ themeId: ThemeId }> = ({ themeId }) => {
  const t = useTheme(themeId);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ElementCategory | "all">("all");
  const [copied, setCopied] = useState("");
  const items = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return elementLibrary.filter((e) => (cat === "all" || e.category === cat) && (!qq || `${e.nameAr} ${e.id} ${e.tags.join(" ")}`.toLowerCase().includes(qq)));
  }, [q, cat]);
  return (
    <>
      <div className="toolbar">
        <input id="lib-search" type="text" placeholder="ابحث: قلب، هاتف، coin…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 300 }} />
        <div className="cat-row">
          <button aria-pressed={cat === "all"} onClick={() => setCat("all")}>الكل</button>
          {categoryOrder.map((c) => (
            <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{categoryNamesAr[c]}</button>
          ))}
        </div>
      </div>
      <p className="help">اضغط على عنصر لنسخ معرّفه واستخدامه في السكريبت، مثل [مشهد: symbolic | element=seed].</p>
      <div className="grid-el lib-grid">
        {items.map((e) => (
          <button
            key={e.id}
            className="el-card"
            title={e.tags.join("، ")}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(e.id);
                setCopied(e.id);
                setTimeout(() => setCopied(""), 1200);
              } catch {
                /* لا شيء */
              }
            }}
          >
            <div className="stage" style={{ background: t.colors.bg, aspectRatio: e.kind === "backdrop" ? "16 / 9" : "1" }}>
              {e.kind === "backdrop" ? <Element id={e.id} theme={t} width={1920} height={1080} style={{ width: "100%", height: "100%" }} /> : <Element id={e.id} theme={t} size={78} />}
            </div>
            <span>{e.nameAr}</span>
            <code className="help" style={{ direction: "ltr", fontSize: 11 }}>{copied === e.id ? "نُسخ ✓" : e.id}</code>
          </button>
        ))}
      </div>
    </>
  );
};

const Sfx: React.FC<{ hasVoiceKeys: boolean }> = ({ hasVoiceKeys }) => {
  const [list, setList] = useState<SfxItem[] | null>(null);
  const [job, setJob] = useState<LongJob | null>(null);
  const load = () => api.sfx().then(setList).catch(() => setList([]));
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (job?.status !== "running") return;
    const t = setInterval(async () => {
      const all = await api.longJobs().catch(() => []);
      const j = all.find((x) => x.id === job.id);
      if (j) setJob(j);
      if (j && j.status !== "running") load();
    }, 1500);
    return () => clearInterval(t);
  }, [job?.id, job?.status]);
  if (!list) return <p className="help">جارٍ التحميل…</p>;
  const have = list.filter((s) => s.available).length;
  const generatable = list.filter((s) => !s.available && s.category !== "vocal").length;
  return (
    <>
      <div className="toolbar">
        <span className="help">موجود {have} من {list.length}. الآهات البشرية تُسجَّل بصوت منشد ولا تُولَّد، وكل مؤثر يُسمع ويُعتمد قبل النشر.</span>
        <span className="spacer" />
        <button className="btn primary" disabled={!hasVoiceKeys || !generatable || job?.status === "running"} title={hasVoiceKeys ? "" : "يتطلب مفاتيح ElevenLabs"} onClick={async () => { try { setJob(await api.startJob({ kind: "sfx" })); } catch (x) { window.alert((x as Error).message); } }}>
          {job?.status === "running" ? `جارٍ التوليد… ${job.log[job.log.length - 1] ?? ""}` : `ولّد الناقص (${generatable})`}
        </button>
      </div>
      <div className="tablewrap">
        <table className="sfx-table">
          <thead>
            <tr><th>المؤثر</th><th>المعرّف</th><th>الفئة</th><th>متى يُستخدم</th><th>ث</th><th>الملف</th></tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td>{s.nameAr}{s.guard ? <div className="help" style={{ color: "var(--accent)" }}>{s.guard}</div> : null}</td>
                <td><code style={{ direction: "ltr" }}>{s.id}</code></td>
                <td><span className="badge">{s.categoryAr}</span></td>
                <td>{s.useAr}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{s.seconds}</td>
                <td>{s.available ? <audio src={api.sfxUrl(s.id)} controls preload="none" style={{ height: 30, width: 200 }} /> : <span className="help">{s.category === "vocal" ? "تسجيل بشري" : "غير مولَّد"}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
