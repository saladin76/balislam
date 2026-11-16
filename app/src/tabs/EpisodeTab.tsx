import { OverlayToggles } from "../ui/Overlays";
import { liveAudio, mayAutoplayWithSound } from "../workspace/sceneProduction/liveAudio";
import { CLIPS, SCENES, WORDS, arabicCountAr, countAr, everyWeekday } from "../../../src/i18n/count";
const arNumE = (n: number) => n.toLocaleString("ar-EG");
import { resolveOverlays } from "../../../brand/identity/index";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import type { Plan, PlanScene } from "../../../src/plan/types";
import { templateById, templateDefs, type FieldDef } from "../../../src/plan/templates";
import { templateExclusion } from "../../../src/channel/library";
import { libraryRulesOf } from "./LibraryTab";
import { SceneSettings, TemplateSummary } from "../workspace/SceneSettings";
import { defaultsFor } from "../../../src/plan/generate";
import { sceneFrames, sceneSeconds } from "../../../src/plan/duration";
import { introFramesFor } from "../../../src/remotion/scenes/ChannelIntro";
import { inheritedToneLabel, tones, toneIds } from "../../../src/voice/tones";
import { PlanSpeedSelect } from "../ui/Pace";
import { sfxLibrary, sfxCategoryNamesAr } from "../../../brand/sfx";
import type { Identity } from "../../../brand/identity/index";
import type { CharacterPose, CharacterVariant } from "../../../characters/Character";
import { CharacterField, ElementField } from "../ui/Pickers";
import { ImageField } from "../ui/ImageField";
import { StoryboardPanel } from "./StoryboardPanel";
import { EpisodePreview, ScenePreview, type Orientation } from "../ui/Preview";
import { api, type RenderJob, type VoiceReport } from "../api";
import { NO_VOICE_KEY } from "../workspace/voiceResult";
import type { EpisodeMedia } from "../../../src/plan/media";
import { planIssues, type PlanIssue } from "../../../src/plan/validate";
import { TRANSITION_HELP } from "../../../src/plan/transitions";
import { engineEnabled } from "../../../src/plan/engine";
import type { ChannelInfo } from "../../../src/channel/types";
import { langPack } from "../../../src/i18n/packs";
import { chapterEyebrow } from "../../../src/remotion/scenes/eyebrow";
import { isSingleNarration, showsDivision } from "../../../src/script/divisions";
import { More } from "../shell/Screen";
import { KEYS_PAGE, KeysLink } from "../ui/KeysLink";
import { episodeLength } from "../../../src/plan/episodeLength";
import { duration, lengthSource, num, sceneName, seconds, verseRef } from "../ui/format";
import { OwnerText } from "../ui/OwnerText";
import { TashkeelBox } from "../workspace/TashkeelBox";

type Scope = "scene" | "chapter" | "episode";

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

