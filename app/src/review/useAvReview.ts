import { useCallback, useEffect, useRef, useState } from "react";
import type { AvReviewStart, ReviewAdapter } from "./model";

export type AvState = "idle" | "starting" | "watching" | "ended" |
  "finishing" | "completed" | "invalid";

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Drives the real Backend V2 challenge protocol. Local time, video events and
 * status never confer approval; only a successful server finish + explicit
 * owner /commands approve can do that. Any seek, speedup, mute or media error
 * poisons the current receipt and requires a fresh review/start.
 */
export function useAvReview(
  adapter: ReviewAdapter, mode: "server" | "demo",
  sceneId: string, fingerprint?: string
) {
  const [session, setSession] = useState<AvReviewStart | null>(null);
  const [status, setStatus] = useState<AvState>("idle");
  const [error, setError] = useState("");
  const [playedSec, setPlayedSec] = useState(0);
  const active = useRef(0);
  const latest = useRef<{
    receipt: AvReviewStart; challenge: string; playedSec: number;
    lastAt: number; inflight: boolean; poisoned: boolean;
  } | null>(null);

  const reset = useCallback(() => {
    active.current++;
    latest.current = null; setSession(null); setPlayedSec(0);
    setStatus("idle"); setError("");
  }, []);
  useEffect(() => reset(), [adapter, sceneId, fingerprint, reset]);

  const invalidate = useCallback((reason: string) => {
    const current = latest.current;
    if (!current) return;
    current.poisoned = true;
    setStatus("invalid"); setError(reason);
  }, []);

  const start = useCallback(async () => {
    if (mode !== "server" || !fingerprint || !sceneId) return;
    const epoch = ++active.current;
    latest.current = null; setSession(null); setPlayedSec(0); setError("");
    setStatus("starting");
    try {
      const receipt = await adapter.startReview(sceneId, fingerprint);
      if (epoch !== active.current) return;
      latest.current = {
        receipt, challenge: receipt.challenge, playedSec: 0,
        lastAt: Date.now(), inflight: false, poisoned: false,
      };
      setSession(receipt);
      setStatus("watching");
    } catch (e) {
      if (epoch !== active.current) return;
      setStatus("invalid");
      setError((e as Error).message || "تعذر بدء مراجعة AV على الخادم.");
    }
  }, [adapter, fingerprint, mode, sceneId]);

  const tick = useCallback(async (video: HTMLVideoElement, force = false): Promise<boolean> => {
    const r = latest.current;
    if (!r || r.poisoned || r.inflight || !session ||
        r.receipt.reviewId !== session.reviewId) return false;
    if (video.muted || video.volume <= 0 || video.playbackRate !== 1) {
      invalidate("لا يمكن اعتماد مشاهدة صامتة أو بسرعة غير 1×. أعد المراجعة.");
      return false;
    }
    const now = Date.now();
    if (!force && (video.paused || video.seeking || now - r.lastAt < 1150)) return false;
    const position = Math.min(r.receipt.durationSec, video.currentTime);
    if (!Number.isFinite(position) || position <= r.playedSec + 0.05) return false;
    if (now - r.lastAt < 850) return false;
    r.inflight = true;
    const epoch = active.current;
    try {
      const ack = await adapter.tickReview(sceneId, r.receipt.reviewId,
        r.challenge, Number(position.toFixed(3)));
      if (epoch !== active.current || r.poisoned) return false;
      if (ack.playedSec < r.playedSec || ack.playedSec > position + 0.001)
        throw Error("Backend أعاد تقدمًا غير متوافق مع التشغيل.");
      r.challenge = ack.challenge;
      r.playedSec = ack.playedSec;
      r.lastAt = Date.now();
      setPlayedSec(r.playedSec);
      return true;
    } catch (e) {
      if (epoch === active.current)
        invalidate((e as Error).message || "رفض Backend نقطة متابعة التشغيل.");
      return false;
    } finally { r.inflight = false; }
  }, [adapter, invalidate, sceneId, session]);

  const onTimeUpdate = useCallback((video: HTMLVideoElement) => {
    if (status === "watching") void tick(video);
  }, [status, tick]);

  const onSeeking = useCallback(() => {
    if (mode === "server" && session)
      invalidate("تم تخطي الفيديو؛ انتهت صلاحية دليل المشاهدة. ابدأ مراجعة جديدة.");
  }, [mode, session, invalidate]);
  const onRateChange = useCallback((video: HTMLVideoElement) => {
    if (mode === "server" && session && video.playbackRate !== 1) {
      invalidate("تغيير سرعة المشاهدة يبطل هذه الجلسة. ابدأ مراجعة جديدة.");
      video.playbackRate = 1;
    }
  }, [mode, session, invalidate]);
  const onVolumeChange = useCallback((video: HTMLVideoElement) => {
    if (mode === "server" && session && (video.muted || video.volume <= 0))
      invalidate("كتم الصوت يبطل هذه الجلسة. ابدأ المراجعة بالصوت والصورة.");
  }, [mode, session, invalidate]);
  const onEnded = useCallback(() => {
    if (status === "watching") setStatus("ended");
  }, [status]);

  const finish = useCallback(async (video: HTMLVideoElement | null) => {
    const r = latest.current;
    if (!video || !r || r.poisoned || status !== "ended" ||
        video.muted || video.volume <= 0 || video.playbackRate !== 1 ||
        !Number.isFinite(video.duration) || video.currentTime < video.duration - 0.2)
      return;
    setStatus("finishing"); setError("");
    const epoch = active.current;
    // Wait for an in-flight checkpoint, then send the final *observed*
    // media position. No invented duration/coverage proof is sent.
    while (r.inflight && epoch === active.current) await pause(50);
    if (epoch !== active.current || r.poisoned) return;
    const since = Date.now() - r.lastAt;
    if (since < 900) await pause(900 - since);
    if (epoch !== active.current || r.poisoned) return;
    if (r.playedSec < r.receipt.durationSec - 0.5) {
      const accepted = await tick(video, true);
      if (!accepted || epoch !== active.current || r.poisoned) {
        if (!r.poisoned) invalidate("لم يقبل الخادم نقطة المشاهدة النهائية. ابدأ المراجعة من جديد.");
        return;
      }
    }
    try {
      await adapter.finishReview(sceneId, r.receipt.reviewId, r.receipt.fingerprint);
      if (epoch !== active.current || r.poisoned) return;
      setStatus("completed");
    } catch (e) {
      if (epoch === active.current)
        invalidate((e as Error).message || "Backend لم يؤكد اكتمال مراجعة AV.");
    }
  }, [adapter, invalidate, sceneId, status, tick]);

  return {
    session, status, error, playedSec, reset, invalidate, start, finish,
    onTimeUpdate, onSeeking, onRateChange, onVolumeChange, onEnded,
    completed: status === "completed" && Boolean(session && !latest.current?.poisoned),
  };
}
