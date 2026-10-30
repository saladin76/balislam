import { OverlayToggles } from "../ui/Overlays";
import { resolveOverlays } from "../../../brand/identity/index";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import type { Plan, PlanScene } from "../../../src/plan/types";
import { templateById, templateDefs } from "../../../src/plan/templates";
import { defaultsFor } from "../../../src/plan/generate";
import { sceneFrames, sceneSeconds } from "../../../src/plan/duration";
import { sfxLibrary, sfxCategoryNamesAr } from "../../../brand/sfx";
import type { Identity } from "../../../brand/identity/index";
import type { CharacterPose, CharacterVariant } from "../../../characters/Character";
import { CharacterField, ElementField } from "../ui/Pickers";
import { EpisodePreview, ScenePreview, type Orientation } from "../ui/Preview";
import { api, type RenderJob, type VoiceReport } from "../api";
import type { EpisodeMedia } from "../../../src/plan/media";
import { planIssues, type PlanIssue } from "../../../src/plan/validate";
import type { ChannelInfo } from "../../../src/channel/types";
import { langPack } from "../../../src/i18n/packs";

type Scope = "scene" | "chapter" | "episode";

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

export const EpisodeTab: React.FC<{
  episodeId: string;
  plan: Plan;
  identity: Identity;
  channel: ChannelInfo;
  media: EpisodeMedia;
  issues: PlanIssue[];
  keys: { voice: boolean; quran: boolean };
  onPlanChange: (plan: Plan) => void;
  onMediaChange: (media: EpisodeMedia) => void;
  onReload: () => void;
  onEditScript: (line: number) => void;
}> = ({ episodeId, plan, identity, channel, media, issues, keys, onPlanChange, onMediaChange, onReload, onEditScript }) => {
  const allScenes = useMemo(() => plan.chapters.flatMap((c) => c.scenes.map((s) => ({ scene: s, chapter: c }))), [plan]);
  const [selectedId, setSelectedId] = useState(allScenes[0]?.scene.id ?? "");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [scope, setScope] = useState<Scope>("scene");
  const playerRef = useRef<PlayerRef>(null);
  const sel = allScenes.find((x) => x.scene.id === selectedId) ?? allScenes[0];

  useEffect(() => {
    if (!allScenes.some((x) => x.scene.id === selectedId) && allScenes[0]) setSelectedId(allScenes[0].scene.id);
  }, [allScenes, selectedId]);

  // في معاينة الفصل أو الحلقة: القفز إلى بداية المشهد المختار
  useEffect(() => {
    if (scope === "scene" || !sel) return;
    let frame = 0;
    for (const ch of plan.chapters) {
      if (scope === "chapter" && ch.number !== sel.chapter.number) continue;
      for (const s of ch.scenes) {
        if (s.id === sel.scene.id) {
          playerRef.current?.seekTo(frame);
          return;
        }
        frame += sceneFrames(s, media);
      }
    }
  }, [selectedId, scope]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateScene = (patch: Partial<PlanScene>) => {
    if (!sel) return;
    onPlanChange({
      ...plan,
      chapters: plan.chapters.map((c) => ({ ...c, scenes: c.scenes.map((s) => (s.id === sel.scene.id ? { ...s, ...patch, edited: true } : s)) })),
    });
  };
  const setProp = (key: string, value: string) => sel && updateScene({ props: { ...sel.scene.props, [key]: value } });
  // عناصر الشاشة: القناة ← الحلقة ← المشهد
  const channelOv = resolveOverlays(identity.overlays);
  const episodeOv = resolveOverlays(identity.overlays, plan.overlays);

  const liveIssues = useMemo(() => planIssues(plan), [plan]);
  void issues;
  const totalSec = allScenes.reduce((n, x) => n + sceneSeconds(x.scene, media), 0);
  const voiceState = (s: PlanScene): "none" | "ok" | "stale" | "missing" => {
    if (!s.narration.trim()) return "none";
    const clip = media.voice[s.id];
    if (!clip) return "missing";
    return clip.text === s.narration.trim() ? "ok" : "stale";
  };

  if (!sel) return <div className="empty-state"><h2>لا توجد مشاهد بعد</h2><p>اكتب فصول السكريبت أولًا، ثم ستظهر المشاهد هنا تلقائيًا.</p></div>;
  const scene = sel.scene;
  const def = templateById(scene.template);

  return (
    <div className="work episode-grid">
      {/* قائمة المشاهد */}
      <div className="col scenes">
        <div className="col-head">
          <h2>المشاهد</h2>
          <span className="spacer" />
          <span className="help" style={{ fontVariantNumeric: "tabular-nums" }}>{allScenes.length} مشهدًا · {fmt(totalSec)}</span>
        </div>
        {plan.chapters.map((ch) => (
          <div key={ch.number}>
            <div className="chapter-h">الفصل {ch.number} · {ch.title}</div>
            {ch.scenes.map((s) => {
              const d = templateById(s.template);
              return (
                <div key={s.id} className="scene-item" role="button" tabIndex={0} aria-selected={s.id === scene.id} onClick={() => setSelectedId(s.id)} onKeyDown={(e) => e.key === "Enter" && setSelectedId(s.id)}>
                  <span className="t">{d?.nameAr ?? s.template}</span>
                  <span style={{ display: "flex", gap: 4 }}>
                    {voiceState(s) === "ok" ? <span className="badge voice">صوت</span> : voiceState(s) === "stale" ? <span className="badge edited">صوت قديم</span> : null}
                    {s.edited ? <span className="badge edited">معدّل</span> : null}
                    {d && !d.implemented ? <span className="badge todo">قيد البناء</span> : null}
                    <span className="badge" style={{ fontVariantNumeric: "tabular-nums" }}>{sceneSeconds(s, media).toFixed(1)}ث</span>
                  </span>
                  <span className="n">{s.narration || s.props.text || s.props.reference || "بلا تعليق صوتي"}</span>
                </div>
              );
            })}
          </div>
        ))}
        <p className="help" style={{ padding: "12px 16px" }}>ترتيب المشاهد ونصوصها يأتي من السكريبت. هنا تختار الشكل: القالب والعناصر والشخصيات والخلفية والمدة.</p>
      </div>

      {/* المعاينة */}
      <div className="col center">
        <div className="toolbar">
          <div className="seg" role="group" aria-label="نطاق المعاينة">
            {([["scene", "المشهد"], ["chapter", "الفصل"], ["episode", "الحلقة كاملة"]] as const).map(([k, l]) => (
              <button key={k} aria-pressed={scope === k} onClick={() => setScope(k)}>{l}</button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="المقاس">
            <button aria-pressed={orientation === "landscape"} onClick={() => setOrientation("landscape")}>أفقي 16:9</button>
            <button aria-pressed={orientation === "portrait"} onClick={() => setOrientation("portrait")}>عمودي 9:16</button>
          </div>
          <span className="spacer" />
          <span className="help">{Object.keys(media.voice).length ? "المعاينة بالصوت الحقيقي حيث وُجد" : "المعاينة بتوقيت تقديري حتى يُولَّد الصوت"}</span>
        </div>
        <div className={`player-wrap ${orientation}`}>
          <div>
            {scope === "scene" ? (
              <ScenePreview ref={playerRef} scene={scene} themeId={plan.themeId} orientation={orientation} eyebrow={`${langPack(plan.lang).strings.chapter} ${sel.chapter.number} · ${sel.chapter.title}`} identity={identity} channel={channel} lang={plan.lang} media={media} episodeOverlays={plan.overlays} />
            ) : (
              <EpisodePreview ref={playerRef} plan={plan} orientation={orientation} chapter={scope === "chapter" ? sel.chapter.number : undefined} identity={identity} channel={channel} media={media} />
            )}
          </div>
        </div>
        <details className="render-box overlays-box" open={Boolean(plan.overlays)}>
          <summary>عناصر الشاشة في الحلقة كلها {plan.overlays ? <span className="badge edited">معدّلة</span> : null}</summary>
          <p className="help" style={{ margin: "6px 0 10px" }}>ما تختاره هنا يسري على كل مشاهد الحلقة والشورتس. «القناة» يعني الإعداد الافتراضي من تبويب «الهوية»، ويمكن تغيير أي مشهد وحده من إعداداته.</p>
          <OverlayToggles idPrefix="ep-ov" value={plan.overlays} inherited={channelOv} inheritLabel="القناة" onChange={(overlays) => { const { overlays: _o, ...rest } = plan; onPlanChange(overlays ? { ...rest, overlays } : rest); }} />
        </details>
        <IssuesBox issues={liveIssues} keys={keys} episodeId={episodeId} onSelect={setSelectedId} onReload={onReload} />
        <VoiceBox episodeId={episodeId} hasKeys={keys.voice} onMedia={onMediaChange} />
        <RenderBox episodeId={episodeId} chapter={sel.chapter.number} />
      </div>

      {/* إعدادات المشهد */}
      <div className="col side">
        <div className="col-head">
          <h2>إعدادات المشهد</h2>
          <span className="spacer" />
          <code className="help" style={{ direction: "ltr" }}>{scene.id}</code>
        </div>
        <div className="inspector">
          <label className="field">
            <span>القالب</span>
            <select
              id="scene-template"
              value={scene.template}
              onChange={(e) => {
                const t = e.target.value;
                const defs = defaultsFor(t, scene.narration, { title: plan.title, chapterTitle: sel.chapter.title });
                // نُبقي الاختيارات (عنصر، شخصية، وضعية…) لا النصوص: نص قالب قديم نادرًا ما يناسب الجديد
                const keep = Object.fromEntries(Object.entries(scene.props).filter(([k, v]) => v && templateById(t)?.fields.some((f) => f.key === k && f.type !== "text" && f.type !== "textarea")));
                updateScene({ template: t, props: { ...defs, ...keep } });
              }}
            >
              {templateDefs.map((t) => (
                <option key={t.id} value={t.id}>{t.nameAr}{t.implemented ? "" : " (قيد البناء)"}</option>
              ))}
            </select>
            {def ? <span className="help">{def.useAr}</span> : null}
          </label>

          {def?.fields.map((f) => {
            const v = scene.props[f.key] ?? "";
            if (f.type === "pose") return null;
            if (f.type === "variant")
              return (
                <div key={f.key} className="field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>الشخصية والوضعية</span>
                  <CharacterField
                    themeId={plan.themeId}
                    variant={(scene.props.variant || "narrator-m") as CharacterVariant}
                    pose={(scene.props.pose || "stand") as CharacterPose}
                    onChange={({ variant, pose }) => updateScene({ props: { ...scene.props, variant, pose } })}
                  />
                </div>
              );
            if (f.type === "element")
              return (
                <div key={f.key} className="field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{f.label}</span>
                  <ElementField themeId={plan.themeId} value={v} onChange={(id) => setProp(f.key, id)} />
                </div>
              );
            if (f.type === "select")
              return (
                <label key={f.key} className="field">
                  <span>{f.label}</span>
                  <select id={`f-${f.key}`} value={v || f.options?.[0]?.value} onChange={(e) => setProp(f.key, e.target.value)}>
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              );
            return (
              <label key={f.key} className="field">
                <span>{f.label}</span>
                {f.type === "textarea" ? (
                  <textarea id={`f-${f.key}`} rows={f.key === "text" ? 3 : 2} value={v} onChange={(e) => setProp(f.key, e.target.value)} readOnly={scene.template === "verse-card" && f.key === "text"} />
                ) : (
                  <input id={`f-${f.key}`} type="text" value={v} onChange={(e) => setProp(f.key, e.target.value)} />
                )}
                {f.help ? <span className="help">{f.help}</span> : null}
              </label>
            );
          })}

          <div className="section-t">الخلفية والمدة</div>
          <ElementField themeId={plan.themeId} kind="backdrop" value={scene.backdrop} onChange={(id) => updateScene({ backdrop: id || undefined })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="field">
              <span>المدة (ثانية)</span>
              <input
                id="scene-duration"
                type="number"
                min={1}
                step={0.5}
                placeholder={`تلقائي: ${sceneSeconds({ ...scene, durationSec: undefined }).toFixed(1)}`}
                value={scene.durationSec ?? ""}
                onChange={(e) => { const n = Number(e.target.value); updateScene({ durationSec: e.target.value && Number.isFinite(n) && n >= 0.5 ? Math.min(n, 600) : undefined }); }}
              />
            </label>
          </div>

          <div className="section-t">عناصر الشاشة في هذا المشهد</div>
          <OverlayToggles
            idPrefix="sc-ov"
            compact
            value={{ ...(scene.captions === false ? { captions: false } : {}), ...scene.overlays }}
            inherited={episodeOv}
            inheritLabel="الحلقة"
            onChange={(overlays) => updateScene({ overlays, captions: undefined })}
          />

          <div className="section-t">المؤثرات الصوتية</div>
          <div className="chips">
            {scene.sfx.length === 0 ? <span className="help">لا مؤثرات في هذا المشهد</span> : null}
            {scene.sfx.map((x, i) => {
              const s = sfxLibrary.find((y) => y.id === x.id);
              return (
                <span key={`${x.id}-${i}`} className="chip">
                  {s?.nameAr ?? x.id}
                  <input
                    type="number"
                    aria-label="التوقيت بالثواني"
                    min={0}
                    step={0.5}
                    value={x.at}
                    style={{ width: 52, padding: "0 4px", fontSize: 12 }}
                    onChange={(e) => updateScene({ sfx: scene.sfx.map((y, j) => (j === i ? { ...y, at: Number(e.target.value) } : y)) })}
                  />
                  ث
                  <button aria-label="حذف" onClick={() => updateScene({ sfx: scene.sfx.filter((_, j) => j !== i) })}>×</button>
                </span>
              );
            })}
          </div>
          <select id="add-sfx" value="" onChange={(e) => e.target.value && updateScene({ sfx: [...scene.sfx, { id: e.target.value, at: 0 }] })}>
            <option value="">+ أضف مؤثرًا…</option>
            {Object.entries(sfxCategoryNamesAr).map(([cat, name]) => (
              <optgroup key={cat} label={name}>
                {sfxLibrary.filter((s) => s.category === cat).map((s) => <option key={s.id} value={s.id}>{s.nameAr} · {s.useAr}</option>)}
              </optgroup>
            ))}
          </select>

          <div className="section-t">التعليق الصوتي</div>
          <div className="narr">{scene.narration || <span className="help">لا تعليق صوتي في هذا المشهد</span>}</div>
          {scene.narration ? <SceneVoice key={scene.id} episodeId={episodeId} sceneId={scene.id} state={voiceState(scene)} hasKeys={keys.voice} onMedia={onMediaChange} /> : null}
          <button className="btn small" onClick={() => onEditScript(scene.line)}>تعديل النص في السكريبت (سطر {scene.line})</button>
        </div>
      </div>
    </div>
  );
};

/** رندر الحلقة أو الفصل وتتبع التقدم. */
const RenderBox: React.FC<{ episodeId: string; chapter: number }> = ({ episodeId, chapter }) => {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [err, setErr] = useState("");
  const running = jobs.some((j) => j.status === "running");
  useEffect(() => {
    api.jobs().then(setJobs).catch(() => {});
  }, []);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => api.jobs().then(setJobs).catch(() => {}), 1500);
    return () => clearInterval(t);
  }, [running]);
  const start = async (orientation: Orientation, ch?: number) => {
    setErr("");
    try {
      await api.render({ episode: episodeId, orientation, chapter: ch });
      setJobs(await api.jobs());
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const mine = jobs.filter((j) => j.episode === episodeId).slice(0, 4);
  const lastDone = mine.find((j) => j.status === "done" && j.output);
  return (
    <div className="render-box">
      <div className="toolbar">
        <b>التصدير</b>
        <span className="help">يرندر من الخطة المحفوظة إلى مجلد الحلقة out/</span>
        <span className="spacer" />
        <button className="btn primary" disabled={running} onClick={() => start("landscape")}>رندر الحلقة 16:9</button>
        <button className="btn" disabled={running} onClick={() => start("portrait", chapter)}>رندر الفصل {chapter} شورت 9:16</button>
      </div>
      {err ? <div className="help" style={{ color: "var(--err)" }}>{err}</div> : null}
      {mine.map((j) => (
        <div key={j.id} className="job">
          <span style={{ minWidth: 150 }}>{j.chapter ? `الفصل ${j.chapter} · عمودي` : `الحلقة · ${j.orientation === "portrait" ? "عمودي" : "أفقي"}`}</span>
          <span className="bar"><i style={{ width: `${j.status === "done" ? 100 : j.pct}%`, background: j.status === "error" ? "var(--err)" : undefined }} /></span>
          <span style={{ minWidth: 90, fontVariantNumeric: "tabular-nums" }}>
            {j.status === "running" ? `${j.pct}%` : j.status === "done" ? "جاهز" : j.error ?? "فشل"}
          </span>
          {j.status === "done" && j.output ? <a className="btn small" href={api.videoUrl(j.episode, j.output)} target="_blank" rel="noreferrer">فتح</a> : null}
        </div>
      ))}
      {lastDone?.output ? <video src={api.videoUrl(lastDone.episode, lastDone.output)} controls style={{ width: "100%", maxHeight: 300, borderRadius: 8, background: "#000" }} /> : null}
    </div>
  );
};

/** صوت مشهد واحد: الحالة وزر التوليد. */
const SceneVoice: React.FC<{ episodeId: string; sceneId: string; state: "none" | "ok" | "stale" | "missing"; hasKeys: boolean; onMedia: (m: EpisodeMedia) => void }> = ({ episodeId, sceneId, state, hasKeys, onMedia }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const label = { ok: "صوت هذا المشهد جاهز ومطابق للنص", stale: "النص تغيّر بعد توليد الصوت", missing: "لم يُولَّد صوت لهذا المشهد بعد", none: "" }[state];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="help" style={{ color: state === "ok" ? "var(--ok)" : state === "stale" ? "var(--warn)" : undefined }}>{label}</span>
      <button
        className="btn small"
        disabled={busy || !hasKeys}
        title={hasKeys ? "" : "أضف مفتاح ElevenLabs واختر صوتك من تبويب «الإعدادات»"}
        onClick={async () => {
          setBusy(true);
          setMsg("");
          try {
            const r = await api.voice(episodeId, { scenes: [sceneId], force: state === "ok" });
            onMedia(r.media);
            setMsg(`تم (${r.report.chars} حرفًا ≈ ${r.report.credits} رصيد)`);
          } catch (e) {
            setMsg((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "جارٍ التوليد…" : state === "ok" ? "أعد توليد صوت هذا المشهد" : "ولّد صوت هذا المشهد"}
      </button>
      {!hasKeys ? <span className="help">يتطلب مفتاح ElevenLabs (تبويب «الإعدادات»)</span> : null}
      {msg ? <span className="help">{msg}</span> : null}
    </div>
  );
};

/** صوت الحلقة كلها: تقدير التكلفة أولًا، ثم التوليد بتأكيد. */
const VoiceBox: React.FC<{ episodeId: string; hasKeys: boolean; onMedia: (m: EpisodeMedia) => void }> = ({ episodeId, hasKeys, onMedia }) => {
  const [est, setEst] = useState<VoiceReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const estimate = async () => {
    setMsg("");
    try {
      setEst((await api.voice(episodeId, { dryRun: true })).report);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <div className="render-box">
      <div className="toolbar">
        <b>صوت الحلقة</b>
        <span className="help">المشاهد التي لم يتغير نصها لا يُعاد توليدها</span>
        <span className="spacer" />
        <button className="btn" onClick={estimate}>احسب التكلفة</button>
        {est && est.toGenerate.length > 0 ? (
          <button
            className="btn primary"
            disabled={busy || !hasKeys}
            onClick={async () => {
              setBusy(true);
              setMsg("");
              try {
                const r = await api.voice(episodeId, {});
                onMedia(r.media);
                setEst(r.report);
                setMsg(`وُلّد ${r.report.toGenerate.length} مقطعًا.`);
                setEst((await api.voice(episodeId, { dryRun: true })).report);
              } catch (e) {
                setMsg((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "جارٍ التوليد…" : `ولّد ${est.toGenerate.length} مقطعًا`}
          </button>
        ) : null}
      </div>
      {est ? (
        <div className="help" style={{ fontVariantNumeric: "tabular-nums" }}>
          {est.toGenerate.length === 0 ? `كل المشاهد (${est.total}) لها صوت مطابق.` : `للتوليد ${est.toGenerate.length} من ${est.total} مشهدًا: ${est.chars} حرفًا ≈ ${est.credits} رصيد ElevenLabs. المحفوظ: ${est.cached.length}.`}
          {!hasKeys ? " (أضف مفتاح ElevenLabs من تبويب «الإعدادات» لتفعيل التوليد)" : ""}
        </div>
      ) : null}
      {msg ? <div className="help">{msg}</div> : null}
    </div>
  );
};

/** ما يمنع النسخة النهائية، وجلب الآيات. */
const IssuesBox: React.FC<{ issues: PlanIssue[]; keys: { quran: boolean }; episodeId: string; onSelect: (id: string) => void; onReload: () => void }> = ({ issues, keys, episodeId, onSelect, onReload }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!issues.length) return null;
  const needsQuran = issues.some((i) => i.message.includes("bal quran"));
  return (
    <div className="render-box" style={{ borderColor: "var(--err)", background: "var(--err-soft)" }}>
      <div className="toolbar">
        <b style={{ color: "var(--err)" }}>قبل النسخة النهائية</b>
        <span className="spacer" />
        {needsQuran ? (
          <button
            className="btn small"
            disabled={busy || !keys.quran}
            title={keys.quran ? "" : "أضف مفاتيح Quran Foundation من تبويب «الإعدادات»"}
            onClick={async () => {
              setBusy(true);
              try {
                await api.quran(episodeId);
                onReload();
              } catch (e) {
                setMsg((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "جارٍ الجلب…" : "اجلب نصوص الآيات"}
          </button>
        ) : null}
      </div>
      {issues.map((i, k) => (
        <button key={k} className="issue" style={{ gridTemplateColumns: "auto 1fr" }} onClick={() => onSelect(i.sceneId)}>
          <span className="lv" style={{ background: i.level === "error" ? "var(--panel)" : "var(--warn-soft)", color: i.level === "error" ? "var(--err)" : "var(--warn)" }}>{i.level === "error" ? "يمنع" : "تنبيه"}</span>
          <span>{i.message}</span>
        </button>
      ))}
      {msg ? <div className="help">{msg}</div> : null}
    </div>
  );
};
