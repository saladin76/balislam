import React, { useEffect, useMemo, useRef, useState } from "react";
import { Thumbnail, type PlayerRef } from "@remotion/player";
import type { Plan, PlanScene } from "../../../src/plan/types";
import type { FieldDef, TemplateDef } from "../../../src/plan/templates";
import type { Identity } from "../../../brand/identity/index";
import type { ChannelInfo } from "../../../src/channel/types";
import type { EpisodeMedia } from "../../../src/plan/media";
import { sceneFrames } from "../../../src/plan/duration";
import { boardWords, shotFrame } from "../../../src/plan/storyboardView";
import { wordStartFrames } from "../../../src/plan/wordClock";
import {
  anchorFor, displayWord, eventLines, joinPhrases, parsePhrases, phraseFrom, phraseSpoken, resolveAnchor, sentenceTokens, setEventLine,
  shotCardText, shotField, shotUiOf, slotRows, slotState, visibleFields, writeSlot, type SlotRow, type Token,
} from "../../../src/plan/sceneSlots";
import { SceneComp, ScenePreview } from "../ui/Preview";
import { arDigits, num } from "../ui/format";
import config from "../../../config.json";
import "./sceneSettings.css";

/**
 * «إعدادات المشهد» للمالك (D56): ما يظهر هو ما يستعمله المشهد المختار فقط، والمشهد يُختار من بطاقات بصورته،
 * ولحظة ظهور كل عنصر تُحدد بالنقر على كلمتها في الجملة، والعبارات تُختار من الجملة نفسها.
 * كله من تصريحات القالب (src/plan/templates.ts وsrc/plan/sceneSlots.ts)، بلا فرع بالقناة، والتخزين كما كان.
 */
type Props = {
  def: TemplateDef;
  scene: PlanScene;
  plan: Plan;
  identity: Identity;
  channel: ChannelInfo;
  media: EpisodeMedia;
  eyebrow: string;
  /** آخر مشهد في الحلقة */
  closing: boolean;
  onProps: (props: Record<string, string>) => void;
  /** المالك يؤكد أن المشهد المختار آليًا يطابق الجملة (تعديل يدوي يعتمده) */
  onConfirm: () => void;
  renderField: (f: FieldDef) => React.ReactNode;
};

type Target = { kind: "slot"; key: string } | { kind: "phrase"; a?: number; b?: number } | { kind: "event"; meaning: string; idx: number | null } | null;

const fps = config.video.fps;
const AR = (n: number) => num(n);

export const SceneSettings: React.FC<Props> = ({ def, scene, plan, identity, channel, media, eyebrow, closing, onProps, onConfirm, renderField }) => {
  const props = scene.props as Record<string, string>;
  const { shown, other } = useMemo(() => visibleFields(def, props, { closing }), [def, props, closing]);
  const picker = shotField(def);
  const tokens = useMemo(() => sentenceTokens(scene.narration ?? ""), [scene.narration]);
  const rows = useMemo(() => slotRows(def, props, shown), [def, props, shown]);
  const phraseField = shown.find((f) => f.ui === "phrases");
  const phraseSpec = phraseField ? shotUiOf(def, picker ? props[picker.key] : undefined).phrases : undefined;
  const eventField = shown.find((f) => f.ui === "events");
  const hasSentence = tokens.length > 0 && (rows.length > 0 || Boolean(phraseSpec) || Boolean(eventField));
  // بلا جملة (مشهد صامت) تبقى الحقول بصورتها العادية
  const special = (f: FieldDef) => f.ui === "shot" || (hasSentence && (f.ui === "anchor" || f.ui === "anchor-lines" || (f.ui === "phrases" && Boolean(phraseSpec)) || f.ui === "events"));

  return (
    <>
      {picker ? <ShotPicker def={def} field={picker} scene={scene} plan={plan} identity={identity} channel={channel} media={media} eyebrow={eyebrow} onPick={(v) => onProps({ ...props, [picker.key]: v })} onConfirm={onConfirm} /> : null}
      {shown.filter((f) => !special(f) && !f.common).map((f) => <React.Fragment key={f.key}>{renderField(f)}</React.Fragment>)}
      {hasSentence ? (
        <SentenceCard
          key={scene.id}
          scene={scene} plan={plan} identity={identity} channel={channel} media={media} eyebrow={eyebrow}
          tokens={tokens} rows={rows} props={props} onProps={onProps}
          phraseField={phraseSpec ? phraseField : undefined} phraseSpec={phraseSpec} eventField={eventField}
        />
      ) : null}
      {shown.filter((f) => !special(f) && f.common).map((f) => <React.Fragment key={f.key}>{renderField(f)}</React.Fragment>)}
      {other.length ? (
        <details className="ss-more">
          <summary>المزيد · حقول لا يستعملها هذا المشهد ({AR(other.length)})</summary>
          <p className="ss-hint">تبقى قيمها محفوظة كما هي، ولا يقرؤها المشهد المختار.</p>
          {other.map((f) => <React.Fragment key={f.key}>{renderField(f)}</React.Fragment>)}
        </details>
      ) : null}
    </>
  );
};

