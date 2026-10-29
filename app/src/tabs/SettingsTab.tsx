import React, { useEffect, useState } from "react";
import { api, type KeyState } from "../api";

type TestResult = Awaited<ReturnType<typeof api.testService>>;

const KeyInput: React.FC<{ id: string; label: string; state?: { set: boolean; preview: string }; secret?: boolean; onSave: (v: string) => Promise<void>; placeholder?: string }> = ({ id, label, state, secret = true, onSave, placeholder }) => {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="key-row"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave(v);
          setV("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      <span className={`key-state ${state?.set ? "on" : ""}`}>{state?.set ? `محفوظ ${state.preview}` : "غير مضاف"}</span>
      <input id={id} type={secret ? "password" : "text"} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder ?? (state?.set ? "الصق قيمة جديدة للاستبدال" : "الصق هنا")} dir="ltr" autoComplete="off" spellCheck={false} />
      <button className="btn small" disabled={!v.trim() || busy} type="submit">حفظ</button>
      {state?.set ? (
        <button className="btn ghost small" type="button" onClick={() => onSave("")}>حذف</button>
      ) : null}
    </form>
  );
};

/** المفاتيح: تُحفظ في ملف .env على هذا الجهاز فقط، ولا تظهر قيمها السرية في الواجهة أبدًا. */
export const SettingsTab: React.FC<{ onKeysChanged: () => void }> = ({ onKeysChanged }) => {
  const [keys, setKeys] = useState<KeyState | null>(null);
  const [el, setEl] = useState<TestResult | null>(null);
  const [qf, setQf] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    api.keys().then((r) => setKeys(r.keys)).catch(() => {});
  }, []);
  const save = async (updates: Record<string, string>) => {
    const r = await api.saveKeys(updates);
    setKeys(r.keys);
    onKeysChanged();
  };
  const test = async (service: "elevenlabs" | "quran") => {
    setBusy(service);
    try {
      const r = await api.testService(service);
      if (service === "elevenlabs") setEl(r);
      else setQf(r);
    } finally {
      setBusy("");
    }
  };
  if (!keys) return <div className="empty-state"><h2>جارٍ التحميل…</h2></div>;
  const voiceId = keys.ELEVENLABS_VOICE_ID?.preview ?? "";

  return (
    <div className="settings-tab">
      <h2>الإعدادات والمفاتيح</h2>
      <div className="note">المفاتيح تُحفظ في ملف ‎.env‎ داخل مجلد المشروع على هذا الجهاز فقط. لا تُرفع إلى GitHub، ولا تُرسل إلى أي مكان غير الخدمة نفسها، ولا تُكتب في المحادثات.</div>

      <section className="group">
        <h3>ElevenLabs <small>الصوت المستنسخ والمؤثرات</small></h3>
        <ol className="steps">
          <li>افتح صفحة المفاتيح في حسابك: <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noreferrer">elevenlabs.io ← API Keys</a>، واضغط «Create API Key».</li>
          <li>الصق المفتاح هنا واضغط «حفظ».</li>
          <li>اضغط «اختبر الاتصال»، ثم اختر صوتك المستنسخ من القائمة.</li>
        </ol>
        <KeyInput id="k-el" label="المفتاح" state={keys.ELEVENLABS_API_KEY} onSave={(v) => save({ ELEVENLABS_API_KEY: v })} placeholder="sk_…" />
        <div className="key-row">
          <label>الصوت</label>
          <span className={`key-state ${voiceId ? "on" : ""}`}>{voiceId ? voiceId : "لم يُختر"}</span>
          <span className="spacer" />
          <button className="btn primary small" disabled={!keys.ELEVENLABS_API_KEY?.set || busy === "elevenlabs"} onClick={() => test("elevenlabs")}>
            {busy === "elevenlabs" ? "جارٍ الاختبار…" : "اختبر الاتصال"}
          </button>
        </div>
        {el ? (
          el.ok ? (
            <div className="test-ok">
              <b>الاتصال يعمل ✓</b>
              {el.account ? (
                <span className="help">
                  الخطة: {el.account.tier} · المستخدَم {el.account.character_count.toLocaleString("ar")} من {el.account.character_limit.toLocaleString("ar")} حرف
                </span>
              ) : null}
              <span className="help">{el.voiceFound ? "الصوت المختار موجود في حسابك." : "اختر صوتك من القائمة:"}</span>
              <div className="voices">
                {(el.voices ?? [])
                  .sort((a, b) => (a.category === "professional" || a.category === "cloned" ? -1 : 1) - (b.category === "professional" || b.category === "cloned" ? -1 : 1))
                  .map((v) => (
                    <button key={v.id} className={`voice ${v.id === voiceId ? "on" : ""}`} onClick={() => save({ ELEVENLABS_VOICE_ID: v.id })}>
                      <b>{v.name}</b>
                      <span className="help">{v.category === "professional" ? "استنساخ احترافي" : v.category === "cloned" ? "استنساخ فوري" : v.category}</span>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <div className="note err">{el.message}</div>
          )
        ) : null}
        <KeyInput id="k-model" label="النموذج (اختياري)" secret={false} state={keys.ELEVENLABS_MODEL_ID} onSave={(v) => save({ ELEVENLABS_MODEL_ID: v })} placeholder="eleven_multilingual_v2" />
      </section>

      <section className="group">
        <h3>Quran Foundation <small>نصوص الآيات بالرسم العثماني</small></h3>
        <ol className="steps">
          <li>سجّل في بوابة المطورين: <a href="https://api-docs.quran.foundation/docs/quickstart" target="_blank" rel="noreferrer">api-docs.quran.foundation</a> واطلب مفاتيح Content API.</li>
          <li>الصق Client ID وClient Secret، واختر البيئة (prelive للتجربة، production بعد الموافقة).</li>
          <li>اضغط «اختبر الاتصال»: تظهر البسملة إن نجح.</li>
        </ol>
        <KeyInput id="k-qf-id" label="Client ID" state={keys.QF_CLIENT_ID} onSave={(v) => save({ QF_CLIENT_ID: v })} />
        <KeyInput id="k-qf-secret" label="Client Secret" state={keys.QF_CLIENT_SECRET} onSave={(v) => save({ QF_CLIENT_SECRET: v })} />
        <div className="key-row">
          <label htmlFor="k-qf-env">البيئة</label>
          <select id="k-qf-env" value={keys.QF_ENV?.preview || "prelive"} onChange={(e) => save({ QF_ENV: e.target.value })} style={{ width: 180 }}>
            <option value="prelive">prelive (تجربة)</option>
            <option value="production">production</option>
          </select>
          <span className="spacer" />
          <button className="btn primary small" disabled={!keys.QF_CLIENT_ID?.set || !keys.QF_CLIENT_SECRET?.set || busy === "quran"} onClick={() => test("quran")}>
            {busy === "quran" ? "جارٍ الاختبار…" : "اختبر الاتصال"}
          </button>
        </div>
        {qf ? qf.ok ? <div className="test-ok"><b>الاتصال يعمل ✓</b><span style={{ fontFamily: "Amiri, serif", fontSize: 24 }}>{qf.sample}</span></div> : <div className="note err">{qf.message}</div> : null}
      </section>
    </div>
  );
};
