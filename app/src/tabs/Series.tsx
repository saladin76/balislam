import React, { useEffect, useMemo, useRef, useState } from "react";
import { Player } from "@remotion/player";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { api, type Overview, type SeriesRead, type SeriesView } from "../api";
import type { ChannelInfo } from "../../../src/channel/types";
import type { Identity } from "../../../brand/identity/index";
import {
  GENERAL_SLUG, SERIES_KIND_AR, DEFAULT_SERIES_TONE, defaultTitlePattern, deriveSeriesIdentity, publishTitle, shade,
  type DerivedSeriesIdentity, type SeriesConfig, type SeriesKind, type SeriesTemplate,
} from "../../../src/channel/series";
import { SERIES_STING_FRAMES, SeriesEmblem, SeriesSting, SeriesTitleCard } from "../../../src/remotion/series/SeriesArt";
import { Thumbnail } from "../../../src/remotion/Thumbnail";
import { Providers } from "../../../src/remotion/Providers";
import { styleNameAr } from "../../../src/plan/styles";
import { templateDefs } from "../../../src/plan/templates";
import { tones } from "../../../src/voice/tones";
import { Num, arDigits, episodeTitle } from "../ui/format";
import { Icon } from "../ui/icons";
import { Dialog } from "../ui/Dialog";
import { EPISODE_DRAG_TYPE, breadcrumb, decodeDrag, dropVerdict, episodesIn, kindAr, parentChoices, seriesGrid, seriesOfEpisode, suggestSlug } from "./seriesView";
import { MoveEpisodesDialog, RowMoveButton, useEpisodeMover } from "./MoveEpisodes";
import { fourSteps, nextLine } from "./HomeTab";
import "./series.css";

type StepTab = "script" | "storyboard" | "episode" | "review" | "publish";
const toneName = (t: string) => (tones as Record<string, { nameAr: string }>)[t]?.nameAr ?? t;
const templateName = (t: string) => templateDefs.find((d) => d.id === t)?.nameAr ?? t;
const countAr = (n: number) => (n === 0 ? "لا حلقات بعد" : n === 1 ? "حلقة واحدة" : n === 2 ? "حلقتان" : `${arDigits(n)} ${n <= 10 ? "حلقات" : "حلقة"}`);

/** A swatch + emblem chip in the series' derived identity (the card's mark). */
export const SeriesMark: React.FC<{ d: DerivedSeriesIdentity | null; size?: number; name: string }> = ({ d, size = 56, name }) => (
  <span className="sr-mark" style={d ? { background: d.card.bg, boxShadow: `inset 0 -6px 0 ${d.accent}` } : undefined} aria-hidden="true" title={name}>
    {d ? <SeriesEmblem d={d} size={size * 0.72} /> : null}
  </span>
);

// ———————————————————— Channel home: the series grid ————————————————————

