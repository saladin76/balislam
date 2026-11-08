import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoReviewAdapter, serverReviewAdapter, StudioV2HttpError } from "./adapter";
import { useAvReview } from "./useAvReview";
import {
  actionBlockers, activeVersion, formatClock, isSafeVideoUrl, STATUS_LABELS,
  type ReviewEpisode, type SceneSeed, type SceneVersion,
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
  const [authenticated, setAuthenticated] = useState(initialMode === "demo");
  const [loginSecret, setLoginSecret] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
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
      if (!fresh.scenes[selectedId]) {
        setSelectedId(fresh.order[0] || "");
        setVersionChanged(false);
      }
      setAuthenticated(true);
      setData(fresh);
      setSyncFailed(false);
      setLoadError("");
    } catch (e) {
      if (e instanceof StudioV2HttpError && e.status === 401) {
        setAuthenticated(false);
        setData(null);
      }
      setSyncFailed(true);
      setLoadError((e as Error).message || "تعذر تحميل مراجعة المشاهد.");
    } finally {
      setLoading(false);
    }
  }, [adapter, channelId, episodeId, selectedId]);

  useEffect(() => {
    latestVersionRef.current = {};
    setAuthenticated(mode === "demo");
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
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBusy || mode !== "server" || !loginSecret.trim()) return;
    const secret = loginSecret;
    setLoginSecret(""); setAuthError(""); setAuthBusy(true);
    try {
      await adapter.login(secret);
      setAuthenticated(true);
      await load(true);
    } catch (error) {
      setAuthenticated(false);
      setAuthError((error as Error).message);
    } finally { setAuthBusy(false); }
  };
  const logout = async () => {
    setAuthBusy(true);
    try { await adapter.logout(); }
    catch (error) { setAuthError((error as Error).message); }
    finally {
      setAuthBusy(false); setAuthenticated(false); setData(null);
      setLoginSecret("");
    }
  };
  const record = data?.scenes[selectedId];
  const seed = seedById.get(selectedId);
  const version = record ? activeVersion(record) : undefined;
  const index = data ? data.order.indexOf(selectedId) : -1;
  const previous = index > 0 ? data?.scenes[data!.order[index - 1]!] : undefined;
  const av = useAvReview(adapter, mode, selectedId, version?.fingerprint);
  const mediaUrl = mode === "server" ? av.session?.mediaUrl : version?.video?.url;
  const avDuration = mode === "server" ? av.session?.durationSec : version?.video?.durationSec;
  const safeVideo = Boolean(mediaUrl && avDuration && Number.isFinite(avDuration) &&
    avDuration > 0 && isSafeVideoUrl(mediaUrl, window.location.origin));
  const blockers = record ? actionBlockers(record, previous, mode) : ["لا توجد بيانات لهذا المشهد."];
  if (versionChanged) blockers.push("تغير إصدار المشهد أثناء المراجعة. افتح الإصدار الجديد أولًا.");
  if (syncFailed) blockers.push("تعذر تحديث بيانات المراجعة من الخادم.");
  if (mediaFailed) blockers.push("فشل تشغيل الفيديو؛ راجع ملف MP4.");
  if (mode === "server" && !av.completed)
    blockers.push("لم يؤكد Backend اكتمال مراجعة AV بهذا الإصدار.");
  if (mode === "server" && !data?.sourceApprovals?.script)
    blockers.push("اعتماد مصدر السكريبت غير متاح من الخادم.");
  if (mode === "server" && !data?.sourceApprovals?.storyboard)
    blockers.push("اعتماد Storyboard غير متاح من الخادم.");
  if (mode === "server" && !safeVideo)
    blockers.push("ابدأ جلسة AV جديدة للحصول على فيديو الخادم المحمي.");
  if (mode === "demo" && !safeVideo)
    blockers.push("ملف الفيديو الاختباري غير متاح.");
  if (mode === "server" && !authenticated) blockers.push("يلزم تسجيل دخول المالك.");
  const uniqueBlockers = [...new Set(blockers)];
  // UI readiness is not server authority. /commands rechecks all gates and bytes.
  const canApprove = mode === "server" && authenticated && !busy &&
    av.completed && uniqueBlockers.length === 0;
  const canRequestChanges = mode === "server" && authenticated && !busy &&
    !versionChanged && !syncFailed && record !== undefined &&
    Boolean(version?.fingerprint && /^[a-f0-9]{64}$/.test(version.fingerprint)) &&
    Boolean(record.permissions.requestChanges) && decisionReason.trim().length >= 2;
  const firstPrevious = record?.versions.find(v => v.id !== version?.id);
  const compare: SceneVersion | undefined = record?.versions.find(v => v.id === compareId) ||
    firstPrevious;
  const comparedDiffs = compare && version ?
    (version.diffsByBase?.[compare.id] ||
      (compare.id === firstPrevious?.id ? version.changes : undefined)) : undefined;


  const saveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record || !version || noteText.trim().length < 2 || busy) return;
    if (mode === "server") {
      setFeedback("لا يدعم Backend #88 حفظ ملاحظات مستقلة؛ سجّل طلب تعديل صريح.");
      return;
    }
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
    if (!record || mode !== "server" ||
      (action === "approve" ? !canApprove : !canRequestChanges)) return;
    if (noteElement && !/^[a-zA-Z0-9_-]{1,100}$/.test(noteElement)) {
      setFeedback("معرف العنصر غير صالح.");
      return;
    }
    setBusy(true); setFeedback("");
    try {
      const updated = await adapter.decide({
        sceneId: selectedId, expectedFingerprint: version?.fingerprint || "",
        action,
        ...(action === "approve" ? { reviewId: av.session?.reviewId } : {
          note: decisionReason.trim(),
          ...(noteAtTime ? { second: Math.max(0, Math.round(time * 10) / 10) } : {}),
          ...(noteElement ? { elementId: noteElement } : {}),
        }),
      });
      setData(updated); setDecisionReason(""); av.reset();
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
          {mode === "demo" ? "بيانات اختبارية — لا اعتماد حقيقي" : "مراجعة عبر Backend"}
        </span>
        <button type="button" className="v2-outline" onClick={() => void load(false)} disabled={loading || busy}>تحديث الحالة</button>
        {mode === "server" && seeds.length > 0 && <button type="button" className="v2-outline" onClick={() => setMode("demo")}>فتح العرض التجريبي</button>}
        {mode === "demo" && <button type="button" className="v2-outline" onClick={() => setMode("server")}>العودة للخادم</button>}
        {mode === "server" && authenticated && <button type="button" className="v2-outline" onClick={() => void logout()} disabled={authBusy}>تسجيل الخروج</button>}
        {onClose && <button type="button" className="v2-outline" onClick={onClose}>عودة للمحرر</button>}
      </div>
    </header>
    {mode === "server" && data?.sourceApprovals && <div className="v2-source-status" role="status">
      <span>اعتماد السكريبت: <b>{data.sourceApprovals.script ? "معتمد من الخادم" : "غير معتمد"}</b></span>
      <span>اعتماد Storyboard: <b>{data.sourceApprovals.storyboard ? "معتمد من الخادم" : "غير معتمد"}</b></span>
      <span>الحلقة: <b dir="ltr">{data.serverEpisode || episodeId}</b></span>
    </div>}
    {loadError && <div className="v2-alert" role="alert">{loadError} {syncFailed && "الاعتماد معطّل حتى استعادة الاتصال."}</div>}
    {loading && !data ? <div className="v2-loading" role="status">جارٍ تحميل المشاهد والإصدارات من المصدر المحدد…</div> : null}
    {mode === "server" && !authenticated && !loading && <div className="v2-unavailable">
      <h3>تسجيل دخول مالك Studio V2</h3>
      <p>تتطلب مراجعة AV جلسة محلية موثوقة. السر يُرسل مباشرة إلى Backend ولا يُحفظ في المتصفح.</p>
      <form onSubmit={e => void login(e)} className="v2-owner-form">
        <label className="v2-input-label">سر المالك
          <input type="password" autoComplete="off" required value={loginSecret}
            onChange={e => setLoginSecret(e.target.value)} aria-label="سر مالك Studio V2"/>
        </label>
        <button type="submit" className="v2-primary" disabled={authBusy || !loginSecret.trim()}>تسجيل الدخول</button>
      </form>
      {authError && <p role="alert">{authError}</p>}
    </div>}
    {!loading && !data && (mode === "demo" || authenticated) ? <div className="v2-unavailable">
      <h3>لا توجد بيانات مراجعة V2 موثوقة</h3>
      <p>تعذر جلب البيانات الموثوقة من Backend V2. راجع جلسة المالك ومتطلبات الخادم وملفات الحلقة، ولا تعتمد بيانات QA.</p>
      <button type="button" className="v2-primary" onClick={() => void load(true)}>إعادة المحاولة</button>
      {mode === "server" && seeds.length > 0 && <button type="button" className="v2-outline" onClick={() => setMode("demo")}>استعراض الواجهة ببيانات QA</button>}
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
        {mode === "server" && record.status === "in_review" &&
          <div className="v2-review-session" role="status">
            <button type="button" className="v2-primary"
              disabled={!authenticated || busy || !version?.fingerprint ||
                versionChanged || syncFailed || av.status === "starting" ||
                !data.sourceApprovals?.script || !data.sourceApprovals?.storyboard}
              onClick={() => void av.start()}>
              {av.session ? "بدء مراجعة جديدة من البداية" : "بدء مراجعة AV من الخادم"}
            </button>
            <span>{av.status === "completed" ? "أكد Backend اكتمال المشاهدة" :
              av.status === "watching" ? "المشاهدة بصوت مسموع وبسرعة 1×" :
              av.status === "ended" ? "انتهى التشغيل؛ أكمل التحقق الخادمي" :
              av.status === "starting" ? "جارٍ بدء جلسة مراجعة..." :
              av.status === "invalid" ? "الجلسة مرفوضة؛ أعد المشاهدة" :
              "لم تبدأ جلسة مشاهدة AV"}</span>
          </div>}
        {av.error && <div className="v2-alert" role="alert">{av.error}</div>}
        <div className="v2-video-shell" dir="ltr">
          {safeVideo && !mediaFailed && !versionChanged ? <video
            key={selectedId + ":" + version?.id + ":" + (av.session?.reviewId ?? "")} ref={videoRef}
            src={mediaUrl} controls preload="metadata" playsInline
            aria-label={"فيديو " + (seed?.title || selectedId)}
            onTimeUpdate={e => { setTime(e.currentTarget.currentTime); av.onTimeUpdate(e.currentTarget); }}
            onSeeking={av.onSeeking}
            onRateChange={e => { setRate(e.currentTarget.playbackRate); av.onRateChange(e.currentTarget); }}
            onVolumeChange={e => av.onVolumeChange(e.currentTarget)}
            onEnded={av.onEnded}
            onError={() => { setMediaFailed(true); av.invalidate("تعذر تحميل MP4 الموثوق؛ أعد المراجعة."); }}
          /> : <div className="v2-video-empty" role="status">
            <div className="v2-video-icon" aria-hidden="true">▣</div>
            <strong>{versionChanged ? "تم إنشاء إصدار أحدث أثناء المراجعة" : mediaFailed ? "تعذر تشغيل ملف MP4" :
              mode === "server" ? "ابدأ مراجعة AV لعرض فيديو الخادم" : "لم يتوفر ملف MP4 صالح بعد"}</strong>
            <p>{versionChanged ? "يجب فتح النسخة الأحدث وبدء مراجعة جديدة." :
              mediaFailed ? "تحقق من عنوان الفيديو وترميزه واستجابة الخادم." :
              mode === "server" ? "لا يرسل Backend رابط الفيديو إلا بعد بدء جلسة مراجعة AV موثوقة." :
              "لا تعني معاينة التحريك وجود نسخة AV كاملة قابلة للاعتماد."}</p>
            {versionChanged && <button type="button" className="v2-outline" onClick={() => setVersionChanged(false)}>فتح الإصدار الجديد</button>}
            {mediaFailed && <button type="button" className="v2-outline" onClick={() => setMediaFailed(false)}>إعادة محاولة تشغيل الفيديو</button>}
          </div>}
        </div>
        <div className="v2-player-controls">
          <span className="v2-clock" dir="ltr">{formatClock(time)} / {formatClock(avDuration || 0)}</span>
          <button type="button" className="v2-outline" disabled={mode === "server" || !safeVideo || mediaFailed || versionChanged} onClick={() => jump(time - 5)}>−5 ث</button>
          <button type="button" className="v2-outline" disabled={mode === "server" || !safeVideo || mediaFailed || versionChanged} onClick={() => jump(time + 5)}>+5 ث</button>
          <label>السرعة <select aria-label="سرعة تشغيل الفيديو" value={rate}
            disabled={mode === "server" || !safeVideo || mediaFailed || versionChanged}
            onChange={e => { const n = Number(e.target.value); if (videoRef.current) videoRef.current.playbackRate = n; setRate(n); }}>
            {[0.75, 1, 1.25, 1.5, 2].map(n => <option key={n} value={n}>{n}×</option>)}
          </select></label>
          <span className="v2-help">{mode === "server" ?
            "المراجعة المعتمدة 1× بالصوت. أي تخطٍّ أو تسريع أو كتم يلغي جلسة المراجعة." :
            "الصوت والتحكم من مشغل الفيديو. Play وحده ليس دليل مشاهدة."}</span>
        </div>
        {mode === "server" && av.session && <div className="v2-review-session">
          <span>التقدم المقبول من Backend: <b dir="ltr">{formatClock(av.playedSec)} / {formatClock(av.session.durationSec)}</b></span>
          <button type="button" className="v2-primary"
            disabled={av.status !== "ended" || busy}
            onClick={() => void av.finish(videoRef.current)}>
            {av.status === "completed" ? "اكتملت المراجعة" :
              av.status === "finishing" ? "جارٍ التحقق..." : "إنهاء المراجعة على الخادم"}
          </button>
        </div>}
        <section className="v2-card v2-notes" aria-label="ملاحظات المشهد">
          <div className="v2-card-head"><h4>ملاحظات المراجعة</h4><span>{record.notes.length} ملاحظة</span></div>
          {mode === "demo" && <form onSubmit={e => void saveNote(e)}>
            <label className="v2-input-label">اكتب الملاحظة
              <textarea value={noteText} maxLength={2000} rows={3}
                onChange={e => setNoteText(e.target.value)} placeholder="مثال: في الثانية 00:07 تتقدم الحركة على الكلمة المنطوقة…" />
            </label>
            <div className="v2-note-controls">
              <label className="v2-check"><input type="checkbox" checked={noteAtTime} onChange={e => setNoteAtTime(e.target.checked)} /> ربط بالوقت الحالي <b dir="ltr">{formatClock(time)}</b></label>
              <label className="v2-element-label">العنصر (اختياري)
                <input type="text" dir="ltr" value={noteElement} onChange={e => setNoteElement(e.target.value)} placeholder="camera / title" maxLength={100} />
              </label>
              <button type="submit" className="v2-primary" disabled={busy || noteText.trim().length < 2 || !version || versionChanged || syncFailed}>تسجيل ملاحظة QA</button>
            </div>
          </form>}
          {mode === "server" && <p className="v2-help">يعرض النظام ملاحظات Backend الفعلية. للحفظ الآن، استخدم «طلب تعديل» أدناه: يسجل الملاحظة ويغيّر حالة المشهد إلى «مطلوب تعديل». لا يوجد مسار مستقل للملاحظات في PR #88.</p>}
          <div className="v2-note-list">
            {record.notes.length === 0 ? <p className="v2-help">لا توجد ملاحظات مسجلة لهذا المشهد.</p> :
              record.notes.slice().reverse().map(note => <div className="v2-note" key={note.id}>
                <div><button className="v2-time-tag" type="button" disabled={note.second === undefined || !safeVideo || mode === "server"}
                  onClick={() => jump(note.second || 0)} dir="ltr">{note.second === undefined ? "عام" : formatClock(note.second)}</button>
                  {note.elementId && <code dir="ltr">{note.elementId}</code>}
                  {note.versionId && note.versionId !== version?.id &&
                    <span className="v2-help">إصدار سابق</span>}</div>
                <p>{note.text}</p>
              </div>)}
          </div>
        </section>
        <section className="v2-card v2-decision" aria-label="قرار المراجعة">
          <div className="v2-card-head"><h4>قرار المشهد</h4><span>{mode === "demo" ? "تجربة معزولة" : "قرار خادمي فقط"}</span></div>
          <p className="v2-help">اعتماد المشهد لا يتاح إلا بعد review/start ← tick ← finish بنجاح؛ الخادم يتحقق من البصمة والملفات عند القرار. طلب التعديل يحفظ ملاحظة ويغيّر الحالة صراحةً.</p>
          <label className="v2-input-label">سبب طلب التعديل
            <textarea rows={2} value={decisionReason} maxLength={2000}
              onChange={e => setDecisionReason(e.target.value)} placeholder="سبب واضح للتصحيح (مطلوب عند طلب التعديل)" /></label>
          <div className="v2-note-controls">
            <label className="v2-check"><input type="checkbox" checked={noteAtTime}
              onChange={e => setNoteAtTime(e.target.checked)}/> ربط التصحيح بالوقت <b dir="ltr">{formatClock(time)}</b></label>
            <label className="v2-element-label">العنصر المرتبط بالتصحيح (اختياري)
              <input type="text" dir="ltr" value={noteElement} onChange={e => setNoteElement(e.target.value)}
                placeholder="camera / title" maxLength={100}/>
            </label>
          </div>
          <div className="v2-decision-buttons">
            <button type="button" className="v2-danger" disabled={!canRequestChanges} onClick={() => void decide("request_changes")}>طلب تعديل وتسجيل التصحيح</button>
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
            <div className="v2-card-head"><h4>النص المنطوق</h4><span>{!seed ? "بيانات غير متاحة" : seed.narration.trim() ? "تعليق صوتي" : "مشهد صامت"}</span></div>
            <p className="v2-narration">{!seed ? "لا يعيد Backend V2 نص المشهد حتى الآن؛ لا يمكن استنتاج صمته من غياب البيانات." :
              seed.narration.trim() || "مشهد صامت وفق الخطة الحالية؛ راجع الصوت المحيط والمؤثرات إن وجدت."}</p>
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
              <dt>مدة MP4</dt><dd dir="ltr">{avDuration ? formatClock(avDuration) : "—"}</dd>
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
            <div className="v2-fingerprint"><span>{mode === "server" ?
            "بصمة المشهد الحالية من Backend (لا يعرض الخادم رقم إصدار)" :
            "معرف النسخة المرتبط بالمراجعة"}</span>
              <code dir="ltr">{version?.fingerprint || "—"}</code></div>
            {comparedDiffs?.length ? <div className="v2-diffs">
              <p className="v2-help">الفروقات مقارنة بالإصدار {compare?.label}.</p>
              {comparedDiffs.map((d, i) => <div key={i}><strong>{d.field}</strong><del>{d.before}</del><ins>{d.after}</ins></div>)}
            </div> : <p className="v2-help">لم يرسل Backend قائمة فروقات لهذه النسخة.</p>}
            <p className="v2-help">{mode === "server" ? "الواجهة تعرض بصمة المشهد الحالية فقط؛ Backend لا يرسل قائمة إصدارات قديمة." : "المشغل يعرض النسخة الحالية فقط، والإصدارات القديمة للمقارنة الوصفية."}</p>
          </section>
        </div>
      </aside>
    </div>}
  </section>;
};
