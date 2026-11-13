import React from "react";
import { Num } from "../../ui/format";

export type ProblemKind = "motion" | "tone";
/** ٧٢٫٤ ثانية ← «1:12» */
export const fmtTime = (sec: number) => {
  const t = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
/** ملاحظة التصحيح كما تُسجَّل: «[الحركة @0:12] …» أو «[النبرة @0:12] …» */
export const problemNote = (kind: ProblemKind, at: number, text: string) =>
  `[${kind === "motion" ? "الحركة" : "النبرة"} @${fmtTime(at)}] ${text.trim()}`.trim();

/**
 * The owner's correction note as read on screen: the stored «[الحركة @0:04] نص» (problemNote, parsed by the server's
 * notes inbox) becomes a small chip «الحركة عند ٠:٠٤» before the text; the stored note itself is never rewritten.
 */
export const noteParts = (raw: string): { kind: "الحركة" | "النبرة" | null; at: string | null; text: string } => {
  const t = String(raw ?? "").trim();
  const m = /^\[(الحركة|النبرة) @(\d{1,3}:\d{2})\]\s*/.exec(t);
  return m ? { kind: m[1] as "الحركة" | "النبرة", at: m[2]!, text: t.slice(m[0].length).trim() } : { kind: null, at: null, text: t };
};
export const NoteText: React.FC<{ raw: string }> = ({ raw }) => {
  const n = noteParts(raw);
  return <>{n.kind ? <span className="s3-chip">{n.kind} عند <Num className="clk">{n.at!}</Num></span> : null}{n.text}</>;
};

/** سطر هادئ واحد تحت ملاحظة التصحيح: هل وصلت الملاحظة، وهل أُصلح المشهد (docs/studio/notes-inbox.md). */
export const noteInboxLine = (inbox: { sync: "pending" | "sent"; status: string; answer: string | null; reason?: string }) =>
  inbox.status === "fixed" ? `أُصلحت — أنتج المشهد من جديد${inbox.answer ? ` (${inbox.answer})` : ""}`
    : inbox.status === "wont-fix" ? `لن تُعدَّل${inbox.answer ? `: ${inbox.answer}` : ""}`
    : inbox.sync === "sent" ? "أُرسلت الملاحظة"
    // QA 12 Nov: say what really happened; the note is kept on this device and the Studio retries every ١٠ دقائق.
    : inbox.reason === "offline" ? "بانتظار الإرسال: لا اتصال بالإنترنت الآن؛ محفوظة على جهازك وتُرسل وحدها حين يعود الاتصال."
    : inbox.reason === "rejected" ? "بانتظار الإرسال: تغيّر صندوق الملاحظات على GitHub؛ يُعاد الإرسال وحده خلال دقائق."
    // KI-008: a test or work copy keeps its notes; it never sends them to the owner's box
    : inbox.reason === "not-owner" ? "لم تُرسل: هذه النسخة ليست استوديو المالك، فلا تُرسل ملاحظاتها إلى صندوقه."
    : inbox.reason ? "لم تُرسل الملاحظة: تعذّر الدفع إلى GitHub (ليس انقطاع اتصال). محفوظة على جهازك ويُعاد الإرسال وحده كل ١٠ دقائق؛ إن تكرر فأخبر Claude."
    : "بانتظار الإرسال؛ محفوظة على جهازك.";

export const ar = (n: number) => n.toLocaleString("ar-EG");
export const noop = () => {};