/** سطر واحد بالعربية السهلة، والوصف الكامل تحت «المزيد» */
export const TemplateSummary: React.FC<{ def: TemplateDef }> = ({ def }) => {
  // بلا سطر معلن: أول جملة من الوصف قبل أي قوس أو نقطتين
  const line = def.summaryAr ?? def.useAr.split(/[:(]/)[0]!.replace(/[،\s]+$/, "").trim();
  const more = def.summaryAr ? def.useAr : def.useAr.length > line.length + 2 ? def.useAr : "";
  return (
    <div className="ss-summary">
      <span>{line}</span>
      {more ? (
        <details>
          <summary>المزيد</summary>
          <p>{more}</p>
        </details>
      ) : null}
    </div>
  );
};

// ── بطاقات المشاهد ────────────────────────────────────────────────────────

class Boundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch() { /* بطاقة بلا صورة تكفي */ }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

/** صورة المشهد بالرسام نفسه الذي يرسم لوحات الستوري بورد؛ تُرسم حين تظهر البطاقة فقط */
const ShotThumb: React.FC<{ scene: PlanScene; plan: Plan; identity: Identity; channel: ChannelInfo; media: EpisodeMedia; eyebrow: string }> = ({ scene, plan, identity, channel, media, eyebrow }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  const d = sceneFrames(scene, media);
  const blank = <div className="ss-thumb-blank" aria-hidden />;
  return (
    <div ref={ref} className="ss-thumb">
      {seen ? (
        <Boundary fallback={blank}>
          <Thumbnail
            component={SceneComp}
            inputProps={{ scene, themeId: plan.themeId, orientation: "landscape", eyebrow, identity, channel, lang: plan.lang, media, episodeOverlays: plan.overlays }}
            compositionWidth={config.video.episode.width}
            compositionHeight={config.video.episode.height}
            durationInFrames={d}
            frameToDisplay={shotFrame(scene, d, boardWords(scene, media), fps)}
            fps={fps}
            style={{ width: "100%" }}
            errorFallback={() => blank}
          />
        </Boundary>
      ) : blank}
    </div>
  );
};

const ShotPicker: React.FC<{ def: TemplateDef; field: FieldDef; scene: PlanScene; plan: Plan; identity: Identity; channel: ChannelInfo; media: EpisodeMedia; eyebrow: string; onPick: (v: string) => void; onConfirm: () => void }> = ({ def, field, scene, plan, identity, channel, media, eyebrow, onPick, onConfirm }) => {
  const [open, setOpen] = useState(false);
  const [others, setOthers] = useState(false);
  const current = String(scene.props[field.key] ?? "");
  const options = field.options ?? [];
  const used = useMemo(() => {
    const m = new Map<string, PlanScene>();
    for (const c of plan.chapters) for (const s of c.scenes) if (s.template === scene.template && s.props[field.key] && !m.has(s.props[field.key]!)) m.set(s.props[field.key]!, s);
    return m;
  }, [plan, scene.template, field.key]);
  /** المشهد الذي تُرسم منه صورة البطاقة: مشهد في الحلقة يستعمله، وإلا هذا المشهد به */
  const sample = (v: string): PlanScene => (v === current ? scene : used.get(v) ?? { ...scene, props: { ...scene.props, [field.key]: v } });
  const card = (v: string, big = false) => {
    const o = options.find((x) => x.value === v);
    const ui = shotUiOf(def, v);
    const { title, line } = v ? shotCardText(o?.label ?? v, ui) : { title: "بلا مشهد مصمَّم", line: "إخراج عام من معنى الكلام" };
    const on = v === current;
    return (
      <button
        key={v || "none"}
        type="button"
        className={`ss-card${big ? " big" : ""}`}
        aria-pressed={on}
        title={v ? `${o?.label ?? v} · ${v}` : undefined}
        onClick={() => { if (!on) onPick(v); setOpen(false); }}
      >
        {v ? <ShotThumb scene={sample(v)} plan={plan} identity={identity} channel={channel} media={media} eyebrow={eyebrow} /> : <div className="ss-thumb ss-thumb-none" aria-hidden />}
        <span className="ss-card-t">{title}</span>
        {line ? <span className="ss-card-l">{line}</span> : null}
        <span className="ss-badges">
          {on && !scene.edited && v ? <span className="ss-badge auto">اختير آليًا</span> : null}
          {ui.library ? <span className="ss-badge">من مكتبة القناة</span> : null}
        </span>
      </button>
    );
  };
  const values = options.map((o) => o.value);
  const here = values.filter((v) => v && used.has(v));
  const lib = values.filter((v) => (!v || shotUiOf(def, v).library) && !used.has(v));
  const rest = values.filter((v) => v && !used.has(v) && !shotUiOf(def, v).library);
  return (
    <section className="ss-sec" aria-label={field.label}>
      <div className="ss-head">
        <h3>المشهد</h3>
        <button type="button" className="btn small" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "إغلاق" : "غيّر المشهد"}</button>
      </div>
      {card(current, true)}
      {current && !scene.edited ? (
        <div className="ss-auto">
          <span>اختاره النظام. شاهده وتأكد أنه يطابق معنى الجملة.</span>
          <button type="button" className="btn small" onClick={onConfirm} title="أي تعديل يدوي للمشهد يعتمد اختياره">يطابق الجملة</button>
        </div>
      ) : null}
      {open ? (
        <div className="ss-picker">
          {here.length ? <><h4>مشاهد هذه الحلقة</h4><div className="ss-grid">{here.map((v) => card(v))}</div></> : null}
          {lib.length ? <><h4>مكتبة القناة</h4><div className="ss-grid">{lib.map((v) => card(v))}</div></> : null}
          {rest.length ? (
            <details className="ss-more" onToggle={(e) => setOthers((e.target as HTMLDetailsElement).open)}>
              <summary>مشاهد صُممت لحلقات أخرى ({AR(rest.length)})</summary>
              {others ? <div className="ss-grid">{rest.map((v) => card(v))}</div> : null}
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

// ── الجملة: العبارات ولحظات الظهور والأحداث ───────────────────────────────

const SentenceCard: React.FC<{
  scene: PlanScene; plan: Plan; identity: Identity; channel: ChannelInfo; media: EpisodeMedia; eyebrow: string;
  tokens: Token[]; rows: SlotRow[]; props: Record<string, string>; onProps: (p: Record<string, string>) => void;
  phraseField?: FieldDef; phraseSpec?: NonNullable<ReturnType<typeof shotUiOf>["phrases"]>; eventField?: FieldDef;
}> = ({ scene, plan, identity, channel, media, eyebrow, tokens, rows, props, onProps, phraseField, phraseSpec, eventField }) => {
  const [target, setTarget] = useState<Target>(null);
  const [note, setNote] = useState("");
  const player = useRef<PlayerRef>(null);
  const stopAt = useRef<number | undefined>(undefined);
  const dur = sceneFrames(scene, media);
  const starts = useMemo(() => wordStartFrames(scene, media, dur, fps), [scene, media, dur]);
  useEffect(() => () => window.clearTimeout(stopAt.current), []);
  // المعاينة الصغيرة تبدأ على اللحظة نفسها التي تعرضها لوحة الستوري بورد، لا على ورقة فارغة
  useEffect(() => {
    const t = window.setTimeout(() => player.current?.seekTo(shotFrame(scene, dur, boardWords(scene, media), fps)), 60);
    return () => window.clearTimeout(t);
  }, [scene.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const seek = (i: number) => {
    const p = player.current;
    const f = starts[i];
    if (!p || f === undefined) return;
    p.seekTo(Math.max(0, Math.min(dur - 1, f - 6)));
    p.play();
    window.clearTimeout(stopAt.current);
    stopAt.current = window.setTimeout(() => player.current?.pause(), 2600);
  };

  const states = useMemo(() => rows.map((r) => slotState(tokens, r)), [rows, tokens]);
  const main = rows.filter((r) => !r.key.endsWith(".end"));
  const numOf = (key: string) => main.findIndex((r) => r.key === key.replace(/\.end$/, "")) + 1;

  const phrases = phraseField ? parsePhrases(props[phraseField.key]) : [];
  const events = eventField ? eventLines(props[eventField.key]) : [];
  const meaningName = (k: string) => eventField?.options?.find((o) => o.value === k)?.label ?? k;

  /** علامات كل كلمة: أرقام لحظاتها، وهل هي في عبارة، وهل هي حدث */
  const marks = useMemo(() => {
    const m = new Map<number, { slots: { n: number; key: string; auto: boolean; end: boolean }[]; event: boolean }>();
    const get = (i: number) => m.get(i) ?? (m.set(i, { slots: [], event: false }), m.get(i)!);
    rows.forEach((r, k) => { const s = states[k]!; if (s.at >= 0) get(s.at).slots.push({ n: numOf(r.key), key: r.key, auto: s.auto, end: r.key.endsWith(".end") }); });
    if (eventField) for (const e of events) { const at = resolveAnchor(tokens, e.value, eventField.match ?? "first"); if (at >= 0) get(at).event = true; }
    return m;
  }, [rows, states, events, tokens, eventField]); // eslint-disable-line react-hooks/exhaustive-deps
  const inPhrase = useMemo(() => {
    const set = new Set<number>();
    for (const ph of phrases) {
      const w = ph.split(/\s+/).length;
      for (let i = 0; i + w <= tokens.length; i++) if (phraseSpoken(tokens.slice(i, i + w).map((t) => t.raw).join(" "), ph)) { for (let k = i; k < i + w; k++) set.add(k); break; }
    }
    return set;
  }, [phrases, tokens]);

  const activeRow = target?.kind === "slot" ? rows.find((r) => r.key === target.key) : undefined;

  const clickWord = (i: number) => {
    setNote("");
    if (target?.kind === "phrase") {
      if (target.a === undefined || target.b !== undefined) setTarget({ kind: "phrase", a: i });
      else setTarget({ kind: "phrase", a: target.a, b: i });
      return;
    }
    if (target?.kind === "event" && eventField) {
      const word = anchorFor(tokens, i, eventField.match ?? "first");
      onProps({ ...props, [eventField.key]: setEventLine(props[eventField.key], target.idx, target.meaning, word) });
      if (resolveAnchor(tokens, word, eventField.match ?? "first") !== i) setNote(`يقع الحدث عند أول نطق للكلمة «${displayWord(tokens[i]!.raw)}».`);
      setTarget(null);
      seek(i);
      return;
    }
    if (activeRow) {
      const end = activeRow.key.endsWith(".end") && activeRow.match === "ink";
      const value = anchorFor(tokens, i, activeRow.match, end, activeRow.nth);
      onProps(writeSlot(props, activeRow, value) as Record<string, string>);
      if (resolveAnchor(tokens, value, activeRow.match, end, activeRow.nth) !== i) setNote(`يقع «${activeRow.label}» عند أول نطق للكلمة «${displayWord(tokens[i]!.raw)}».`);
      seek(i);
      // ننتقل إلى أول لحظة لم تُحدد بعد، لتتابع النقر على الجملة
      const next = main.find((r, k) => r.key !== activeRow.key && !r.value && states[rows.indexOf(r)]!.at < 0 && k >= 0);
      setTarget(next ? { kind: "slot", key: next.key } : null);
      return;
    }
    const mk = marks.get(i);
    if (mk?.slots.length) setTarget({ kind: "slot", key: mk.slots[0]!.key });
    seek(i);
  };

  const hint =
    target?.kind === "phrase"
      ? target.a === undefined ? "انقر أول كلمة في العبارة." : target.b === undefined ? "انقر آخر كلمة في العبارة (أو الكلمة نفسها لعبارة من كلمة واحدة)." : "راجع العبارة ثم أضفها."
      : target?.kind === "event" ? `انقر الكلمة التي يقع عندها «${meaningName(target.meaning)}».`
      : activeRow ? `انقر الكلمة التي ${activeRow.key.endsWith(".end") ? "تنتهي عندها كتابة" : "يظهر عندها"} «${activeRow.label.replace(/^نهاية /, "")}».`
      : rows.length ? "اختر لحظة من القائمة، ثم انقر كلمتها في الجملة." : "انقر كلمة لترى المشهد عندها.";

  const pa = target?.kind === "phrase" ? target.a : undefined;
  const pb = target?.kind === "phrase" ? target.b : undefined;
  const pick = pa !== undefined ? phraseFrom(tokens, pa, pb ?? pa) : "";
  const inRange = (i: number) => pa !== undefined && i >= Math.min(pa, pb ?? pa) && i <= Math.max(pa, pb ?? pa);

  const addPhrase = () => {
    if (!phraseField || !pick) return;
    onProps({ ...props, [phraseField.key]: joinPhrases([...phrases, pick]) });
    setTarget(null);
  };
  const removePhrase = (k: number) => phraseField && onProps({ ...props, [phraseField.key]: joinPhrases(phrases.filter((_, j) => j !== k)) });

  return (
    <section className="ss-sec ss-sentence" aria-label="الجملة">
      <div className="ss-head"><h3>الجملة</h3></div>
      <div className="ss-mini-wrap"><ScenePreview ref={player} className="ss-mini" scene={scene} themeId={plan.themeId} orientation="landscape" eyebrow={eyebrow} identity={identity} channel={channel} lang={plan.lang} media={media} episodeOverlays={plan.overlays} muted autoPlay={false} /></div>
      <p className={`ss-hint${target ? " on" : ""}`} role="status">{hint}</p>
      <div className="ss-words" dir="rtl">
        {tokens.map((t) => {
          const mk = marks.get(t.i);
          const active = Boolean(activeRow && mk?.slots.some((s) => s.key === activeRow.key));
          // الأرقام لبدايات الظهور وحدها (نهاية الكتابة تظهر حين يُختار صفها)، بلا تكرار
          const pins = [...new Map((mk?.slots ?? []).filter((s) => !s.end).map((s) => [s.n, s])).values()];
          return (
            <button
              key={t.i}
              type="button"
              className={`ss-word${pins.length ? " anchored" : ""}${pins.length && pins.every((s) => s.auto) ? " auto" : ""}${active ? " active" : ""}${inRange(t.i) ? " range" : ""}${inPhrase.has(t.i) ? " phrase" : ""}${mk?.event ? " event" : ""}`}
              onClick={() => clickWord(t.i)}
              title={mk?.slots.length ? mk.slots.map((s) => rows.find((r) => r.key === s.key)?.label).join("، ") : undefined}
            >
              {displayWord(t.raw)}
              {pins.length ? <span className="ss-pins" aria-hidden>{pins.map((s) => <i key={s.key} className={s.auto ? "auto" : ""}>{arDigits(s.n)}</i>)}</span> : null}
            </button>
          );
        })}
      </div>
      {note ? <p className="ss-note" role="status">{note}</p> : null}

      {phraseField && phraseSpec ? (
        <div className="ss-block">
          <h4 title={phraseField.key}>{phraseField.label}</h4>
          {phrases.length ? (
            <ol className="ss-phrases">
              {phrases.map((ph, k) => {
                const ok = phraseSpoken(scene.narration, ph);
                return (
                  <li key={`${k}-${ph}`}>
                    <span className="ss-role">{phraseSpec.name(k, phrases.length)}</span>
                    <span className={`ss-chip${ok ? "" : " bad"}`}>{ph}</span>
                    <button type="button" className="ss-x" aria-label={`احذف «${ph}»`} onClick={() => removePhrase(k)}>×</button>
                    {!ok ? <span className="ss-warn">ليست منطوقة حرفيًا في الجملة</span> : null}
                  </li>
                );
              })}
            </ol>
          ) : <p className="ss-hint">لا عبارات بعد.</p>}
          {target?.kind === "phrase" ? (
            <div className="ss-adding">
              {pick ? <span className="ss-chip pending">{pick}</span> : null}
              <button type="button" className="btn small primary" disabled={!pick} onClick={addPhrase}>أضف «{phraseSpec.name(phrases.length, phrases.length + 1) || "العبارة"}»</button>
              <button type="button" className="btn small ghost" onClick={() => setTarget(null)}>إلغاء</button>
            </div>
          ) : phrases.length < phraseSpec.max ? (
            <button type="button" className="btn small" onClick={() => { setNote(""); setTarget({ kind: "phrase" }); }}>أضف عبارة من الجملة</button>
          ) : null}
          {phrases.length < phraseSpec.min ? <p className="ss-warn">عدد العبارات التي يحتاجها هذا المشهد: {phraseSpec.min === phraseSpec.max ? AR(phraseSpec.min) : `من ${AR(phraseSpec.min)} إلى ${AR(phraseSpec.max)}`}.</p> : null}
        </div>
      ) : null}

      {rows.length ? (
        <div className="ss-block">
          <h4>متى يظهر كل عنصر</h4>
          <ul className="ss-slots">
            {rows.map((r, k) => {
              const s = states[k]!;
              const isEnd = r.key.endsWith(".end");
              const parent = isEnd ? r.key.slice(0, -4) : r.key;
              const open = target?.kind === "slot" && (target.key === parent || target.key === `${parent}.end`);
              if (isEnd && !r.value && !(target?.kind === "slot" && target.key === r.key)) return null;
              const on = target?.kind === "slot" && target.key === r.key;
              const word = s.at >= 0 ? displayWord(tokens[s.at]!.raw) : "";
              return (
                <li key={r.key} className={`${isEnd ? "end" : ""}${on ? " on" : ""}`}>
                  <button type="button" className="ss-slot" aria-pressed={on} title={r.key} onClick={() => { setNote(""); setTarget(on ? null : { kind: "slot", key: r.key }); if (s.at >= 0) seek(s.at); }}>
                    {!isEnd ? <span className="ss-n">{arDigits(numOf(r.key))}</span> : null}
                    <span className="ss-slot-l">{r.label}</span>
                    {s.stray ? <span className="ss-warn">«{r.value.split("#")[0]}» ليست في الجملة</span>
                      : r.value ? <span className="ss-chip">{word}</span>
                      : s.auto ? <span className="ss-chip auto" title="أول كلمة من عبارته">تلقائي: {word}</span>
                      : s.missing ? <span className="ss-warn">لم تُحدد كلمته بعد</span>
                      : <span className="ss-empty">{isEnd ? "مع آخر كلمة" : "اختياري"}</span>}
                  </button>
                  {r.value ? <button type="button" className="ss-x" aria-label={`امسح كلمة «${r.label}»`} onClick={() => onProps(writeSlot(props, r, "") as Record<string, string>)}>×</button> : null}
                  {!isEnd && r.end && open && !rows.find((x) => x.key === `${r.key}.end`)?.value && target?.key !== `${r.key}.end` ? (
                    <button type="button" className="ss-link" onClick={() => setTarget({ kind: "slot", key: `${r.key}.end` })}>حدّد نهاية الكتابة</button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {eventField ? (
        <div className="ss-block">
          <h4 title={eventField.key}>الأحداث على كلمات الجملة</h4>
          {events.length ? (
            <ul className="ss-slots">
              {events.map((e) => {
                const at = resolveAnchor(tokens, e.value, eventField.match ?? "first");
                return (
                  <li key={e.idx}>
                    <button type="button" className="ss-slot" title={e.key} onClick={() => { setNote(""); setTarget({ kind: "event", meaning: e.key, idx: e.idx }); if (at >= 0) seek(at); }}>
                      <span className="ss-slot-l">{meaningName(e.key)}</span>
                      {at >= 0 ? <span className="ss-chip">{displayWord(tokens[at]!.raw)}</span> : <span className="ss-warn">«{e.value}» ليست في الجملة</span>}
                    </button>
                    <button type="button" className="ss-x" aria-label="احذف الحدث" onClick={() => onProps({ ...props, [eventField.key]: setEventLine(props[eventField.key], e.idx, e.key, "") })}>×</button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="ss-hint">لا أحداث في هذا المشهد.</p>}
          <label className="field ss-add-event">
            <span>أضف حدثًا من القائمة المراجَعة</span>
            <select value="" onChange={(e) => { if (e.target.value) { setNote(""); setTarget({ kind: "event", meaning: e.target.value, idx: null }); } }}>
              <option value="">اختر المعنى…</option>
              {eventField.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
      ) : null}
    </section>
  );
};
