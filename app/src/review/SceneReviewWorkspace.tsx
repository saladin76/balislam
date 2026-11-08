import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoReviewAdapter, serverReviewAdapter } from "./adapter";
import {
  actionBlockers, activeVersion, formatClock, isSafeVideoUrl, STATUS_LABELS,
  type PlaybackEvent, type ReviewEpisode, type SceneSeed, type SceneVersion,
} from "./model";
import "./scene-review.css";

type Props = {
  channelId: string; episodeId: string; episodeTitle: string; seeds: SceneSeed[];
  initialSceneId?: string; initialMode?: "server" | "demo"; demoVideoUrl?: string;
  onClose?: () => void; onSelectScene?: (sceneId: string) => void;
};

export const SceneReviewWorkspace: React.FC<Props> = ({
  channelId, episodeId, episodeTitle, seeds, initialSceneId,
  initialMode = "server", demoVideoUrl, onClose, onSelectScene,
}) => {
  const [mode, setMode] = useState<"server" | "demo">(initialMode);
  const [data, setData] = useState<ReviewEpisode | null>(null);
  const [selectedId, setSelectedId] = useState(initialSceneId || seeds[0]?.id || "");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [syncFailed, setSyncFailed] = useState(false);
  const [versionChanged, setVersionChanged] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [eventError, setEventError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [noteText, setNoteText] = useState("");
  const [noteElement, setNoteElement] = useState("");
  const [noteAtTime, setNoteAtTime] = useState(true);
  const [decisionReason, setDecisionReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [compareId, setCompareId] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef("");
  const sequenceRef = useRef(0);
  const lastHeartbeatRef = useRef(0);
  const latestVersionRef = useRef<Record<string, string>>({});
  const adapter = useMemo(() => mode === "demo"
    ? demoReviewAdapter(channelId, episodeId, seeds, demoVideoUrl)
    : serverReviewAdapter(channelId, episodeId),
  [mode, channelId, episodeId, seeds, demoVideoUrl]);
  const seedById = useMemo(() => new Map(seeds.map(s => [s.id, s])), [seeds]);

  const load = useCallback(async (initial: boolean) => {
    if (initial) { setLoading(true); setData(null); }
    try {
      const fresh = await adapter.load();
      if (fresh.channelId !== channelId || fresh.episodeId !== episodeId) {
        throw Error("بيانات الخادم تخص حلقة أخرى.");
      }
      const newVersions: Record<string, string> = {};
      for (const id of fresh.order) {
        const current = fresh.scenes[id]?.currentVersionId || "";
        if (latestVersionRef.current[id] && current !== latestVersionRef.current[id] &&
          id === selectedId) setVersionChanged(true);
        newVersions[id] = current;
      }
      latestVersionRef.current = newVersions;
      setData(fresh);
      setSyncFailed(false);
      setLoadError("");
    } catch (e) {
      setSyncFailed(true);
      setLoadError((e as Error).message || "تعذر تحميل مراجعة المشاهد.");
    } finally {
      setLoading(false);
    }
  }, [adapter, channelId, episodeId, selectedId]);

  useEffect(() => {
    latestVersionRef.current = {};
    setVersionChanged(false); setEventError(false); setFeedback("");
    void load(true);
    // The effect is bound to the adapter/scope; polling below handles refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter]);
  useEffect(() => {
    if (mode !== "server") return;
    const timer = window.setInterval(() => { if (!busy) void load(false); }, 15000);
    return () => window.clearInterval(timer);
  }, [load, mode, busy]);

  const selectScene = (id: string) => {
    if (!data?.scenes[id]) return;
    setSelectedId(id); setVersionChanged(false); setMediaFailed(false);
    setEventError(false); setNoteText(""); setNoteElement("");
    setDecisionReason(""); setFeedback(""); setCompareId("");
    onSelectScene?.(id);
  };
  const record = data?.scenes[selectedId];
  const seed = seedById.get(selectedId);
  const version = record ? activeVersion(record) : undefined;
  const index = data ? data.order.indexOf(selectedId) : -1;
  const previous = index > 0 ? data?.scenes[data!.order[index - 1]!] : undefined;
  const mediaUrl = version?.video?.url;
  const safeVideo = Boolean(mediaUrl && version?.video?.mime === "video/mp4" &&
    isSafeVideoUrl(mediaUrl, window.location.origin));
  const blockers = record ? actionBlockers(record, previous, mode) : ["لا توجد بيانات لهذا المشهد."];
  if (record?.permissions.approve === false) blockers.push("الخادم لم يسمح بالاعتماد بعد.");
  if (versionChanged) blockers.push("تغير إصدار المشهد أثناء المراجعة. افتح الإصدار الجديد أولًا.");
  if (syncFailed) blockers.push("تعذر تحديث بيانات المراجعة من الخادم.");
  if (mediaFailed) blockers.push("فشل تشغيل الفيديو؛ راجع ملف MP4.");
  if (eventError) blockers.push("تعذر إرسال سجل التشغيل؛ لن يُعتد بدليل مشاهدة غير محفوظ.");
  if (!safeVideo) blockers.push("ملف الفيديو غير متاح أو رابط المعاينة غير آمن.");
  const uniqueBlockers = [...new Set(blockers)];
  const canApprove = mode === "server" && !busy && uniqueBlockers.length === 0 &&
    Boolean(record?.permissions.approve);
  const canRequestChanges = mode === "server" && !busy && !versionChanged &&
    !syncFailed && !mediaFailed && safeVideo && record?.status === "in_review" &&
    Boolean(record.permissions.requestChanges) && decisionReason.trim().length >= 2;
  const compare: SceneVersion | undefined = record?.versions.find(v => v.id === compareId) ||
    record?.versions.find(v => v.id !== version?.id);

  useEffect(() => {
    sessionRef.current = typeof crypto !== "undefined" && "randomUUID" in crypto ?
      crypto.randomUUID() : "session-" + Date.now();
    sequenceRef.current = 0; lastHeartbeatRef.current = 0;
    setTime(0); setRate(1); setMediaFailed(false); setEventError(false);
  }, [selectedId, version?.id]);

  const reportPlayback = (kind: PlaybackEvent["kind"]) => {
    const video = videoRef.current;
    if (!video || !version || mode !== "server") return;
    const now = Date.now();
    if (kind === "heartbeat" && now - lastHeartbeatRef.current < 2000) return;
    if (kind === "heartbeat") lastHeartbeatRef.current = now;
    const session = sessionRef.current;
    const event: PlaybackEvent = {
      sceneId: selectedId, versionId: version.id, sessionId: session,
      sequence: ++sequenceRef.current, kind,
      positionSec: Number(video.currentTime.toFixed(3)),
      durationSec: Number.isFinite(video.duration) ? Number(video.duration.toFixed(3)) : 0,
      playbackRate: video.playbackRate,
    };
    void adapter.playback(event).catch(() => {
      if (session === sessionRef.current) setEventError(true);
    });
  };

  const saveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record || !version || noteText.trim().length < 2 || busy) return;
    if (noteElement && !/^[a-zA-Z0-9_-]{1,100}$/.test(noteElement)) {
      setFeedback("معرف العنصر يجب أن يحتوي حروفًا إنجليزية أو أرقامًا أو _ أو - فقط.");
      return;
    }
    setBusy(true); setFeedback("");
    try {
      const updated = await adapter.addNote({
        sceneId: selectedId, versionId: version.id,
        expectedFingerprint: version.fingerprint,
        text: noteText.trim(), ...(noteAtTime ? { second: Math.max(0, Math.round(time * 10) / 10) } : {}),
        ...(noteElement ? { elementId: noteElement } : {}),
      });
      setData(updated); setNoteText(""); setNoteElement("");
      setFeedback(mode === "demo" ? "ملاحظة تجريبية محلية — لن تُحفظ في إنتاج Studio." : "حُفظت الملاحظة على الخادم.");
    } catch (err) { setFeedback((err as Error).message); }
    finally { setBusy(false); }
  };
  const decide = async (action: "approve" | "request_changes") => {
    if (!record || !version || mode !== "server" ||
      (action === "approve" ? !canApprove : !canRequestChanges)) return;
    setBusy(true); setFeedback("");
    try {
      const updated = await adapter.decide({
        sceneId: selectedId, expectedFingerprint: version.fingerprint,
        action, ...(action === "request_changes" ? { note: decisionReason.trim(), second: time } : {}),
      });
      setData(updated); setDecisionReason("");
      setFeedback(action === "approve" ?
        "تم تسجيل رد الخادم. تحقق من حالة المشهد المعروضة." :
        "وصل طلب التعديل للخادم. تحقق من الحالة المحدثة.");
    } catch (e) { setSyncFailed(true); setFeedback((e as Error).message); }
    finally { setBusy(false); }
  };
  const jump = (sec: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(
      Number.isFinite(videoRef.current.duration) ? videoRef.current.duration : sec, sec));
    setTime(videoRef.current.currentTime);
  };

  return <section className="v2-review" dir="rtl" aria-label="مراجعة المشاهد بالصوت والصورة">
    <header className="v2-header">
      <div className="v2-heading">
        <span className="v2-eyebrow">STUDIO V2 / SCENE REVIEW</span>
        <h2>مراجعة المشهد بالصوت والصورة</h2>
        <p>{episodeTitle} <span dir="ltr">· {episodeId}</span></p>
      </div>
      <div className="v2-header-actions">
        <span className={"v2-mode " + (mode === "demo" ? "qa" : "live")}>
          {mode === "demo" ? "بيانات اختبارية — لا اعتماد حقيقي" : "اتصال Backend مطلوب"}
        </span>
        <button type="button" className="v2-outline" onClick={() => void load(false)} disabled={loading || busy}>تحديث الحالة</button>
        {mode === "server" && <button type="button" className="v2-outline" onClick={() => setMode("demo")}>فتح العرض التجريبي</button>}
        {mode === "demo" && <button type="button" className="v2-outline" onClick={() => setMode("server")}>العودة للخادم</button>}
        {onClose && <button type="button" className="v2-outline" onClick={onClose}>عودة للمحرر</button>}
      </div>
    </header>
    {loadError && <div className="v2-alert" role="alert">{loadError} {syncFailed && "الاعتماد معطّل حتى استعادة الاتصال."}</div>}
    {loading && !data ? <div className="v2-loading" role="status">جارٍ تحميل المشاهد والإصدارات من المصدر المحدد…</div> : null}
    {!loading && !data ? <div className="v2-unavailable">
      <h3>لا توجد بيانات مراجعة V2 موثوقة</h3>
      <p>محرك المراجعة لا يملك API إنتاجية متصلة بعد. لا يمكن استخراج اعتماد من معاينة Remotion أو من مراجعة المشاهد القديمة.</p>
      <button type="button" className="v2-primary" onClick={() => void load(true)}>إعادة المحاولة</button>
      {mode === "server" && <button type="button" className="v2-outline" onClick={() => setMode("demo")}>استعراض الواجهة ببيانات QA</button>}
    </div> : null}
    {data && <div className="v2-layout">
      <nav className="v2-scene-list" aria-label="مشاهد الحلقة">
        <div className="v2-panel-top"><strong>مشاهد الحلقة</strong><small>{data.order.length} مشهدًا</small></div>
        <div className="v2-scenes-scroll">
          {data.order.map((id, idx) => {
            const item = data.scenes[id];
            const plan = seedById.get(id);
            if (!item) return null;
            return <button type="button" key={id} className={"v2-scene-button " + (id === selectedId ? "selected" : "")}
              aria-current={id === selectedId ? "true" : undefined} onClick={() => selectScene(id)}>
              <span className="v2-scene-no">{String(idx + 1).padStart(2, "0")}</span>
              <span className="v2-scene-info"><strong>{plan?.title || id}</strong><small>{plan?.chapter || "مشهد"} · {formatClock(plan?.durationSec || 0)}</small>
                <em className={"v2-status v2-" + item.status}>{STATUS_LABELS[item.status]}</em>
              </span>
            </button>;
          })}
        </div>
      </nav>
      <main className="v2-main">
        {record && <><div className="v2-scene-heading">
          <div><span className="v2-eyebrow">المشهد {index + 1} من {data.order.length}</span>
            <h3>{seed?.title || selectedId}</h3></div>
          <div className="v2-scene-meta"><span className={"v2-status v2-" + record.status}>{STATUS_LABELS[record.status]}</span>
            <span dir="ltr">{version?.label || "No version"}</span></div>
        </div>
        <div className="v2-video-shell" dir="ltr">
          {safeVideo && !mediaFailed && !versionChanged ? <video key={selectedId + ":" + version?.id} ref={videoRef}
            src={mediaUrl} controls preload="metadata" playsInline
            aria-label={"فيديو " + (seed?.title || selectedId)}
            onTimeUpdate={e => { setTime(e.currentTarget.currentTime); reportPlayback("heartbeat"); }}
            onPlay={() => reportPlayback("play")}
            onPause={() => reportPlayback("pause")}
            onSeeked={() => reportPlayback("seeked")}
            onRateChange={e => { setRate(e.currentTarget.playbackRate); reportPlayback("ratechange"); }}
            onEnded={() => reportPlayback("ended")}
            onError={() => setMediaFailed(true)}
          /> : <div className="v2-video-empty" role="status">
            <div className="v2-video-icon" aria-hidden="true">▣</div>
            <strong>{versionChanged ? "تم إنشاء إصدار أحدث أثناء المراجعة" : mediaFailed ? "تعذر تشغيل ملف MP4" : "لم يتوفر ملف MP4 صالح بعد"}</strong>
            <p>{versionChanged ? "يجب فتح النسخة الأحدث وبدء مراجعة جديدة." :
              mediaFailed ? "تحقق من عنوان الفيديو وترميزه واستجابة الخادم." :
              "لا تعني معاينة التحريك وجود نسخة AV كاملة قابلة للاعتماد."}</p>
            {versionChanged && <button type="button" className="v2-outline" onClick={() => setVersionChanged(false)}>فتح الإصدار الجديد</button>}
          </div>}
        </div>
        <div className="v2-player-controls">
          <span className="v2-clock" dir="ltr">{formatClock(time)} / {formatClock(version?.video?.durationSec || 0)}</span>
          <button type="button" className="v2-outline" disabled={!safeVideo || mediaFailed || versionChanged} onClick={() => jump(time - 5)}>−5 ث</button>
          <button type="button" className="v2-outline" disabled={!safeVideo || mediaFailed || versionChanged} onClick={() => jump(time + 5)}>+5 ث</button>
          <label>السرعة <select aria-label="سرعة تشغيل الفيديو" value={rate}
            disabled={!safeVideo || mediaFailed || versionChanged}
            onChange={e => { const n = Number(e.target.value); if (videoRef.current) videoRef.current.playbackRate = n; setRate(n); }}>
            {[0.75, 1, 1.25, 1.5, 2].map(n => <option key={n} value={n}>{n}×</option>)}
          </select></label>
          <span className="v2-help">الصوت والتحكم من مشغل الفيديو. Play وحده ليس دليل مشاهدة.</span>
        </div>
        <section className="v2-card v2-notes" aria-label="ملاحظات المشهد">
          <div className="v2-card-head"><h4>ملاحظات المراجعة</h4><span>{record.notes.length} ملاحظة</span></div>
          <form onSubmit={e => void saveNote(e)}>
            <label className="v2-input-label">اكتب الملاحظة
              <textarea value={noteText} maxLength={2000} rows={3}
                onChange={e => setNoteText(e.target.value)} placeholder="مثال: في الثانية 00:07 تتقدم الحركة على الكلمة المنطوقة…" />
            </label>
            <div className="v2-note-controls">
              <label className="v2-check"><input type="checkbox" checked={noteAtTime} onChange={e => setNoteAtTime(e.target.checked)} /> ربط بالوقت الحالي <b dir="ltr">{formatClock(time)}</b></label>
              <label className="v2-element-label">العنصر (اختياري)
                <input type="text" dir="ltr" value={noteElement} onChange={e => setNoteElement(e.target.value)} placeholder="camera / title" maxLength={100} />
              </label>
              <button type="submit" className="v2-primary" disabled={busy || noteText.trim().length < 2 || !version || versionChanged || syncFailed}>تسجيل الملاحظة</button>
            </div>
          </form>
          <div className="v2-note-list">
            {record.notes.length === 0 ? <p className="v2-help">لا توجد ملاحظات مسجلة على هذا الإصدار.</p> :
              record.notes.slice().reverse().map(note => <div className="v2-note" key={note.id}>
                <div><button className="v2-time-tag" type="button" disabled={note.second === undefined || !safeVideo}
                  onClick={() => jump(note.second || 0)} dir="ltr">{note.second === undefined ? "عام" : formatClock(note.second)}</button>
                  {note.elementId && <code dir="ltr">{note.elementId}</code>}
                  {note.versionId !== version?.id && <span className="v2-help">إصدار سابق</span>}</div>
                <p>{note.text}</p>
              </div>)}
          </div>
        </section>
        <section className="v2-card v2-decision" aria-label="قرار المراجعة">
          <div className="v2-card-head"><h4>قرار المشهد</h4><span>{mode === "demo" ? "تجربة معزولة" : "قرار خادمي فقط"}</span></div>
          <p className="v2-help">يقرر Backend وحده اكتمال المشاهدة وسلامة الإصدار والبوابات السابقة. لا يتم اعتماد شيء محليًا.</p>
          <label className="v2-input-label">سبب طلب التعديل
            <textarea rows={2} value={decisionReason} maxLength={2000}
              onChange={e => setDecisionReason(e.target.value)} placeholder="سبب واضح للتصحيح (مطلوب عند طلب التعديل)" /></label>
          <div className="v2-decision-buttons">
            <button type="button" className="v2-danger" disabled={!canRequestChanges} onClick={() => void decide("request_changes")}>طلب تعديل</button>
            <button type="button" className="v2-primary" disabled={!canApprove} onClick={() => void decide("approve")}>اعتماد هذا المشهد</button>
          </div>
          <div className="v2-blockers" role="status"><strong>حالة الأزرار وسبب التعطيل</strong>
            {uniqueBlockers.length ? <ul>{uniqueBlockers.map(reason => <li key={reason}>{reason}</li>)}</ul> :
              <p>التحقق النهائي من الأهلية يحدث على الخادم عند الإرسال.</p>}
            {!canRequestChanges && decisionReason.trim().length < 2 && <p>طلب التعديل يتطلب كتابة سبب من حرفين على الأقل.</p>}
          </div>
          {feedback && <p className="v2-feedback" role="status">{feedback}</p>}
        </section></>}
      </main>
      <aside className="v2-inspector" aria-label="تفاصيل المشهد الفنية">
        <div className="v2-panel-top"><strong>تفاصيل المشهد</strong><small>الخطة والإصدارات</small></div>
        <div className="v2-inspector-body">
          <section className="v2-card">
            <div className="v2-card-head"><h4>النص المنطوق</h4><span>{seed?.narration?.trim() ? "تعليق صوتي" : "مشهد صامت"}</span></div>
            <p className="v2-narration">{seed?.narration?.trim() || "لا يوجد تعليق منطوق في هذا المشهد؛ تتم مراجعة الصوت المحيط والمؤثرات إن وجدت."}</p>
          </section>
          <section className="v2-card"><div className="v2-card-head"><h4>Storyboard</h4></div>
            <p>{seed?.storyboard || "لم يُضف وصف بصري في الخطة الحالية."}</p></section>
          <details className="v2-card" open><summary>التوجيه الفني والكاميرا</summary>
            <dl className="v2-facts">
              <dt>الإخراج البصري</dt><dd>{seed?.artDirection || "لم يحدد"}</dd>
              <dt>حركة الكاميرا</dt><dd>{seed?.camera || "لم تحدد"}</dd>
              <dt>الانتقال</dt><dd>{seed?.transition || "لم يحدد"}</dd>
            </dl>
          </details>
          <details className="v2-card"><summary>التوقيت والمزامنة</summary>
            <dl className="v2-facts">
              <dt>التوقيت المخطط</dt><dd dir="ltr">{formatClock(seed?.durationSec || 0)}</dd>
              <dt>المزامنة</dt><dd>{seed?.timing || "تتطلب مطابقة مع ملف AV الحقيقي."}</dd>
              <dt>العناصر</dt><dd>{seed?.elements?.join("، ") || "لم تحدد"}</dd>
              <dt>مدة MP4</dt><dd dir="ltr">{version?.video ? formatClock(version.video.durationSec) : "—"}</dd>
            </dl>
          </details>
          <section className="v2-card"><div className="v2-card-head"><h4>الإصدار والفروقات</h4></div>
            <div className="v2-version-row"><span>الإصدار المعروض</span><strong dir="ltr">{version?.label || "—"}</strong></div>
            <label className="v2-input-label">مقارنة مع
              <select aria-label="قارن مع إصدار سابق" value={compare?.id || ""} onChange={e => setCompareId(e.target.value)}>
                {record?.versions.filter(v => v.id !== version?.id).map(v => <option value={v.id} key={v.id}>{v.label}</option>)}
                {!record?.versions.some(v => v.id !== version?.id) && <option value="">لا يوجد إصدار سابق</option>}
              </select>
            </label>
            <div className="v2-fingerprint"><span>معرف النسخة المرتبط بالمراجعة</span>
              <code dir="ltr">{version?.fingerprint || "—"}</code></div>
            {version?.changes?.length ? <div className="v2-diffs">
              {version.changes.map((d, i) => <div key={i}><strong>{d.field}</strong><del>{d.before}</del><ins>{d.after}</ins></div>)}
            </div> : <p className="v2-help">لم يرسل Backend قائمة فروقات لهذه النسخة.</p>}
            <p className="v2-help">المشغل يعرض النسخة الحالية فقط، والإصدارات القديمة للمقارنة الوصفية.</p>
          </section>
        </div>
      </aside>
    </div>}
  </section>;
};