export const EpisodeTab: React.FC<{
  episodeId: string;
  requestedSceneId?: string;
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
  onOpenVoice?: () => void;
  /** يُبلَّغ بالمشهد المختار في المحرر، فتعود شاشة المراجعة إليه */
  onSelectScene?: (id: string) => void;
}> = ({ episodeId, requestedSceneId, plan, identity, channel, media, issues, keys, onPlanChange, onMediaChange, onReload, onEditScript, onOpenVoice, onSelectScene }) => {
  const allScenes = useMemo(() => plan.chapters.flatMap((c) => c.scenes.map((s) => ({ scene: s, chapter: c }))), [plan]);
  const [selectedId, setSelectedId] = useState(requestedSceneId ?? allScenes[0]?.scene.id ?? "");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [scope, setScope] = useState<Scope>("scene");
  // ستوري بورد الفيديو قبل تنفيذه (يُعتمد قبل الصوت والنسخة النهائية)
  const [board, setBoard] = useState(false);
  const playerRef = useRef<PlayerRef>(null);
  const sel = allScenes.find((x) => x.scene.id === selectedId) ?? allScenes[0];

  useEffect(() => {
    if (!allScenes.some((x) => x.scene.id === selectedId) && allScenes[0]) setSelectedId(allScenes[0].scene.id);
  }, [allScenes, selectedId]);

  // عندما يختار المستخدم مشهدًا من الستوري بورد أو لوحة الملاحظات ننتقل إليه فورًا.
  useEffect(() => {
    // يُطبَّق طلب الانتقال فقط عند وصوله؛ تحديث الخطة لا يعيد اختيار مشهد قديم.
    if (requestedSceneId && allScenes.some((x) => x.scene.id === requestedSceneId)) setSelectedId(requestedSceneId);
  }, [requestedSceneId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedId && selectedId !== requestedSceneId) onSelectScene?.(selectedId);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // في معاينة الفصل أو الحلقة: أي مشهد يُعرض الآن؟ (إعدادات اللوحة الجانبية تخص المشهد المختار فقط)
  const starts = useMemo(() => {
    const list: { id: string; from: number }[] = [];
    let frame = scope === "episode" ? introFramesFor(channel, plan) : 0;
    for (const ch of plan.chapters) {
      if (scope === "chapter" && ch.number !== sel?.chapter.number) continue;
      for (const s of ch.scenes) {
        list.push({ id: s.id, from: frame });
        frame += sceneFrames(s, media);
      }
    }
    return list;
  }, [plan, media, scope, sel?.chapter.number]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const skipSeek = useRef(false);
  useEffect(() => {
    setPlayingId(null);
    if (scope === "scene") return;
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (e: { detail: { frame: number } }) => {
      let id: string | null = null;
      for (const x of starts) if (x.from <= e.detail.frame) id = x.id;
      setPlayingId(id);
    };
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("seeked", onFrame);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("seeked", onFrame);
    };
  }, [scope, starts]);
  const playing = playingId ? allScenes.findIndex((x) => x.scene.id === playingId) : -1;

  // في معاينة الفصل أو الحلقة: القفز إلى بداية المشهد المختار
  useEffect(() => {
    if (skipSeek.current) {
      skipSeek.current = false;
      return;
    }
    if (scope === "scene" || !sel) return;
    let frame = scope === "episode" ? introFramesFor(channel, plan) : 0;
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

  const liveIssues = useMemo(() => planIssues(plan, channel), [plan, channel]);
  void issues;
  // One episode length everywhere (D52).
  const length = useMemo(() => episodeLength(plan, media), [plan, media]);
  const order = useMemo(() => allScenes.map((x) => x.scene.id), [allScenes]);
  const voiceState = (s: PlanScene): "none" | "ok" | "stale" | "missing" => {
    if (!s.narration.trim()) return "none";
    const clip = media.voice[s.id];
    if (!clip) return "missing";
    return clip.text === s.narration.trim() ? "ok" : "stale";
  };

  if (!sel) return <div className="empty-state"><h2>لا توجد مشاهد بعد</h2><p>اكتب فصول السكريبت أولًا، ثم ستظهر المشاهد هنا تلقائيًا.</p></div>;
  const scene = sel.scene;
  const def = templateById(scene.template);

  const renderField = (f: FieldDef): React.ReactNode => {
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
    if (f.type === "image")
      return (
        <ImageField
          key={f.key}
          episodeId={episodeId}
          sceneId={f.key === "image" ? scene.id : `${scene.id}-${f.key.replace("image", "p")}`}
          channel={channel.id}
          value={v}
          prompt={scene.props[f.key === "image" ? "prompt" : f.key.replace("image", "prompt")] ?? ""}
          look={scene.props.look === "archive" ? "archive" : "scene"}
          media={media}
          onChange={(file) => setProp(f.key, file)}
          onMedia={onMediaChange}
        />
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
          <textarea id={`f-${f.key}`} rows={f.key === "text" || f.key === "prompt" ? 4 : 2} dir={f.key === "prompt" ? "ltr" : undefined} value={v} onChange={(e) => setProp(f.key, e.target.value)} readOnly={scene.template === "verse-card" && f.key === "text"} />
        ) : (
          <input id={`f-${f.key}`} type="text" value={v} onChange={(e) => setProp(f.key, e.target.value)} />
        )}
        {f.help ? <span className="help">{f.help}</span> : null}
      </label>
    );
  };

  if (board)
    return (
      <div className="work">
        <div className="sb-back">
          <button className="btn" onClick={() => setBoard(false)}>
            ← المشاهد
          </button>
        </div>
        <StoryboardPanel
          episodeId={episodeId}
          plan={plan}
          identity={identity}
          channel={channel}
          media={media}
          onReload={onReload}
          onEditScene={(_line, id) => {
            setSelectedId(id);
            setScope("scene");
            setBoard(false);
          }}
        />
      </div>
    );

  return (
    <div className="work episode-grid">
      {/* قائمة المشاهد */}
      <div className="col scenes">
        <div className="col-head">
          <h2>المشاهد</h2>
          <button className="btn small" onClick={() => setBoard(true)} title="لقطة لكل مشهد مع نصه وعناصره، تُعتمد قبل الصوت والنسخة النهائية">
            ستوري بورد
          </button>
          <span className="spacer" />
          <span className="help" style={{ fontVariantNumeric: "tabular-nums" }} title={lengthSource(length)}>{arabicCountAr(allScenes.length, SCENES)} — {duration(length.seconds)}</span>
        </div>
        {plan.chapters.map((ch) => (
          <div key={ch.number}>
            {showsDivision(plan.chapters, ch) ? <div className="chapter-h">الفصل {num(ch.number)}{ch.title ? ` — ${ch.title}` : ""}</div> : null}
            {ch.scenes.map((s) => {
              const d = templateById(s.template);
              return (
                <div key={s.id} className="scene-item" role="button" tabIndex={0} aria-selected={s.id === scene.id} onClick={() => setSelectedId(s.id)} onKeyDown={(e) => e.key === "Enter" && setSelectedId(s.id)}>
                  {/* dafatir QA: every row said only «مشهد خط الأفق»; the scene number comes first */}
                  <span className="t"><b className="scene-no">{sceneName(allScenes.map((x) => x.scene.id), s.id)}</b> — {d?.nameAr ?? s.template}</span>
                  <span style={{ display: "flex", gap: 4 }}>
                    {voiceState(s) === "ok" ? <span className="badge voice">صوت</span> : voiceState(s) === "stale" ? <span className="badge edited">صوت قديم</span> : null}
                    {s.edited ? <span className="badge edited">معدّل</span> : null}
                    {d && !d.implemented ? <span className="badge todo">قيد البناء</span> : null}
                    <span className="badge" style={{ fontVariantNumeric: "tabular-nums" }}>{seconds(sceneSeconds(s, media))}</span>
                  </span>
                  <span className="n">{s.narration || s.props.text || (s.props.reference ? verseRef(s.props.reference) : "") || "بلا تعليق صوتي"}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* المعاينة */}
      <div className="col center">
        <div className="toolbar">
          <div className="seg" role="group" aria-label="نطاق المعاينة">
            {/* سرد واحد بلا أقسام (D87): «الفصل» = الحلقة كاملة، فلا يُعرض */}
            {([["scene", "المشهد"], ["chapter", "الفصل"], ["episode", "الحلقة كاملة"]] as const).filter(([k]) => k !== "chapter" || !isSingleNarration(plan.chapters)).map(([k, l]) => (
              <button key={k} aria-pressed={scope === k} onClick={() => setScope(k)}>{l}</button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="المقاس">
            <button aria-pressed={orientation === "landscape"} onClick={() => setOrientation("landscape")}>أفقي ١٦:٩</button>
            <button aria-pressed={orientation === "portrait"} onClick={() => setOrientation("portrait")}>عمودي ٩:١٦</button>
          </div>
          <span className="spacer" />
          <span className="help">{Object.keys(media.voice).length ? "المعاينة بالصوت الحقيقي حيث وُجد" : "المعاينة بتوقيت تقديري حتى يُولَّد الصوت"}</span>
        </div>
        <div className={`player-wrap ${orientation}`}>
          <div>
            {scope === "scene" ? (
              <ScenePreview ref={playerRef} scene={scene} themeId={plan.themeId} orientation={orientation} eyebrow={chapterEyebrow(channel, langPack(plan.lang).strings.chapter, sel.chapter)} identity={identity} channel={channel} lang={plan.lang} media={media} episodeOverlays={plan.overlays} />
            ) : (
              <EpisodePreview ref={playerRef} plan={plan} orientation={orientation} chapter={scope === "chapter" ? sel.chapter.number : undefined} identity={identity} channel={channel} media={media} />
            )}
          </div>
        </div>
        {scope !== "scene" && playing >= 0 && playingId !== sel?.scene.id ? (
          <div className="playing-hint">
            <span>
              المعروض الآن: <b>المشهد {num(playing + 1)}</b> «{allScenes[playing]!.scene.narration.slice(0, 40)}…». أما الإعدادات في اللوحة الجانبية فهي للمشهد {num(allScenes.findIndex((x) => x.scene.id === sel?.scene.id) + 1)}.
            </span>
            <button
              className="btn small"
              onClick={() => {
                skipSeek.current = true;
                setSelectedId(playingId!);
              }}
            >
              عدّل المشهد المعروض
            </button>
          </div>
        ) : null}
        <More label="أدوات الحلقة: عناصر الشاشة، النبرة، الصوت، التصدير">
        <details className="render-box overlays-box">
          <summary>عناصر الشاشة في الحلقة كلها {plan.overlays ? <span className="badge edited">معدّلة</span> : null}</summary>
          <p className="help" style={{ margin: "6px 0 10px" }}>ما تختاره هنا يسري على كل مشاهد الحلقة والشورتس. «القناة» يعني الإعداد الافتراضي من تبويب «الهوية»، ويمكن تغيير أي مشهد وحده من إعداداته.</p>
          <OverlayToggles idPrefix="ep-ov" value={plan.overlays} inherited={channelOv} inheritLabel="القناة" onChange={(overlays) => { const { overlays: _o, ...rest } = plan; onPlanChange(overlays ? { ...rest, overlays } : rest); }} />
        </details>
        <IssuesBox issues={liveIssues} onSelect={setSelectedId} />
        <div className="render-box">
          <div className="toolbar">
            <b>نبرة الصوت في الحلقة</b>
            <span className="help">صوتك بطبقة القناة، والنبرة تلوّنه بإحساس الحلقة. نبرة الحلقة تسري على كل مشهد اختير له «مثل الحلقة» وتكفي لتوليد صوته؛ وأي مشهد يمكن أن يأخذ نبرة أخرى أو صوت شخصية من إعداداته.</span>
            <span className="spacer" />
            <select id="ep-tone" value={plan.tone ?? ""} onChange={(e) => {
              const next = e.target.value;
              const set = () => { const { tone: _t, ...rest } = plan; onPlanChange(next ? { ...rest, tone: next } : rest); };
              // D97: say before applying how many existing recordings the new tone would need generated again (nothing is generated).
              void api.toneImpact(episodeId, undefined, next || null).then((r) => {
                const n = r.sentences.length, m = r.scenes.length;
                // D136: also how many existing takes are heard with the new tone only once generated again, and the cost
                const g = r.regenerate?.ids.length ?? 0;
                if (!n && !m && !g) return set();
                const heard = g ? ` تُسمع ${g.toLocaleString("ar-EG")} جملة بالنبرة الجديدة بعد توليدها (نحو ${(r.regenerate!.credits).toLocaleString("ar-EG")} من رصيد الصوت)، وتظهر عليها «النبرة تغيّرت — اضغط ولّد لتسمع الجديد».` : "";
                const need = n || m ? `هذه النبرة تغيّر صوت تسجيلات قائمة: سيحتاج ${n ? `${n.toLocaleString("ar-EG")} جملة` : ""}${n && m ? " و" : ""}${m ? `${m.toLocaleString("ar-EG")} مشهد` : ""} توليدًا جديدًا مدفوعًا.` : "";
                if (window.confirm(`${need}${heard} لا يُولَّد شيء الآن، والتسجيلات القائمة تبقى محفوظة. أتختارها؟`.trim())) set();
              }, () => { if (window.confirm("تعذّر حساب أثر النبرة على التسجيلات القائمة. أتختارها؟")) set(); });
            }} style={{ width: 260 }}>
              <option value="">{channel.tone && channel.tone in tones ? `نبرة القناة (${tones[channel.tone as keyof typeof tones].nameAr})` : `بلا نبرة للحلقة (يلزم اختيار نبرة كل مشهد)`}</option>
              {toneIds.map((t) => <option key={t} value={t}>{tones[t].nameAr}: {tones[t].useAr}</option>)}
            </select>
            <PlanSpeedSelect id="ep-speed" episodeId={episodeId} />
          </div>
        </div>
        {onOpenVoice ? (
          <div className="render-box ew-voice-link">
            <span>توليد صوت الحلقة وتقرير التشكيل والمقاطع في مرحلة الصوت.</span>
            <button className="btn" type="button" onClick={onOpenVoice}>افتح مرحلة الصوت</button>
          </div>
        ) : <VoiceBox episodeId={episodeId} hasKeys={keys.voice} onMedia={onMediaChange} />}
        <RenderBox episodeId={episodeId} chapter={isSingleNarration(plan.chapters) ? undefined : sel.chapter.number} />
        </More>
      </div>

      {/* إعدادات المشهد */}
      <div className="col side">
        <div className="col-head">
          <h2 title={scene.id}>إعدادات {sceneName(order, scene.id)}</h2>
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
              {/* Only the channel's own library (src/channel/library.ts): another channel's designed-shot
                  templates are not offered (QA minor, 10 Nov); the scene's current template always stays listed. */}
              {templateDefs.filter((t) => t.id === scene.template || !templateExclusion(libraryRulesOf(channel), t.id)).map((t) => (
                <option key={t.id} value={t.id}>{t.nameAr}{t.implemented ? "" : " (قيد البناء)"}</option>
              ))}
            </select>
            {def ? <TemplateSummary def={def} /> : null}
          </label>

          {def ? (
            <SceneSettings
              def={def}
              scene={scene}
              plan={plan}
              identity={identity}
              channel={channel}
              media={media}
              eyebrow={chapterEyebrow(channel, langPack(plan.lang).strings.chapter, sel.chapter)}
              closing={order[order.length - 1] === scene.id}
              onProps={(p) => updateScene({ props: p })}
              onConfirm={() => updateScene({})}
              renderField={renderField}
            />
          ) : null}

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
            {engineEnabled("transitions", channel.id) || scene.transition ? (
            <label className="field">
              <span>الدخول من المشهد السابق</span>
              <input
                id="scene-transition"
                type="text"
                dir="ltr"
                placeholder="كما هو (تلاشٍ قصير)"
                value={scene.transition ?? ""}
                onChange={(e) => updateScene({ transition: e.target.value.trim() ? e.target.value : undefined })}
              />
            </label>
            ) : null}
          </div>
          {(engineEnabled("transitions", channel.id) || scene.transition) && (() => {
            const errs = liveIssues.filter((i) => i.sceneId === scene.id && /الانتقال/.test(i.message));
            return (
              <div className="help" style={{ marginTop: -4 }}>
                {errs.length ? errs.map((i, k) => <div key={k} style={{ color: i.level === "error" ? "var(--danger, #C2412D)" : undefined }}>{i.message}</div>) : TRANSITION_HELP}
              </div>
            );
          })()}

          <details className="ew-advanced-settings">
            <summary>إعدادات متقدمة — عناصر الشاشة والمؤثرات الصوتية</summary>
            <div className="ew-advanced-body">
          <div className="section-t">عناصر الشاشة في هذا المشهد</div>
          <OverlayToggles
            idPrefix="sc-ov"
            compact
            value={{ ...(scene.captions === false ? { captions: false } : {}), ...scene.overlays }}
            inherited={episodeOv}
            inheritLabel="الحلقة"
            onChange={(overlays) => updateScene({ overlays, captions: undefined })}
          />
          {(() => {
            const own = { ...(scene.captions === false ? { captions: false } : {}), ...scene.overlays };
            if (!Object.keys(own).length) return <div className="help">هذه الأزرار لهذا المشهد فقط. للحلقة كلها استعمل «عناصر الشاشة في الحلقة كلها» تحت المعاينة.</div>;
            return (
              <button
                className="btn small"
                style={{ marginTop: 8 }}
                title="ينقل اختيارات هذا المشهد إلى الحلقة كلها، ويعيد كل المشاهد لتتبع الحلقة"
                onClick={() => {
                  if (!window.confirm("تطبيق اختيارات هذا المشهد (إظهار/إخفاء) على كل مشاهد الحلقة؟ ستُلغى الاختيارات الخاصة بالمشاهد الأخرى لهذه العناصر.")) return;
                  const keys = Object.keys(own) as (keyof typeof own)[];
                  onPlanChange({
                    ...plan,
                    overlays: { ...plan.overlays, ...own },
                    chapters: plan.chapters.map((c) => ({
                      ...c,
                      scenes: c.scenes.map((sc) => {
                        const rest = { ...sc.overlays };
                        for (const k of keys) delete (rest as Record<string, unknown>)[k];
                        const { overlays: _o, captions: cap, ...base } = sc;
                        return { ...base, ...(keys.includes("captions") || cap === undefined ? {} : { captions: cap }), ...(Object.keys(rest).length ? { overlays: rest } : {}) };
                      }),
                    })),
                  });
                }}
              >
                طبّق هذا على الحلقة كلها
              </button>
            );
          })()}

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
                {sfxLibrary.filter((s) => s.category === cat).map((s) => <option key={s.id} value={s.id}>{s.nameAr} — {s.useAr}</option>)}
              </optgroup>
            ))}
          </select>

            </div>
          </details>

          <div className="section-t">التعليق الصوتي</div>
          <div className="narr">{scene.narration || <span className="help">لا تعليق صوتي في هذا المشهد</span>}</div>
          {scene.narration ? (
            <div className="row2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "8px 0" }}>
              <label className="field">
                <span>النبرة</span>
                <select id="sc-tone" value={scene.tone ?? ""} onChange={(e) => updateScene({ tone: e.target.value || undefined })}>
                  <option value="">{inheritedToneLabel(plan.tone, channel.tone)}</option>
                  {toneIds.map((t) => <option key={t} value={t}>{tones[t].nameAr}</option>)}
                </select>
              </label>
              <label className="field">
                <span>السرعة</span>
                <PlanSpeedSelect id="sc-speed" episodeId={episodeId} sceneId={scene.id} />
              </label>
              <label className="field">
                <span>الصوت</span>
                <select id="sc-voice" value={scene.voice ?? ""} onChange={(e) => updateScene({ voice: e.target.value || undefined })}>
                  <option value="">صوت القناة (الراوي)</option>
                  {(channel.cast ?? []).map((v) => <option key={v.id} value={v.id}>{v.role ? `${v.role}: ` : ""}{v.name}</option>)}
                </select>
              </label>
              {!(channel.cast ?? []).length ? <span className="help" style={{ gridColumn: "1 / -1" }}>لأصوات الشخصيات: أضفها من تبويب «القناة» ← «أصوات الشخصيات».</span> : null}
            </div>
          ) : null}
          {scene.narration ? <SceneVoice key={scene.id} episodeId={episodeId} sceneId={scene.id} state={voiceState(scene)} hasKeys={keys.voice} onMedia={onMediaChange} /> : null}
          <button className="btn small" onClick={() => onEditScript(scene.line)}>تعديل النص في السكريبت (سطر {scene.line})</button>
        </div>
      </div>
    </div>
  );
};

/** معاينة حية صامتة لمشهد واحد (تُعرض في شاشة المراجعة قبل وجود معاينة بالصوت والصورة). */
export const SceneLivePreview: React.FC<{ sceneId: string; plan: Plan; identity: Identity; channel: ChannelInfo; media: EpisodeMedia }> = ({ sceneId, plan, identity, channel, media }) => {
  const hit = plan.chapters.flatMap((c) => c.scenes.map((s) => ({ s, c }))).find((x) => x.s.id === sceneId);
  if (!hit) return null;
  // D131: silent until the scene's sound exists (then it plays WITH it, never left muted); a new clip remounts the player
  const la = liveAudio(hit.s, media);
  return <ScenePreview key={la.key} scene={hit.s} themeId={plan.themeId} orientation="landscape" eyebrow={chapterEyebrow(channel, langPack(plan.lang).strings.chapter, hit.c)} identity={identity} channel={channel} lang={plan.lang} media={media} episodeOverlays={plan.overlays}
    muted={!la.audible} autoPlay={la.audible ? mayAutoplayWithSound() : true} />;
};

/** رندر الحلقة أو الفصل وتتبع التقدم. */
const RenderBox: React.FC<{ episodeId: string; chapter?: number }> = ({ episodeId, chapter }) => {
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
        <button className="btn" disabled={running} onClick={() => start("landscape")}>رندر الحلقة ١٦:٩</button>
        {chapter !== undefined ? <button className="btn" disabled={running} onClick={() => start("portrait", chapter)}>رندر الفصل {arNumE(chapter)} شورت ٩:١٦</button> : null}
      </div>
      {err ? <div className="help" style={{ color: "var(--err)" }}><OwnerText text={err} /></div> : null}
      {mine.map((j) => (
        <div key={j.id} className="job">
          <span style={{ minWidth: 150 }}>{j.chapter ? `الفصل ${j.chapter} — عمودي` : `الحلقة — ${j.orientation === "portrait" ? "عمودي" : "أفقي"}`}</span>
          <span className="bar"><i style={{ width: `${j.status === "done" ? 100 : j.pct}%`, background: j.status === "error" ? "var(--err)" : undefined }} /></span>
          <span style={{ minWidth: 90, fontVariantNumeric: "tabular-nums" }}>
            {j.status === "running" ? (j.queued ? "في الطابور" : `${j.pct}%`) : j.status === "done" ? "جاهز" : <OwnerText text={j.error ?? "فشل"} />}
          </span>
          {j.status === "done" && j.output ? <a className="btn small" href={api.videoUrl(j.episode, j.output)} target="_blank" rel="noreferrer">فتح</a> : null}
          {j.status === "running" ? <button className="btn ghost small" onClick={() => void api.cancelJob(j.id).catch((x) => setErr((x as Error).message))}>إلغاء</button> : null}
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
        title={hasKeys ? "" : `أضف مفتاح الصوت واختر صوتك من «${KEYS_PAGE}»`}
        onClick={async () => {
          setBusy(true);
          setMsg("");
          try {
            const r = await api.voice(episodeId, { scenes: [sceneId], force: state === "ok" });
            onMedia(r.media);
            setMsg(r.noKey || (!r.generated && !r.sentences) ? NO_VOICE_KEY : r.report ? `تم (${r.report.chars} حرفًا ≈ ${r.report.credits} رصيد)` : `أُعيد توليد جمل المشهد (${r.sentences?.generated ?? 0}).`);
          } catch (e) {
            setMsg((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "جارٍ التوليد…" : state === "ok" ? "أعد توليد صوت هذا المشهد" : "ولّد صوت هذا المشهد"}
      </button>
      {!hasKeys ? <span className="help">يتطلب مفتاح الصوت من <KeysLink /></span> : null}
      {msg ? <span className="help"><OwnerText text={msg} /></span> : null}
    </div>
  );
};

/** صوت الحلقة كلها: تقدير التكلفة أولًا، ثم التوليد بتأكيد. */
export const VoiceBox: React.FC<{ episodeId: string; hasKeys: boolean; onMedia: (m: EpisodeMedia) => void; /** scene order, to name scenes «المشهد ٣» */ order?: string[] }> = ({ episodeId, hasKeys, onMedia, order = [] }) => {
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
  // التقدير والتشكيل بلا تكلفة: يظهران مع فتح الحلقة
  useEffect(() => {
    setEst(null);
    void estimate();
  }, [episodeId]);
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
            disabled={busy || !hasKeys || est.tashkeel?.ok === false}
            title={est.tashkeel?.ok === false ? "أكمل التشكيل أولًا" : ""}
            onClick={async () => {
              setBusy(true);
              setMsg("");
              try {
                const r = await api.voice(episodeId, {});
                onMedia(r.media);
                if (r.report) setEst(r.report);
                setMsg(r.noKey || !r.generated ? NO_VOICE_KEY : `وُلّدت المقاطع (${countAr(r.report?.toGenerate.length ?? 0, CLIPS)}).`);
                setEst((await api.voice(episodeId, { dryRun: true })).report);
              } catch (e) {
                setMsg((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "جارٍ التوليد…" : `ولّد المقاطع (${arNumE(est.toGenerate.length)})`}
          </button>
        ) : null}
      </div>
      {est ? (
        <div className="help" style={{ fontVariantNumeric: "tabular-nums" }}>
          {/* QA 12 Nov (dafatir M10): this tool counts the whole-scene clips only; scenes voiced sentence by sentence are counted in «الجمل» */}
          {est.toGenerate.length === 0 ? `لا مقطع يحتاج توليدًا بهذه الأداة (المحفوظة: ${arNumE(est.total)}).` : `المقاطع للتوليد: ${arNumE(est.toGenerate.length)} من ${arNumE(est.total)} — الحروف: ${arNumE(est.chars)} ≈ ${arNumE(est.credits)} من رصيد الصوت. المحفوظة: ${arNumE(est.cached.length)}.`}
          {managedOf(est) ? ` المشاهد المسجّلة جملةً جملة (${countAr(managedOf(est), SCENES)}) تُفحص وتُولَّد في «الجمل» تحت كل مشهد، ولا تدخل هذا العدّ ولا نسبة التشكيل أدناه.` : ""}
          {!hasKeys ? <> (أضف مفتاح الصوت من <KeysLink /> لتفعيل التوليد)</> : ""}
        </div>
      ) : null}
      {est?.tashkeel ? <TashkeelBox t={est.tashkeel} order={order} /> : null}
      {msg ? <div className="help"><OwnerText text={msg} /></div> : null}
    </div>
  );
};

/** Scenes voiced sentence by sentence, which the whole-scene voice tool does not count (generate.ts `skipped`). */
const managedOf = (est: VoiceReport | null): number => (est?.tashkeel as unknown as { skipped?: { managedScenes?: number } } | undefined)?.skipped?.managedScenes ?? 0;
/** ملاحظات تتطلب معالجة داخل السكريبت أو مراجعة المصدر، دون جلب آيات تلقائيًا. */
const IssuesBox: React.FC<{ issues: PlanIssue[]; onSelect: (id: string) => void }> = ({ issues, onSelect }) => {
  if (!issues.length) return null;
  return (
    <div className="render-box" style={{ borderColor: "var(--err)", background: "var(--err-soft)" }}>
      <div className="toolbar"><b style={{ color: "var(--err)" }}>قبل النسخة النهائية</b></div>
      {issues.map((issue, index) => (
        <button key={index} className="issue" style={{ gridTemplateColumns: "auto 1fr" }} onClick={() => onSelect(issue.sceneId)}>
          <span className="lv" style={{ background: issue.level === "error" ? "var(--panel)" : "var(--warn-soft)", color: issue.level === "error" ? "var(--err)" : "var(--warn)" }}>{issue.level === "error" ? "يمنع" : "تنبيه"}</span>
          <span>{issue.message}</span>
        </button>
      ))}
    </div>
  );
};
