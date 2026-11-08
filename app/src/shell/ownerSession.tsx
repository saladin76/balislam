import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api";

/**
 * جلسة المالك: كلمة المرور تُكتب مرة في الشريط العلوي وتبقى في الذاكرة فقط (لا في المتصفح ولا في ملف)،
 * وتُرسل مع كل قرار اعتماد. إعادة تحميل الصفحة تُغلق الجلسة.
 */
type Session = { secret: string; open: boolean; passSet: boolean | null; unlock: (s: string) => Promise<void>; lock: () => void; create: (s: string) => Promise<void> };
const Ctx = createContext<Session>({ secret: "", open: false, passSet: null, unlock: async () => {}, lock: () => {}, create: async () => {} });

export const OwnerSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [secret, setSecret] = useState("");
  const [passSet, setPassSet] = useState<boolean | null>(null);
  useEffect(() => { void api.ownerPassphrase().then((r) => setPassSet(r.set), () => setPassSet(null)); }, []);
  const value: Session = {
    secret, open: Boolean(secret), passSet,
    unlock: async (s) => {
      const r = await api.checkOwnerPassphrase(s);
      if (!r.ok) throw new Error("كلمة المرور غير صحيحة.");
      setSecret(s);
    },
    lock: () => setSecret(""),
    create: async (s) => {
      await api.setOwnerPassphrase(s);
      setPassSet(true);
      setSecret(s);
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
      <button type="button" className={`ow-btn${s.open ? " is-open" : ""}`} aria-expanded={show} onClick={() => (s.open ? s.lock() : setShow((v) => !v))}
        title={s.open ? "إغلاق جلسة المالك" : "فتح جلسة المالك للاعتماد"}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d={s.open ? "M8 11V8a4 4 0 0 1 7.5-2" : "M8 11V8a4 4 0 0 1 8 0v3"} />
        </svg>
        {s.open ? "جلسة المالك مفتوحة" : "الاعتماد مقفل"}
      </button>
      {show ? (
        <form className="ow-pop" onSubmit={submit}>
          <strong>{s.passSet === false ? "اختر كلمة مرور المالك" : "افتح جلسة المالك"}</strong>
          <p>{s.passSet === false
            ? "كل اعتماد في الاستوديو يحتاجها، فلا يعتمد شيئًا غيرك. تُحفظ بصمتها فقط على جهازك."
            : "تبقى الجلسة مفتوحة حتى تغلقها أو تعيد تحميل الصفحة."}</p>
          <input type="password" autoFocus autoComplete={s.passSet === false ? "new-password" : "current-password"} value={a} onChange={(e) => setA(e.target.value)} aria-label="كلمة المرور" placeholder="كلمة المرور" />
          {s.passSet === false ? <input type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} aria-label="إعادة كلمة المرور" placeholder="أعد كتابتها" /> : null}
          {err ? <span className="ow-err" role="alert">{err}</span> : null}
          <button className="btn primary" type="submit">{s.passSet === false ? "حفظ وفتح الجلسة" : "فتح الجلسة"}</button>
        </form>
      ) : null}
    </div>
  );
};
