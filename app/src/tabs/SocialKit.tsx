import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { CHAPTERS_TOKEN, checkCaption, checkDescription, checkTitle, resolveDescription, RULES, type Check, type PublishKit, type ShortKit } from "../../../src/package/social";

const copy = (text: string, done: (m: string) => void) => {
  navigator.clipboard.writeText(text).then(() => done("نُسخ")).catch(() => done("تعذّر النسخ"));
};

const Checks: React.FC<{ list: Check[] }> = ({ list }) => (
  <div className="kit-checks">
    {list.map((c, i) => (
      <span key={i} className={`kit-check ${c.ok ? "ok" : "warn"}`}>{c.ok ? "✓" : "!"} {c.label}</span>
    ))}
  </div>
);

/** حقل نصي قابل للتعديل مع زر نسخ وفحوصه. */
const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; rows?: number; checks?: Check[]; copyText?: string; hint?: string; dir?: "rtl" | "ltr" }> = ({ label, value, onChange, rows = 1, checks, copyText, hint, dir }) => {
  const [flash, setFlash] = useState("");
  return (
    <div className="kit-field">
      <div className="kit-field-head">
        <b>{label}</b>
        {hint ? <span className="help">{hint}</span> : null}
        <span className="spacer" />
        {flash ? <span className="help">{flash}</span> : null}
        <button className="btn small" onClick={() => copy(copyText ?? value, (m) => { setFlash(m); setTimeout(() => setFlash(""), 1200); })}>نسخ</button>
      </div>
      {rows > 1 ? <textarea rows={rows} value={value} dir={dir} onChange={(e) => onChange(e.target.value)} /> : <input type="text" value={value} dir={dir} onChange={(e) => onChange(e.target.value)} />}
      {checks ? <Checks list={checks} /> : null}
    </div>
  );
};

const tagsText = (t: string[]) => t.join(" ");
const parseTags = (s: string) => s.split(/[\s,،]+/).map((x) => x.trim()).filter(Boolean).map((x) => (x.startsWith("#") ? x : `#${x}`));

/**
 * «حزمة الانتشار»: لكل منصة عنوان وكابشن وهاشتاجات مطابقة لطريقة عمل خوارزميتها،
 * مع فحص فوري (الطول، كلمة البحث في البداية، عدد الهاشتاجات، سؤال للتعليقات).
 */