/** «السلاسل والتصنيفات»: cards with the sub-identity swatch and emblem, count, next action; categories nest their series. */
export const SeriesGrid: React.FC<{
  data: SeriesRead;
  items: Overview[];
  onOpen: (id: string) => void;
  onNew: (kind: SeriesKind) => void;
  /** The episodes being dragged from «كل الحلقات» (D77): cards that can take them light up. */
  dragging?: string[] | null;
  onDropEpisodes?: (series: string, episodes: string[]) => void;
  /** «انقل حلقاتها إلى سلسلة» on the «عام» card when it has episodes. */
  onMoveGeneral?: () => void;
}> = ({ data, items, onOpen, onNew, dragging, onDropEpisodes, onMoveGeneral }) => {
  const nodes = seriesGrid(data.series);
  const [over, setOver] = useState("");
  const card = (s: SeriesView, nested = false) => {
    const eps = episodesIn(s.id, data.series, items);
    const waiting = eps.find((e) => fourSteps(e).some((x) => !x.done));
    const verdict = dragging?.length ? dropVerdict(s, dragging, items) : null;
    const dropCls = verdict ? (verdict.ok ? (over === s.id ? " is-drop-over" : " is-drop-ok") : " is-drop-no") : "";
    return (
      <button key={s.id} type="button" className={`sr-card${nested ? " is-nested" : ""}${s.status === "archived" ? " is-archived" : ""}${dropCls}`} onClick={() => onOpen(s.id)}
        aria-label={`${kindAr(s)} ${s.name}: ${countAr(eps.length)}`} data-series={s.id}
        onDragOver={onDropEpisodes ? (e) => {
          if (!e.dataTransfer.types.includes(EPISODE_DRAG_TYPE) || !verdict?.ok) return;
          e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move";
          if (over !== s.id) setOver(s.id);
        } : undefined}
        onDragLeave={onDropEpisodes ? () => setOver((o) => (o === s.id ? "" : o)) : undefined}
        onDrop={onDropEpisodes ? (e) => {
          e.preventDefault(); e.stopPropagation(); setOver("");
          const ids = decodeDrag(e.dataTransfer.getData(EPISODE_DRAG_TYPE));
          if (ids && dropVerdict(s, ids, items).ok) onDropEpisodes(s.id, ids);
        } : undefined}>
        <SeriesMark d={s.derived} name={s.name} size={nested ? 44 : 56} />
        <span className="sr-card-txt">
          <span className="sr-kind">{kindAr(s)}{s.status === "archived" ? "، مؤرشفة" : ""}</span>
          <b>{s.name}</b>
          <span className="sr-count"><Num>{countAr(eps.length)}</Num></span>
          {verdict?.ok ? <span className="sr-next sr-drop-hint">{over === s.id ? "أفلِت هنا للنقل" : "أفلِتها هنا"}</span>
            : waiting ? <span className="sr-next">الحلقة {arDigits(waiting.id.replace(/^0+(?=\d)/, ""))}: {nextLine(waiting).text}</span> : eps.length ? <span className="sr-next">كل حلقاتها في مسارها</span> : <span className="sr-next">ابدأ أول حلقة فيها</span>}
        </span>
      </button>
    );
  };
  const generalHas = items.some((e) => seriesOfEpisode(e) === GENERAL_SLUG) && data.series.some((x) => x.id !== GENERAL_SLUG && x.status !== "archived");
  return (
    <section className={`sr-grid-wrap${dragging?.length ? " is-dragging" : ""}`} aria-labelledby="sr-grid-h">
      <div className="sr-sec-head">
        <h2 id="sr-grid-h">السلاسل والتصنيفات</h2>
        <div className="sr-sec-acts">
          <button type="button" className="btn" onClick={() => onNew("series")}><Icon name="plus" />سلسلة جديدة</button>
          <button type="button" className="btn" onClick={() => onNew("category")}><Icon name="plus" />تصنيف جديد</button>
        </div>
      </div>
      {dragging?.length ? <p className="sr-drag-line" role="status">أفلِت {dragging.length === 1 ? `الحلقة ${arDigits(dragging[0]!.replace(/^0+(?=\d)/, ""))}` : dragging.length === 2 ? "حلقتين" : `${arDigits(dragging.length)} ${dragging.length <= 10 ? "حلقات" : "حلقة"}`} على سلسلة أو تصنيف لنقلها إليه.</p> : null}
      <ul className="sr-grid">
        {nodes.map((n) => (
          <li key={n.id} className={n.children.length ? "has-kids" : undefined}>
            {card(n as unknown as SeriesView)}
            {n.id === GENERAL_SLUG && generalHas && onMoveGeneral ? (
              <button type="button" className="sr-card-act" onClick={onMoveGeneral}>انقل حلقاتها إلى سلسلة…</button>
            ) : null}
            {n.children.length ? (
              <ul className="sr-kids" aria-label={`داخل ${n.name}`}>
                {n.children.map((k) => (
                  <li key={k.id}>
                    {card(k as unknown as SeriesView, true)}
                    {k.children.length ? <ul className="sr-kids">{k.children.map((g) => <li key={g.id}>{card(g as unknown as SeriesView, true)}</li>)}</ul> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
};

// ———————————————————— New series / category ————————————————————

export const NewSeriesDialog: React.FC<{ kind: SeriesKind; data: SeriesRead; parent?: string; onClose: () => void; onCreated: (id: string) => void }> = ({ kind: k0, data, parent: p0, onClose, onCreated }) => {
  const [kind, setKind] = useState<SeriesKind>(k0);
  const [name, setName] = useState("");
  const [latin, setLatin] = useState("");
  const [parent, setParent] = useState(p0 ?? "");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const id = suggestSlug(latin, data.series);
  const parents = data.series.filter((s) => s.kind === "category" && s.status !== "archived" && breadcrumb(s.id, data.series).length < (data.rules?.maxDepth ?? 3));
  return (
    <Dialog as="form" labelledBy="new-series-title" width={520} onClose={onClose} onSubmit={async (e) => {
      e.preventDefault();
      if (busy) return;
      setBusy(true); setErr("");
      const s: SeriesConfig = { version: 1, id, name, kind, ...(parent ? { parent } : {}), ...(description.trim() ? { description: description.trim() } : {}), status: "active", order: data.series.length * 10,
        identity: {}, template: { tone: data.rules?.defaultTone ?? DEFAULT_SERIES_TONE, intro: "sting", publish: { titlePattern: defaultTitlePattern(kind) } } };
      try { await api.saveSeries(s); onCreated(id); } catch (x) { setErr((x as Error).message); setBusy(false); }
    }}>
      <div className="modal-head"><h3 id="new-series-title">{kind === "series" ? "سلسلة جديدة" : "تصنيف جديد"}</h3></div>
      <div className="modal-body sr-form">
        <div className="sr-seg" role="radiogroup" aria-label="النوع">
          {(["series", "category"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>{SERIES_KIND_AR[k]}<small>{k === "series" ? "حلقات مرتّبة بأرقام" : "بلا ترتيب، وقد يحوي سلاسل"}</small></button>
          ))}
        </div>
        <label className="field"><span>الاسم</span><input id="sr-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} placeholder={kind === "series" ? "ليالي رمضان" : "الأسرة"} autoFocus /></label>
        <label className="field"><span>اسم المجلد بالإنجليزية</span><input id="sr-latin" dir="ltr" value={latin} onChange={(e) => setLatin(e.target.value)} placeholder="ramadan-nights" /><small className="help">يُحفظ باسم <bdi dir="ltr">{id}</bdi>، ولا يتغير بعد الإنشاء.</small></label>
        <label className="field"><span>داخل</span>
          <select id="sr-parent" value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">أعلى القناة</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{breadcrumb(p.id, data.series).map((x) => x.name).join(" ← ")}</option>)}
          </select>
        </label>
        <label className="field"><span>وصف قصير (اختياري)</span><input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={140} /></label>
        <p className="help">الهوية مشتقة من هوية القناة وحدها: لون من لوحتها، وزخرفة من زخارفها، وخط عناوينها نفسه. تُضبط بعد الإنشاء في «هوية السلسلة».</p>
        {err ? <p className="help" style={{ color: "var(--err)" }} role="alert">{err}</p> : null}
        <div className="sr-dialog-acts">
          <button type="submit" className="btn primary" aria-busy={busy}>{busy ? "جارٍ الإنشاء…" : "أنشئ"}</button>
          <button type="button" className="btn" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </Dialog>
  );
};

// ———————————————————— Previews (rendered from the derived identity) ————————————————————

const StingComp: React.FC<{ identity?: Identity; channel: ChannelInfo; d: DerivedSeriesIdentity; name: string; number?: number; kind: SeriesKind }> = ({ identity, channel, d, name, number, kind }) => {
  const frame = useCurrentFrame();
  return <Providers identity={identity} channel={channel}><AbsoluteFill><SeriesSting stamp={{ identity: d, name, number, kind }} frame={frame} width={1920} height={1080} /></AbsoluteFill></Providers>;
};

export const SeriesPreviews: React.FC<{ d: DerivedSeriesIdentity; s: SeriesConfig; channel: ChannelInfo; identity?: Identity }> = ({ d, s, channel, identity }) => {
  const number = s.kind === "series" ? 3 : undefined;
  const sample = publishTitle(s.template?.publish?.titlePattern, { series: s.name || "السلسلة", n: number, title: "عنوان الحلقة هنا" }, (n) => n.toLocaleString("ar-EG"));
  return (
    <div className="sr-previews">
      <figure>
        <figcaption>بطاقة السلسلة بعد افتتاحية القناة</figcaption>
        {d.intro === "sting" || s.template?.intro === "sting" ? (
          <div className="sr-player"><Player key={JSON.stringify(d)} component={StingComp} inputProps={{ identity, channel, d, name: s.name || "السلسلة", number, kind: s.kind }} durationInFrames={SERIES_STING_FRAMES + 20} fps={30}
            compositionWidth={1920} compositionHeight={1080} style={{ width: "100%" }} autoPlay loop acknowledgeRemotionLicense /></div>
        ) : <p className="help sr-off">بلا بطاقة: افتتاحية القناة وحدها.</p>}
      </figure>
      <figure>
        <figcaption>الصورة المصغّرة</figcaption>
        <div className="sr-player"><Player key={`t-${JSON.stringify(d)}`} component={Thumbnail} inputProps={{ themeId: "night", title: "عنوان الحلقة يظهر هنا بخط كبير", highlight: "بخط كبير", element: "", identity, channel,
          series: { identity: d, name: s.name || "السلسلة", number, kind: s.kind, template: s.template ?? {} } }} durationInFrames={1} fps={30} compositionWidth={1280} compositionHeight={720} style={{ width: "100%" }} acknowledgeRemotionLicense /></div>
      </figure>
      <figure>
        <figcaption>بطاقة العنوان</figcaption>
        <div className="sr-card-prev"><SeriesTitleCard d={d} name={s.name || "السلسلة"} number={number} kindAr={SERIES_KIND_AR[s.kind]} width={480} height={270} /></div>
        <p className="sr-sample" dir="rtl">عنوان النشر: <b>{sample}</b></p>
      </figure>
    </div>
  );
};

// ———————————————————— Series page ————————————————————

type Pane = "episodes" | "identity" | "template";

export const SeriesPage: React.FC<{
  channel: ChannelInfo;
  identity?: Identity;
  seriesId: string;
  onOpenEpisode: (id: string, tab: StepTab) => void;
  onOpenSeries: (id: string) => void;
  onNewEpisode: (series: string) => void;
  onBack: () => void;
  onChanged?: () => void;
}> = ({ channel, identity, seriesId, onOpenEpisode, onOpenSeries, onNewEpisode, onBack, onChanged }) => {
  const [data, setData] = useState<SeriesRead | null>(null);
  const [items, setItems] = useState<Overview[] | null>(null);
  const [err, setErr] = useState("");
  const [pane, setPane] = useState<Pane>("episodes");
  const [draft, setDraft] = useState<SeriesConfig | null>(null);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState<null | "rename" | "move" | "delete" | { moveEpisode: string } | { newChild: SeriesKind }>(null);
  const load = () => Promise.all([api.series(), api.overview()]).then(([d, o]) => { setData(d); setItems(o); const s = d.series.find((x) => x.id === seriesId); setDraft(s ? strip(s) : null); }).catch((e) => setErr((e as Error).message));
  const mover = useEpisodeMover(async () => { await load(); onChanged?.(); });
  useEffect(() => { setPane("episodes"); setData(null); void load(); }, [channel.id, seriesId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="empty-state"><h2>تعذّر التحميل</h2><p>{err}</p></div>;
  if (!data || !items) return <div className="empty-state"><h2>جارٍ التحميل…</h2></div>;
  const saved = data.series.find((x) => x.id === seriesId);
  if (!saved || !draft) return <div className="empty-state"><h2>السلسلة غير موجودة</h2><button className="btn" type="button" onClick={onBack}>إلى حلقات القناة</button></div>;
  const dirty = JSON.stringify(strip(saved)) !== JSON.stringify(draft);
  const d = data.rules ? deriveSeriesIdentity(channel.id, draft.identity ?? {}) : null;
  const eps = episodesIn(seriesId, data.series, items);
  const kids = data.series.filter((x) => x.parent === seriesId);
  const crumbs = breadcrumb(seriesId, data.series).slice(0, -1);
  const save = async (next: SeriesConfig, okText = "حُفظت") => {
    setBusy(true); setMsg(null);
    try { await api.saveSeries(next); await load(); setMsg({ text: okText }); onChanged?.(); }
    catch (x) { setMsg({ text: (x as Error).message, err: true }); }
    finally { setBusy(false); }
  };
  const general = seriesId === GENERAL_SLUG;
  return (
    <div className="ledger sr-page" data-series={seriesId}>
      <nav className="sr-crumbs" aria-label="مسار السلسلة">
        <button type="button" onClick={onBack}>{channel.name}</button>
        {crumbs.map((c) => <React.Fragment key={c.id}><span aria-hidden="true">←</span><button type="button" onClick={() => onOpenSeries(c.id)}>{c.name}</button></React.Fragment>)}
      </nav>
      <header className="sr-hero">
        <SeriesMark d={d} name={saved.name} size={84} />
        <div>
          <span className="sr-kind">{kindAr(saved)}{saved.status === "archived" ? "، مؤرشفة" : ""}{saved.virtual ? "، افتراضي للقناة" : ""}</span>
          <h1 style={d ? { fontWeight: d.title.weight === "bold" ? 700 : 400 } : undefined}>{saved.name}</h1>
          {saved.description ? <p>{saved.description}</p> : null}
          <p className="sr-count"><Num>{countAr(eps.length)}</Num>{kids.length ? `، ${arDigits(kids.length)} داخلها` : ""}</p>
        </div>
        <SeriesMenu general={general} archived={saved.status === "archived"} canDelete={!general && eps.length === 0 && kids.length === 0}
          onRename={() => setDlg("rename")} onMove={() => setDlg("move")} onDelete={() => setDlg("delete")}
          onArchive={() => void save({ ...strip(saved), status: saved.status === "archived" ? "active" : "archived" }, saved.status === "archived" ? "أُعيدت نشطة" : "أُرشفت")} />
      </header>

      <div className="sr-seg sr-tabs" role="tablist" aria-label="أقسام السلسلة">
        {([["episodes", "الحلقات"], ["identity", "هوية السلسلة"], ["template", "قالب السلسلة"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={pane === k} onClick={() => setPane(k)}>{l}</button>
        ))}
      </div>
      {msg ? <p className={`sr-msg${msg.err ? " is-err" : ""}`} role={msg.err ? "alert" : "status"}>{msg.text}</p> : null}

      {pane === "episodes" ? (
        <>
          {saved.kind === "category" ? (
            <div className="sr-sub">
              {kids.length ? <ul className="sr-grid sr-grid-sm">{kids.map((k) => <li key={k.id}><button type="button" className="sr-card is-nested" onClick={() => onOpenSeries(k.id)}><SeriesMark d={k.derived} name={k.name} size={40} /><span className="sr-card-txt"><span className="sr-kind">{kindAr(k)}</span><b>{k.name}</b><span className="sr-count"><Num>{countAr(episodesIn(k.id, data.series, items).length)}</Num></span></span></button></li>)}</ul> : null}
              {breadcrumb(seriesId, data.series).length < (data.rules?.maxDepth ?? 3) ? (
                <div className="sr-sec-acts"><button type="button" className="btn" onClick={() => setDlg({ newChild: "series" })}><Icon name="plus" />سلسلة داخله</button><button type="button" className="btn" onClick={() => setDlg({ newChild: "category" })}><Icon name="plus" />تصنيف داخله</button></div>
              ) : null}
            </div>
          ) : null}
          {eps.length === 0 ? <div className="ledger-empty"><p>لا حلقات {saved.kind === "series" ? "في هذه السلسلة" : "في هذا التصنيف"} بعد. الحلقة الجديدة هنا تأخذ قالبه وهويته لحظة إنشائها، ولا تتغير الحلقات إن تغيّر القالب لاحقًا.</p></div> : (
            <ol className="ledger-list sr-eps">
              {eps.map((e) => {
                const next = nextLine(e);
                const steps = fourSteps(e);
                const at = steps.findIndex((s) => !s.done);
                const here = e.series && e.series !== seriesId ? data.series.find((x) => x.id === e.series)?.name : undefined;
                return (
                  <li key={e.id} className="ledger-row">
                    <span className="ledger-num" aria-hidden="true"><Num>{saved.kind === "series" && e.seriesNumber ? String(e.seriesNumber) : e.id.replace(/^0+(?=\d)/, "")}</Num></span>
                    <div className="ledger-main">
                      <button type="button" className="ledger-open" onClick={() => onOpenEpisode(e.id, next.tab)}>
                        <span className="ledger-k">{saved.kind === "series" && e.seriesNumber ? `الحلقة ${arDigits(e.seriesNumber)} في السلسلة، ` : ""}الحلقة {arDigits(e.id.replace(/^0+(?=\d)/, ""))}{here ? `، ${here}` : ""}</span>
                        <span className="ledger-title"><b>{episodeTitle(e.title) || e.dir}</b></span>
                      </button>
                      <div className="ledger-pg">
                        <ol className="ledger-steps" aria-label={`الخطوة ${Math.min((at === -1 ? 4 : at) + 1, 4)} من ٤`}>
                          {steps.map((s, i) => <li key={s.n} className={s.done ? "is-done" : i === at ? "is-now" : ""}><button type="button" title={s.title} onClick={() => onOpenEpisode(e.id, s.tab)}>{s.n}</button></li>)}
                        </ol>
                        <span className="ledger-next">{next.text}</span>
                      </div>
                    </div>
                    <span />
                    <RowMoveButton episode={e.id} onMove={() => setDlg({ moveEpisode: e.id })} />
                  </li>
                );
              })}
            </ol>
          )}
        </>
      ) : pane === "identity" && d && data.rules ? (
        <IdentityEditor draft={draft} setDraft={setDraft} d={d} rules={data.rules} />
      ) : pane === "template" && data.rules ? (
        <TemplateEditor draft={draft} setDraft={setDraft} rules={data.rules} channelId={channel.id} />
      ) : <p className="help">هذه القناة بلا هوية معتمدة بعد؛ تُشتق هويات السلاسل بعد اعتمادها.</p>}
      {(pane === "identity" || pane === "template") && d ? <SeriesPreviews d={d} s={draft} channel={channel} identity={identity} /> : null}

      <div className="ms-dock" role="group" aria-label={saved.name}>
        <div className="ms-dock-in">
          {dirty ? (
            <>
              <span className="ms-dock-line">{pane === "template" ? "قالب السلسلة" : "هوية السلسلة"}: تعديلات غير محفوظة. الحلقات القائمة لا تتغير.</span>
              <button type="button" className="btn" onClick={() => setDraft(strip(saved))}>تراجع</button>
              <button type="button" className="btn primary" aria-busy={busy} onClick={() => void save(draft)}>{busy ? "جارٍ الحفظ…" : "احفظ"}</button>
            </>
          ) : (
            <button type="button" className="btn primary" disabled={saved.status === "archived"} onClick={() => onNewEpisode(seriesId)}><Icon name="plus" />{saved.kind === "series" ? "حلقة جديدة في هذه السلسلة" : "حلقة جديدة في هذا التصنيف"}</button>
          )}
        </div>
      </div>

      {dlg === "rename" ? <RenameDialog name={saved.name} description={saved.description ?? ""} onClose={() => setDlg(null)} onSave={async (name, description) => { await save({ ...strip(saved), name, description: description || undefined }, "أُعيدت التسمية"); setDlg(null); }} /> : null}
      {dlg === "move" ? <MoveDialog s={saved} data={data} onClose={() => setDlg(null)} onSave={async (parent) => { const n = { ...strip(saved) }; if (parent) n.parent = parent; else delete n.parent; await save(n, "نُقلت"); setDlg(null); }} /> : null}
      {dlg === "delete" ? <DeleteDialog name={saved.name} onClose={() => setDlg(null)} onConfirm={async () => { try { await api.deleteSeries(seriesId); onChanged?.(); onBack(); } catch (x) { setMsg({ text: (x as Error).message, err: true }); setDlg(null); } }} /> : null}
      {dlg && typeof dlg === "object" && "moveEpisode" in dlg ? <MoveEpisodesDialog episodes={[dlg.moveEpisode]} current={eps.find((x) => x.id === dlg.moveEpisode)?.series || GENERAL_SLUG} data={data} onClose={() => setDlg(null)} onPick={async (to) => { await mover.move(to, [dlg.moveEpisode]); setDlg(null); }} /> : null}
      {mover.node}
      {dlg && typeof dlg === "object" && "newChild" in dlg ? <NewSeriesDialog kind={dlg.newChild} data={data} parent={seriesId} onClose={() => setDlg(null)} onCreated={(id) => { setDlg(null); onChanged?.(); onOpenSeries(id); }} /> : null}
    </div>
  );
};

/** The editable file only (the server adds derived identity and counts). */
const strip = (s: SeriesView | SeriesConfig): SeriesConfig => {
  const { derived: _d, episodes: _e, ...rest } = s as SeriesView;
  return JSON.parse(JSON.stringify(rest)) as SeriesConfig;
};

// ———————————————————— «هوية السلسلة» ————————————————————

const IdentityEditor: React.FC<{ draft: SeriesConfig; setDraft: (s: SeriesConfig) => void; d: DerivedSeriesIdentity; rules: NonNullable<SeriesRead["rules"]> }> = ({ draft, setDraft, d, rules }) => {
  const idn = draft.identity ?? {};
  const set = (p: Partial<NonNullable<SeriesConfig["identity"]>>) => setDraft({ ...draft, identity: { ...idn, ...p } });
  const acc = idn.accent ?? {};
  const parts = d.emblem.parts;
  return (
    <section className="sr-editor" aria-label="هوية السلسلة">
      <p className="help">كل اختيار هنا من هوية القناة وحدها: لا لون ولا خط ولا زخرفة من خارجها. خط العناوين <bdi>«{rules.fonts.heading}»</bdi> ثابت.</p>
      <fieldset><legend>لون السلسلة (من لوحة القناة)</legend>
        <div className="sr-swatches" role="radiogroup" aria-label="لون السلسلة">
          {rules.accents.map((a) => (
            <button key={a.hex} type="button" role="radio" aria-checked={d.accentBase === a.hex} title={a.nameAr} aria-label={a.nameAr} onClick={() => set({ accent: { ...acc, base: a.hex } })}>
              <i style={{ background: a.hex }} /><span>{a.nameAr}</span>
            </button>
          ))}
        </div>
        <div className="sr-sliders">
          <label className="field"><span>الإضاءة</span><input type="range" min={-rules.limits.lightness} max={rules.limits.lightness} step={0.01} value={acc.lightness ?? 0} onChange={(e) => set({ accent: { ...acc, base: d.accentBase, lightness: Number(e.target.value) } })} /></label>
          <label className="field"><span>التشبّع</span><input type="range" min={rules.limits.chromaMin} max={rules.limits.chromaMax} step={0.01} value={acc.chroma ?? 1} onChange={(e) => set({ accent: { ...acc, base: d.accentBase, chroma: Number(e.target.value) } })} /></label>
          <span className="sr-result"><i style={{ background: d.accent }} /><bdi dir="ltr">{d.accent}</bdi>{d.accent !== shade(d.accentBase) ? " (درجة من لون اللوحة)" : ""}</span>
        </div>
      </fieldset>
      <fieldset><legend>الزخرفة</legend>
        <div className="sr-seg" role="radiogroup">{rules.motifs.map((m) => <button key={m.id} type="button" role="radio" aria-checked={d.motif === m.id} onClick={() => set({ motif: m.id })}>{m.nameAr}</button>)}</div>
      </fieldset>
      <fieldset><legend>العنوان</legend>
        <div className="sr-row">
          <div className="sr-seg" role="radiogroup" aria-label="الوزن">{(["bold", "regular"] as const).map((w) => <button key={w} type="button" role="radio" aria-checked={d.title.weight === w} onClick={() => set({ title: { ...d.title, weight: w } })}>{w === "bold" ? "عريض" : "عادي"}</button>)}</div>
          <div className="sr-seg" role="radiogroup" aria-label="الحجم">{(["s", "m", "l"] as const).map((z) => <button key={z} type="button" role="radio" aria-checked={d.title.size === z} onClick={() => set({ title: { ...d.title, size: z } })}>{z === "s" ? "صغير" : z === "m" ? "وسط" : "كبير"}</button>)}</div>
          <div className="sr-seg" role="radiogroup" aria-label="الحلية">{(["rule", "motif", "none"] as const).map((o) => <button key={o} type="button" role="radio" aria-checked={d.title.ornament === o} onClick={() => set({ title: { ...d.title, ornament: o } })}>{o === "rule" ? "خط" : o === "motif" ? "زخرفة القناة" : "بلا"}</button>)}</div>
        </div>
      </fieldset>
      <fieldset><legend>الافتتاحية والصورة المصغّرة</legend>
        <div className="sr-row">
          <div className="sr-seg" role="radiogroup" aria-label="الافتتاحية">{(["sting", "channel"] as const).map((v) => <button key={v} type="button" role="radio" aria-checked={d.intro === v} onClick={() => set({ intro: v })}>{v === "sting" ? "افتتاحية القناة + بطاقة السلسلة" : "افتتاحية القناة وحدها"}</button>)}</div>
          <div className="sr-seg" role="radiogroup" aria-label="شارة المصغّرة">{(["band", "corner", "none"] as const).map((v) => <button key={v} type="button" role="radio" aria-checked={d.thumbnail.badge === v} onClick={() => set({ thumbnail: { badge: v } })}>{v === "band" ? "شريط أعلى المصغّرة" : v === "corner" ? "لسان في الزاوية" : "بلا شارة"}</button>)}</div>
        </div>
      </fieldset>
      <fieldset><legend>شعار السلسلة (جزء أو جزآن من شعار القناة)</legend>
        <div className="sr-parts">
          {rules.emblemParts.map((p) => {
            const on = parts.includes(p.id);
            const full = !on && parts.length >= rules.limits.emblemParts;
            return (
              <button key={p.id} type="button" aria-pressed={on} disabled={full} title={full ? "جزآن على الأكثر" : undefined}
                onClick={() => set({ emblem: { parts: on ? parts.filter((x) => x !== p.id) : [...parts, p.id] } })}>
                <SeriesEmblem d={{ ...d, emblem: { ...d.emblem, parts: [p.id] } }} size={40} /><span>{p.nameAr}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      {d.clamped.length ? <ul className="help sr-clamped">{d.clamped.map((c) => <li key={c}>{c}</li>)}</ul> : null}
    </section>
  );
};

// ———————————————————— «قالب السلسلة» ————————————————————

const TemplateEditor: React.FC<{ draft: SeriesConfig; setDraft: (s: SeriesConfig) => void; rules: NonNullable<SeriesRead["rules"]>; channelId: string }> = ({ draft, setDraft, rules, channelId }) => {
  const t: SeriesTemplate = draft.template ?? {};
  const set = (p: Partial<SeriesTemplate>) => setDraft({ ...draft, template: { ...t, ...p } });
  const toggle = (xs: string[] | undefined, x: string) => (xs ?? []).includes(x) ? (xs ?? []).filter((y) => y !== x) : [...(xs ?? []), x];
  const titles = t.chapters?.titles ?? [];
  const count = t.chapters?.count ?? Math.max(titles.length, 0);
  const tags = (t.publish?.tags ?? []).join("، ");
  return (
    <section className="sr-editor" aria-label="قالب السلسلة">
      <p className="help">افتراضيات الحلقات الجديدة فيها: تُختم في الحلقة لحظة إنشائها، فلا تتغير حلقة قائمة إن تغيّر القالب. ومبدأ التنوّع يبقى: الحلقة تأخذ أسلوبًا يختلف عن أسلوب الحلقة قبلها.</p>
      <fieldset><legend>قالب السكريبت</legend>
        <div className="sr-seg" role="radiogroup">
          <button type="button" role="radio" aria-checked={(t.script?.source ?? "channel") === "channel"} onClick={() => set({ script: { source: "channel" } })}>قالب القناة بعناوين فصول السلسلة</button>
          <button type="button" role="radio" aria-checked={t.script?.source === "series"} onClick={() => set({ script: { source: "series" } })}>قالب خاص بالسلسلة</button>
        </div>
        {t.script?.source === "series" ? <p className="help">يُقرأ من <bdi dir="ltr">templates/{channelId}/series/{draft.id}/script.md</bdi>، وإن لم يوجد فقالب القناة.</p> : null}
      </fieldset>
      <fieldset><legend>الأساليب (من أساليب القناة)</legend>
        <div className="sr-chips">{rules.styles.map((s) => <button key={s} type="button" aria-pressed={(t.styles ?? []).includes(s)} onClick={() => set({ styles: toggle(t.styles, s) })}>{styleNameAr(s)}</button>)}</div>
      </fieldset>
      <fieldset><legend>عائلات اللقطات (من مكتبة القناة)</legend>
        <div className="sr-chips sr-chips-scroll">{rules.templates.map((s) => <button key={s} type="button" aria-pressed={(t.shots ?? []).includes(s)} onClick={() => set({ shots: toggle(t.shots, s) })}>{templateName(s)}</button>)}</div>
      </fieldset>
      <div className="sr-grid2">
        <label className="field"><span>النبرة</span>
          <select value={t.tone ?? rules.defaultTone} onChange={(e) => set({ tone: e.target.value })}>{rules.tones.map((x) => <option key={x} value={x}>{toneName(x)}{x === rules.defaultTone ? " (الافتراضية)" : ""}</option>)}</select>
        </label>
        <label className="field"><span>الافتتاحية</span>
          <select value={t.intro ?? "sting"} onChange={(e) => set({ intro: e.target.value as SeriesTemplate["intro"] })}><option value="sting">افتتاحية القناة + بطاقة السلسلة</option><option value="channel">افتتاحية القناة وحدها</option><option value="none">بلا افتتاحية</option></select>
        </label>
        <label className="field"><span>الخاتمة</span>
          <select value={t.outro ?? "channel"} onChange={(e) => set({ outro: e.target.value as SeriesTemplate["outro"] })}><option value="channel">خاتمة القناة</option><option value="none">بلا خاتمة</option></select>
        </label>
        <label className="field"><span>الصورة المصغّرة</span>
          <select value={t.thumbnail?.layout ?? "badge"} onChange={(e) => set({ thumbnail: { layout: e.target.value as "channel" | "badge" } })}><option value="badge">مصغّرة القناة مع شارة السلسلة</option><option value="channel">مصغّرة القناة كما هي</option></select>
        </label>
        <label className="field"><span>سرعة الإلقاء (كلمة في الدقيقة)</span><input type="number" min={90} max={170} value={t.pacing?.wordsPerMinute ?? ""} placeholder="مثل القناة" onChange={(e) => set({ pacing: { ...t.pacing, wordsPerMinute: e.target.value ? Number(e.target.value) : undefined } })} /></label>
        <label className="field"><span>طول الفصل (ثانية)</span><input type="number" min={20} max={600} value={t.pacing?.chapterSeconds ?? ""} placeholder="مثل القناة" onChange={(e) => set({ pacing: { ...t.pacing, chapterSeconds: e.target.value ? Number(e.target.value) : undefined } })} /></label>
      </div>
      <fieldset><legend>بنية الفصول</legend>
        <label className="field sr-inline"><span>عدد الفصول</span><input type="number" min={1} max={12} value={count || ""} placeholder="مثل القناة" onChange={(e) => { const n = Number(e.target.value) || 0; set({ chapters: n ? { count: n, titles: Array.from({ length: n }, (_, i) => titles[i] ?? "") } : {} }); }} /></label>
        {count ? <ol className="sr-chapters">{Array.from({ length: count }, (_, i) => <li key={i}><input aria-label={`عنوان الفصل ${arDigits(i + 1)}`} value={titles[i] ?? ""} placeholder={`الفصل ${arDigits(i + 1)}`} onChange={(e) => { const next = Array.from({ length: count }, (_, j) => (j === i ? e.target.value : titles[j] ?? "")); set({ chapters: { count, titles: next } }); }} /></li>)}</ol> : null}
      </fieldset>
      <fieldset><legend>حزمة النشر</legend>
        <div className="sr-grid2">
          <label className="field"><span>نمط العنوان</span><input value={t.publish?.titlePattern ?? ""} placeholder={defaultTitlePattern(draft.kind) || "{title}"} onChange={(e) => set({ publish: { ...t.publish, titlePattern: e.target.value } })} /><small className="help">{"{series}"} اسم السلسلة، {"{n}"} رقم الحلقة فيها، {"{title}"} عنوان الحلقة.</small></label>
          <label className="field"><span>قائمة التشغيل</span><input value={t.publish?.playlist ?? ""} placeholder={draft.kind === "series" ? draft.name : "بلا قائمة"} onChange={(e) => set({ publish: { ...t.publish, playlist: e.target.value } })} /></label>
          <label className="field sr-span"><span>وسوم السلسلة (مفصولة بفاصلة)</span><input value={tags} onChange={(e) => set({ publish: { ...t.publish, tags: e.target.value.split(/[،,]/).map((x) => x.trim()).filter(Boolean) } })} /></label>
        </div>
      </fieldset>
    </section>
  );
};

// ———————————————————— Menus and dialogs ————————————————————

const SeriesMenu: React.FC<{ general: boolean; archived: boolean; canDelete: boolean; onRename: () => void; onMove: () => void; onArchive: () => void; onDelete: () => void }> = (p) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);
  const items = [
    { label: "أعد التسمية…", on: p.onRename },
    ...(p.general ? [] : [{ label: "انقل إلى تصنيف…", on: p.onMove }, { label: p.archived ? "أعدها نشطة" : "أرشف", on: p.onArchive }]),
    ...(p.general ? [] : [{ label: p.canDelete ? "احذف…" : "احذف… (انقل حلقاتها أولًا)", on: p.onDelete, danger: true }]),
  ];
  return (
    <div className="row-menu sr-menu" ref={box}>
      <button type="button" className="ledger-more" aria-haspopup="menu" aria-expanded={open} aria-label="خيارات السلسلة" title="خيارات السلسلة" onClick={() => setOpen((v) => !v)}>⋯</button>
      {open ? <div className="row-menu-pop" role="menu">{items.map((it) => <button key={it.label} type="button" role="menuitem" className={"danger" in it && it.danger ? "is-danger" : undefined} onClick={() => { setOpen(false); it.on(); }}>{it.label}</button>)}</div> : null}
    </div>
  );
};

const RenameDialog: React.FC<{ name: string; description: string; onClose: () => void; onSave: (name: string, description: string) => Promise<void> }> = ({ name: n0, description: d0, onClose, onSave }) => {
  const [name, setName] = useState(n0);
  const [description, setDescription] = useState(d0);
  return (
    <Dialog as="form" labelledBy="sr-rename-h" width={460} onClose={onClose} onSubmit={(e) => { e.preventDefault(); void onSave(name.trim(), description.trim()); }}>
      <div className="modal-head"><h3 id="sr-rename-h">أعد التسمية</h3></div>
      <div className="modal-body sr-form">
        <label className="field"><span>الاسم</span><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoFocus /></label>
        <label className="field"><span>الوصف</span><input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={140} /></label>
        <p className="help">الاسم الجديد يظهر في الحلقات الجديدة؛ الحلقات القائمة تحتفظ بالاسم الذي خُتم فيها.</p>
        <div className="sr-dialog-acts"><button type="submit" className="btn primary">احفظ</button><button type="button" className="btn" onClick={onClose}>إلغاء</button></div>
      </div>
    </Dialog>
  );
};

const MoveDialog: React.FC<{ s: SeriesView; data: SeriesRead; onClose: () => void; onSave: (parent: string) => Promise<void> }> = ({ s, data, onClose, onSave }) => {
  const choices = useMemo(() => parentChoices(s, data.series, data.rules?.maxDepth ?? 3), [s, data]);
  const [parent, setParent] = useState(s.parent ?? "");
  return (
    <Dialog as="form" labelledBy="sr-move-h" width={460} onClose={onClose} onSubmit={(e) => { e.preventDefault(); void onSave(parent); }}>
      <div className="modal-head"><h3 id="sr-move-h">انقل «{s.name}»</h3></div>
      <div className="modal-body sr-form">
        <label className="field"><span>داخل</span><select value={parent} onChange={(e) => setParent(e.target.value)} autoFocus><option value="">أعلى القناة</option>{choices.map((p) => <option key={p.id} value={p.id}>{breadcrumb(p.id, data.series).map((x) => x.name).join(" ← ")}</option>)}</select></label>
        <p className="help">التداخل ثلاثة مستويات على الأكثر، والسلسلة لا تحوي غيرها.</p>
        <div className="sr-dialog-acts"><button type="submit" className="btn primary">انقل</button><button type="button" className="btn" onClick={onClose}>إلغاء</button></div>
      </div>
    </Dialog>
  );
};

const DeleteDialog: React.FC<{ name: string; onClose: () => void; onConfirm: () => Promise<void> }> = ({ name, onClose, onConfirm }) => (
  <Dialog labelledBy="sr-del-h" width={460} onClose={onClose}>
    <div className="modal-head"><h3 id="sr-del-h">حذف «{name}»</h3></div>
    <div className="modal-body sr-form">
      <p>يُحذف ملفها وحده. لا تُحذف سلسلة فيها حلقات أو تحتها سلاسل: انقلها أولًا.</p>
      <div className="sr-dialog-acts"><button type="button" className="btn primary danger" onClick={() => void onConfirm()}>احذف</button><button type="button" className="btn" onClick={onClose}>إلغاء</button></div>
    </div>
  </Dialog>
);
