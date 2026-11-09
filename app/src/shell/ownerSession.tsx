import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api";

/**
 * جلسة المالك (D49، ٩ نوفمبر): كلمة المرور تُكتب مرة في الشريط العلوي فتُرسل للخادم مرة واحدة، فيصدر
 * رمز جلسة عشوائيًا مربوطًا بهذا الجهاز. يُحفظ الرمز وحده في المتصفح (لا كلمة المرور أبدًا)، ويُرسل مع كل
 * قرار بدلها، فلا تُطلب الكلمة بعد تحديث الصفحة أو إعادة تشغيل الاستوديو. «أغلق الجلسة» يلغيه على الخادم
 * وفي المتصفح، وتغيير كلمة المرور يلغي كل الجلسات. الخادم يقبل الرمز من الجهاز نفسه فقط (loopback).
 */
export const OWNER_SESSION_STORAGE_KEY = "bal.ownerSession.v1";
const storage = {
  get: (): string => { try { return window.localStorage.getItem(OWNER_SESSION_STORAGE_KEY) ?? ""; } catch { return ""; } },
  set: (v: string) => { try { window.localStorage.setItem(OWNER_SESSION_STORAGE_KEY, v); } catch { /* private mode: session lasts this page only */ } },
  clear: () => { try { window.localStorage.removeItem(OWNER_SESSION_STORAGE_KEY); } catch { /* ignore */ } },
};
const validToken = (v: string) => /^bos_[a-f0-9]{64}$/.test(v);

type Session = { secret: string; open: boolean; passSet: boolean | null; unlock: (s: string) => Promise<void>; lock: () => Promise<void>; create: (s: string) => Promise<void> };
const Ctx = createContext<Session>({ secret: "", open: false, passSet: null, unlock: async () => {}, lock: async () => {}, create: async () => {} });

export const OwnerSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [secret, setSecret] = useState(() => { const t = storage.get(); return validToken(t) ? t : ""; });
  const [passSet, setPassSet] = useState<boolean | null>(null);
  useEffect(() => { void api.ownerPassphrase().then((r) => setPassSet(r.set), () => setPassSet(null)); }, []);
  // بعد التحديث أو إعادة التشغيل: الرمز المحفوظ يُتحقق منه بصمت؛ المُلغى (أُغلقت الجلسة أو تغيّرت الكلمة) يُمحى.
  useEffect(() => {
    const verify = () => {
      const t = storage.get();
      if (!validToken(t)) { if (t) storage.clear(); setSecret(""); return; }
      void api.ownerSessionStatus(t).then((r) => {
        if (r.open) setSecret(t);
        else { storage.clear(); setSecret(""); }
      }, () => { /* server unreachable (restarting): keep it; the server refuses anything invalid */ });
    };
    verify();
    const onVisible = () => { if (document.visibilityState === "visible") verify(); };
    const onStorage = (e: StorageEvent) => { if (e.key === OWNER_SESSION_STORAGE_KEY) verify(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("storage", onStorage);
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("storage", onStorage); };
  }, []);
  const open = async (passphrase: string) => {
    const r = await api.openOwnerSession(passphrase);
    if (!r.ok || !r.token || !validToken(r.token)) throw new Error("كلمة المرور غير صحيحة.");
    storage.set(r.token);
    setSecret(r.token);
  };
  const value: Session = {
    secret, open: Boolean(secret), passSet,
    unlock: open,
    lock: async () => {
      const t = secret || storage.get();
      storage.clear();
      setSecret("");
      if (validToken(t)) await api.closeOwnerSession(t).catch(() => undefined);
    },
    create: async (s) => {
      await api.setOwnerPassphrase(s);
      setPassSet(true);
      await open(s);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
export const useOwnerSession = () => useContext(Ctx);

/** زر الجلسة في الشريط العلوي: يفتحها بكلمة المرور، أو ينشئ كلمة المرور أول مرة. */
export const OwnerSessionButton: React.FC = () => {
  const s = useOwnerSession();
  const [show, setShow] = useState(false);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!show) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setShow(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [show]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      if (s.passSet === false) {
        if (a.length < 8) throw new Error("ثمانية أحرف على الأقل.");
        if (a !== b) throw new Error("الكلمتان غير متطابقتين.");
        await s.create(a);
      } else await s.unlock(a);
      setA(""); setB(""); setShow(false);
    } catch (x) { setErr((x as Error).message); }
  };
  return (
    <div className="ow" ref={box}>
      <button type="button" className={`ow-btn${s.open ? " is-open" : ""}`} aria-expanded={show} onClick={() => setShow((v) => !v)}
        title={s.open ? "جلسة المالك مفتوحة على هذا الجهاز" : "فتح جلسة المالك للاعتماد"}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d={s.open ? "M8 11V8a4 4 0 0 1 7.5-2" : "M8 11V8a4 4 0 0 1 8 0v3"} />
        </svg>
        {s.open ? "جلسة المالك مفتوحة" : "الاعتماد مقفل"}
      </button>
      {show && s.open ? (
        <div className="ow-pop" role="menu">
          <strong>جلسة المالك مفتوحة</strong>
          <p>تبقى مفتوحة على هذا الجهاز بعد التحديث وإعادة التشغيل، حتى تغلقها أو تغيّر كلمة المرور.</p>
          <button className="btn" type="button" role="menuitem" onClick={() => { setShow(false); void s.lock(); }}>أغلق الجلسة</button>
        </div>
      ) : show ? (
        <form className="ow-pop" onSubmit={submit}>
          <strong>{s.passSet === false ? "اختر كلمة مرور المالك" : "افتح جلسة المالك"}</strong>
          <p>{s.passSet === false
            ? "كل اعتماد في الاستوديو يحتاجها، فلا يعتمد شيئًا غيرك. تُحفظ بصمتها فقط على جهازك."
            : "تُكتب مرة واحدة: تبقى الجلسة مفتوحة على هذا الجهاز حتى تغلقها."}</p>
          <input type="password" autoFocus autoComplete={s.passSet === false ? "new-password" : "current-password"} value={a} onChange={(e) => setA(e.target.value)} aria-label="كلمة المرور" placeholder="كلمة المرور" />
          {s.passSet === false ? <input type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} aria-label="إعادة كلمة المرور" placeholder="أعد كتابتها" /> : null}
          {err ? <span className="ow-err" role="alert">{err}</span> : null}
          <button className="btn primary" type="submit">{s.passSet === false ? "حفظ وفتح الجلسة" : "فتح الجلسة"}</button>
        </form>
      ) : null}
    </div>
  );
};