export const SocialKit: React.FC<{ episodeId: string }> = ({ episodeId }) => {
  const [kit, setKit] = useState<PublishKit | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [chapters, setChapters] = useState("");
  const [view, setView] = useState<"long" | number>("long");
  const [state, setState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [err, setErr] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.kit(episodeId).then((r) => { setKit(r.kit); setKeywords(r.keywords); setChapters(r.chapters); }).catch((e) => setErr((e as Error).message));
  }, [episodeId]);

  if (err) return <div className="render-box"><b>حزمة الانتشار</b><span className="help">{err}</span></div>;
  if (!kit) return <div className="render-box"><span className="help">جارٍ تجهيز حزمة الانتشار…</span></div>;

  const update = (next: PublishKit) => {
    setKit(next);
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setState("saving");
      try {
        await api.saveKit(episodeId, next);
        setState("saved");
      } catch {
        setState("error");
      }
    }, 800);
  };
  const L = kit.long;
  const setLong = (patch: Partial<PublishKit["long"]>) => update({ ...kit, long: { ...L, ...patch } });
  const setShort = (i: number, patch: Partial<ShortKit>) => update({ ...kit, shorts: kit.shorts.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const sh = typeof view === "number" ? kit.shorts[view] : undefined;
  const source = kit.generatedBy === "claude" ? "كتبها Claude لهذه الحلقة" : kit.generatedBy === "edited" ? "معدّلة منك" : "نسخة آلية من السكريبت";

  return (
    <div className="render-box kit">
      <div className="toolbar">
        <b style={{ fontSize: 16 }}>حزمة الانتشار</b>
        <span className="badge">{source}</span>
        <span className="help">{state === "saved" ? "محفوظة" : state === "saving" ? "جارٍ الحفظ…" : state === "dirty" ? "تعديل…" : "تعذّر الحفظ"}</span>
        <span className="spacer" />
        <button
          className="btn ghost small"
          onClick={async () => {
            if (!window.confirm("استبدال الحزمة كلها بنسخة آلية جديدة من السكريبت؟ ستضيع تعديلاتك عليها.")) return;
            const r = await api.regenerateKit(episodeId);
            setKit(r.kit);
            setKeywords(r.keywords);
          }}
        >
          اقتراح آلي من جديد
        </button>
      </div>
      <div className="kit-keywords">
        <span className="help">كلمات البحث في هذه الحلقة (استعملها في أول العنوان والوصف والكابشن):</span>
        {keywords.map((k) => <span key={k} className="chip">{k}</span>)}
      </div>
      <div className="seg kit-tabs" role="group" aria-label="المنصة">
        <button aria-pressed={view === "long"} onClick={() => setView("long")}>الحلقة (يوتيوب وفيسبوك)</button>
        {kit.shorts.map((s, i) => <button key={i} aria-pressed={view === i} onClick={() => setView(i)}>شورت {s.chapter}</button>)}
      </div>

      {view === "long" ? (
        <div className="kit-grid">
          <div className="kit-col">
            <h4>يوتيوب: العناوين <small>جرّبها في «اختبار العناوين» في يوتيوب ستوديو</small></h4>
            {L.titles.map((t, i) => (
              <Field
                key={i}
                label={`${i + 1}. ${t.angle}`}
                value={t.text}
                onChange={(v) => setLong({ titles: L.titles.map((x, k) => (k === i ? { ...x, text: v } : x)) })}
                checks={checkTitle(t.text, "youtube", keywords)}
              />
            ))}
            <Field label="الوصف" rows={12} value={L.description} onChange={(v) => setLong({ description: v })} copyText={resolveDescription(L.description, chapters)} checks={checkDescription(resolveDescription(L.description, chapters), keywords, L.hashtags)} hint={`أول سطرين يظهران قبل «المزيد». ${CHAPTERS_TOKEN} يُستبدل بتوقيت الفصول عند النسخ`} />
            <Field label="الوسوم (Tags)" rows={2} value={L.tags.join(", ")} onChange={(v) => setLong({ tags: v.split(/[,،]\s*/).map((x) => x.trim()).filter(Boolean) })} hint={`${L.tags.join(",").length}/${RULES.youtube.tagsChars} حرف`} />
          </div>
          <div className="kit-col">
            <Field label="هاشتاجات الوصف" value={tagsText(L.hashtags)} onChange={(v) => setLong({ hashtags: parseTags(v) })} hint="أول 3 تظهر فوق العنوان" />
            <Field label="تعليق مثبّت" rows={4} value={L.pinnedComment} onChange={(v) => setLong({ pinnedComment: v })} hint="يفتح النقاش في أول ساعة" />
            <Field label="نصوص الصورة المصغّرة" rows={3} value={L.thumbnailTexts.join("\n")} onChange={(v) => setLong({ thumbnailTexts: v.split("\n") })} hint="كلمتان إلى أربع، لا تكرر العنوان" />
            <Field label="فيسبوك: منشور الحلقة" rows={8} value={L.facebook} onChange={(v) => setLong({ facebook: v })} checks={checkCaption(L.facebook, parseTags(L.facebook.match(/#\S+/g)?.join(" ") ?? ""), "facebook", keywords)} />
          </div>
        </div>
      ) : sh ? (
        <>
          <Field label="الخطاف: أول ثانيتين على الشاشة" value={sh.hook} onChange={(v) => setShort(view as number, { hook: v })} hint="هذا ما يقرر هل يكمل المشاهد" />
          <div className="kit-grid three">
            <div className="kit-col">
              <h4>يوتيوب شورتس</h4>
              <Field label="العنوان" value={sh.youtube.title} onChange={(v) => setShort(view as number, { youtube: { ...sh.youtube, title: v } })} checks={checkTitle(sh.youtube.title, "youtubeShorts", keywords)} />
              <Field label="الوصف" rows={7} value={sh.youtube.description} onChange={(v) => setShort(view as number, { youtube: { ...sh.youtube, description: v } })} hint="ضع رابط الحلقة في «الفيديو المرتبط»" />
            </div>
            <div className="kit-col">
              <h4>إنستجرام ريلز</h4>
              <Field
                label="الكابشن"
                rows={9}
                value={sh.instagram.caption}
                onChange={(v) => setShort(view as number, { instagram: { ...sh.instagram, caption: v } })}
                copyText={`${sh.instagram.caption}\n\n${sh.instagram.hashtags.join(" ")}`}
                checks={checkCaption(sh.instagram.caption, sh.instagram.hashtags, "instagram", keywords)}
              />
              <Field label="الهاشتاجات" value={tagsText(sh.instagram.hashtags)} onChange={(v) => setShort(view as number, { instagram: { ...sh.instagram, hashtags: parseTags(v) } })} hint="5 كحد أقصى" />
            </div>
            <div className="kit-col">
              <h4>فيسبوك ريلز</h4>
              <Field
                label="الكابشن"
                rows={6}
                value={sh.facebook.caption}
                onChange={(v) => setShort(view as number, { facebook: { ...sh.facebook, caption: v } })}
                copyText={`${sh.facebook.caption}\n\n${sh.facebook.hashtags.join(" ")}`}
                checks={checkCaption(sh.facebook.caption, sh.facebook.hashtags, "facebook", keywords)}
              />
              <Field label="الهاشتاجات" value={tagsText(sh.facebook.hashtags)} onChange={(v) => setShort(view as number, { facebook: { ...sh.facebook, hashtags: parseTags(v) } })} hint="1–3" />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
