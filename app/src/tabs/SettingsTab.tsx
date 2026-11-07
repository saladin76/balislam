import React, { useEffect, useState } from "react";
import { api, type KeyState } from "../api";

type TestResult = Awaited<ReturnType<typeof api.testService>>;

const KeyInput: React.FC<{ id: string; label: string; state?: { set: boolean; preview: string }; secret?: boolean; onSave: (v: string) => Promise<void>; placeholder?: string }> = ({ id, label, state, secret = true, onSave, placeholder }) => {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [fieldStatus, setFieldStatus] = useState("");
  return (
    <form
      className="key-row"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setFieldError(""); setFieldStatus("");
        try {
          await onSave(v);
          setV("");
          setFieldStatus("تم حفظ الإعداد.");
        } catch (x) {
          setFieldError(`تعذّر الحفظ: ${(x as Error).message}`);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      <span className={`key-state ${state?.set ? "on" : ""}`}>{state?.set ? <>محفوظ <bdi dir="ltr">{state.preview}</bdi></> : "غير مضاف"}</span>
      <input id={id} type={secret ? "password" : "text"} value={v} onChange={(e) => { setV(e.target.value); setFieldError(""); setFieldStatus(""); }} placeholder={placeholder ?? (state?.set ? "الصق قيمة جديدة للاستبدال" : "الصق هنا")} dir="ltr" autoComplete="off" spellCheck={false} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `${id}-error` : fieldStatus ? `${id}-status` : undefined} />
      <button className="btn small" disabled={!v.trim() || busy} type="submit">{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
      {state?.set ? (
        <button className="btn ghost small" type="button" disabled={busy} onClick={async () => {
          if (!window.confirm(`سيُزال «${label}» من ملف إعدادات الاستوديو النشط. قد يؤثر ذلك في جميع نسخ الاستوديو التي تستخدم الملف المشترك. هل تؤكد الإزالة؟`)) return;
          setBusy(true); setFieldError(""); setFieldStatus("");
          try { await onSave(""); setFieldStatus("تم حذف الإعداد."); }
          catch (x) { setFieldError(`تعذّر الحذف: ${(x as Error).message}`); }
          finally { setBusy(false); }
        }}>حذف</button>
      ) : null}
      {fieldError && <span className="key-feedback error" id={`${id}-error`} role="alert">{fieldError}</span>}
      {fieldStatus && <span className="key-feedback" id={`${id}-status`} role="status">{fieldStatus}</span>}
    </form>
  );
};

/** المفاتيح: تُحفظ في ملف .env على هذا الجهاز فقط، ولا تظهر قيمها السرية في الواجهة أبدًا. */
export const SettingsTab: React.FC<{ onKeysChanged: () => void }> = ({ onKeysChanged }) => {
  const [keys, setKeys] = useState<KeyState | null>(null);
  const [el, setEl] = useState<TestResult | null>(null);
  const [busy, setBusy] = useState("");
  const [loadErr, setLoadErr] = useState("");
  useEffect(() => {
    api.keys().then((r) => setKeys(r.keys)).catch((x) => setLoadErr((x as Error).message));
  }, []);
  const save = async (updates: Record<string, string>) => {
    const r = await api.saveKeys(updates);
    setKeys(r.keys);
    onKeysChanged();
  };
  const test = async (service: "elevenlabs") => {
    setBusy(service);
    try {
      const r = await api.testService(service);
      setEl(r);
    } catch (x) {
      const r = { ok: false, message: (x as Error).message };
      setEl(r);
    } finally {
      setBusy("");
    }
  };
  if (!keys) return <div className="empty-state"><h2>{loadErr ? `تعذّر التحميل: ${loadErr}` : "جارٍ التحميل…"}</h2></div>;
  const voiceId = keys.ELEVENLABS_VOICE_ID?.preview ?? "";

  return (
    <div className="settings-tab">
      <h2>الإعدادات والمفاتيح</h2>
      <div className="note">المفاتيح لا تُرفع إلى GitHub. كل مجلد عمل يستخدم ملف ‎.env‎ الخاص به، إلا إذا حددت ملفًا مشتركًا عبر متغير البيئة BAL_ENV_FILE قبل تشغيل الاستوديو. ظهور «غير مضاف» لا يعني حذف المفتاح من مجلد مشروع آخر. لا تشارك محتوى الملف أو لقطة تظهر أسراره.</div>

      <details className="group studio-provider">
        <summary><strong>ElevenLabs</strong> <span>الصوت المستنسخ والمؤثرات</span> <em>{keys.ELEVENLABS_API_KEY?.set ? "المفتاح موجود" : "يحتاج إعدادًا"}</em></summary>
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
        {el?.ok && el.models?.length ? (
          <ModelPicker el={el} current={el.model ?? ""} onPick={async (id) => { await save({ ELEVENLABS_MODEL_ID: id }); await test("elevenlabs"); }} />
        ) : (
          <KeyInput id="k-model" label="النموذج (اختياري)" secret={false} state={keys.ELEVENLABS_MODEL_ID} onSave={(v) => save({ ELEVENLABS_MODEL_ID: v })} placeholder="eleven_v4" />
        )}
      </details>

      <section className="group studio-provider">
        <strong>الآيات والتلاوة</strong>
        <p className="help">لا تحتاج مفاتيح قرآن إضافية. افتح «صوت الحلقة» لنسخ قائمة الآيات المطلوبة، ثم اكتب نصها في السكريبت وارفع التلاوة المختارة باسم قارئها. توجد معاينة اختيارية عبر AlQuran Cloud.</p>
      </section>
    </div>
  );
};

const TRAINING_AR: Record<string, string> = { fine_tuned: "مدرَّب ✓", fine_tuning: "قيد التدريب…", not_started: "غير مدرَّب", queued: "في الانتظار", failed: "فشل التدريب", delayed: "مؤجَّل" };

/**
 * نموذج الصوت: النماذج الموصى بها أولًا، مع دعم العربية وحالة تدريب صوتك الاحترافي على كل نموذج.
 * الصوت الاحترافي لا يعمل على نموذج حتى يُدرَّب عليه في ElevenLabs.
 */
const ModelPicker: React.FC<{ el: NonNullable<Awaited<ReturnType<typeof api.testService>>>; current: string; onPick: (id: string) => void }> = ({ el, current, onPick }) => {
  const pro = el.voiceCategory === "professional";
  const order = ["eleven_v4", "eleven_v3", "eleven_multilingual_v2"];
  const list = [...(el.models ?? [])].filter((m) => m.arabic || order.includes(m.id)).sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));
  const state = (id: string) => el.training?.[id];
  const ready = (id: string) => !pro || state(id) === "fine_tuned";
  return (
    <div className="field">
      <span>نموذج الصوت <small>(الأحدث أعلى جودة وأدق في النبرة؛ صوتك الاحترافي يحتاج تدريبًا على كل نموذج)</small></span>
      <div className="voices">
        {list.map((m) => (
          <button key={m.id} className={`voice ${m.id === current ? "on" : ""}`} onClick={() => onPick(m.id)}>
            <b>{m.name}</b>
            <span className="help" dir="ltr">{m.id}</span>
            <span className="help">{m.arabic ? "يدعم العربية" : "العربية غير مذكورة"}{pro ? ` · ${TRAINING_AR[state(m.id) ?? "not_started"] ?? state(m.id)}` : ""}</span>
          </button>
        ))}
      </div>
      {pro && current && !ready(current) ? (
        <div className="note err">
          صوتك غير مدرَّب بعد على {current}، فلن يُولَّد به صوت حتى يكتمل التدريب. في ElevenLabs: <b>My Voices</b> ← مرّر على صوتك ← زر <b>+</b> بجانب النموذج، وانتظر حتى يصبح «مدرَّب ✓» هنا (اضغط «اختبر الاتصال» للتحديث).
        </div>
      ) : null}
    </div>
  );
};
