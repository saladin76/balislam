/**
 * «دليل الاستوديو»: يعرض مرجع القناة الدائم (docs/<القناة>/) كما هو في المستودع، للقراءة فقط.
 * التعديل يكون في الملفات نفسها مع كل تغيير (قاعدة التحديث الإلزامي)، فلا نسخة ثانية تختلف عنها.
 */
import React, { useEffect, useState } from "react";
import { api } from "../api";
import { Markdown } from "../ui/Markdown";
import type { GuideIndex } from "../../../src/channel/guide";
import { ownerText } from "../../../src/i18n/sceneNames";
import { OwnerText } from "../ui/OwnerText";

export const GuideTab: React.FC<{ channel: string }> = ({ channel }) => {
  const [index, setIndex] = useState<GuideIndex | null | undefined>(undefined);
  const [file, setFile] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    setIndex(undefined);
    api.guideIndex(channel).then((r) => {
      setIndex(r.index);
      setFile(r.index?.entries[0]?.file ?? "");
    }, (e: Error) => setErr(e.message));
  }, [channel]);

  useEffect(() => {
    if (!file) return;
    setText("");
    setErr("");
    api.guidePage(channel, file).then((r) => setText(r.text), (e: Error) => setErr(e.message));
  }, [channel, file]);

  if (index === undefined && !err) return <div className="panel"><p className="muted">جارٍ تحميل الدليل…</p></div>;
  if (!index) return <div className="panel"><p className="muted">{err || "لا دليل استوديو لهذه القناة بعد."}</p></div>;

  // روابط بين صفحات الدليل تفتح داخله؛ ما سواها مسار في المستودع يُعرض للعلم
  const onLink = (href: string) => {
    const name = href.replace(/^\.\//, "").split("#")[0]!;
    if (index.entries.some((e) => e.file === name)) setFile(name);
  };

  return (
    <div className="guide-tab" dir="rtl">
      <aside className="guide-toc">
        <div className="guide-title">{index.title}</div>
        <nav>
          {index.entries.map((e) => (
            <button key={e.file} className={e.file === file ? "active" : ""} onClick={() => setFile(e.file)} title={e.summary}>
              {ownerText(e.title)}
            </button>
          ))}
        </nav>
        <p className="muted guide-note">للقراءة فقط. المصدر: <code dir="ltr">docs/{index.channel}/</code> في المستودع، ويُحدَّث مع كل تغيير.</p>
      </aside>
      <article className="guide-page">{err ? <p className="err"><OwnerText text={err} /></p> : text ? <Markdown text={text} onLink={onLink} /> : <p className="muted">جارٍ التحميل…</p>}</article>
    </div>
  );
};
