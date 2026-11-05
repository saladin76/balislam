/**
 * عارض Markdown صغير وآمن لدليل الاستوديو: عناوين، فقرات، قوائم، جداول، اقتباس، كود، وروابط.
 * يبني عناصر React مباشرة (لا HTML خام)، فلا يُنفَّذ شيء من نص الملف.
 */
import React from "react";

type Block =
  | { k: "h"; level: number; text: string }
  | { k: "p"; text: string }
  | { k: "quote"; text: string }
  | { k: "ul" | "ol"; items: string[]; depth?: number[] }
  | { k: "table"; head: string[]; rows: string[][] }
  | { k: "code"; text: string }
  | { k: "hr" };

const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

export const parseMarkdown = (src: string): Block[] => {
  const lines = src.replace(/\r/g, "").split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i]!;
    if (!l.trim()) { i++; continue; }
    if (l.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) body.push(lines[i++]!);
      i++;
      out.push({ k: "code", text: body.join("\n") });
      continue;
    }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) { out.push({ k: "h", level: h[1]!.length, text: h[2]! }); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(l)) { out.push({ k: "hr" }); i++; continue; }
    if (l.trim().startsWith("|") && lines[i + 1]?.match(/^\s*\|?\s*:?-{2,}/)) {
      const head = cells(l);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) rows.push(cells(lines[i++]!));
      out.push({ k: "table", head, rows });
      continue;
    }
    if (l.startsWith(">")) {
      const body: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(">")) body.push(lines[i++]!.replace(/^>\s?/, ""));
      out.push({ k: "quote", text: body.join(" ") });
      continue;
    }
    const li = l.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      const ordered = /\d/.test(li[1]!);
      const items: string[] = [];
      const depth: number[] = [];
      while (i < lines.length) {
        const m = lines[i]!.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (m) { items.push(m[3]!); depth.push(Math.floor(m[1]!.length / 2)); i++; }
        else if (lines[i]!.match(/^\s{2,}\S/) && items.length) { items[items.length - 1] += " " + lines[i]!.trim(); i++; }
        else break;
      }
      // القوائم المتداخلة (بند فرعي بمسافتين): تُعرض نقاطًا تحت بندها؛ والقائمة المسطحة كما كانت تمامًا
      out.push(depth.some((d) => d > 0) ? { k: ordered ? "ol" : "ul", items, depth } : { k: ordered ? "ol" : "ul", items });
      continue;
    }
    const body: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,4}\s|```|>|\s*([-*]|\d+\.)\s|\s*\|)/.test(lines[i]!)) body.push(lines[i++]!);
    if (!body.length) body.push(lines[i++]!);
    out.push({ k: "p", text: body.join(" ") });
  }
  return out;
};

/** عناصر السطر: **غامق**، `كود`، [نص](رابط) */
const inline = (text: string, onLink: (href: string) => void, key = ""): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[1] !== undefined) out.push(<strong key={k}>{inline(m[1], onLink, k)}</strong>);
    else if (m[2] !== undefined) out.push(<code key={k} dir="ltr">{m[2]}</code>);
    else {
      const href = m[4]!;
      out.push(
        /^https?:\/\//.test(href) ? (
          <a key={k} dir="auto" href={href} target="_blank" rel="noreferrer">{m[3]}</a>
        ) : (
          <a key={k} dir="auto" href="#" onClick={(e) => { e.preventDefault(); onLink(href); }}>{m[3]}</a>
        ),
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

export const Markdown: React.FC<{ text: string; onLink: (href: string) => void }> = ({ text, onLink }) => (
  <div className="md" dir="rtl">
    {parseMarkdown(text).map((b, i) => {
      const k = String(i);
      switch (b.k) {
        case "h":
          return React.createElement(`h${Math.min(6, b.level + 1)}`, { key: k, id: b.text }, inline(b.text, onLink, k));
        case "p":
          return <p key={k}>{inline(b.text, onLink, k)}</p>;
        case "quote":
          return <blockquote key={k}>{inline(b.text, onLink, k)}</blockquote>;
        case "ul":
          return <ul key={k}>{b.items.map((it, j) => <li key={j} style={b.depth?.[j] ? { marginInlineStart: 22 * b.depth[j]!, listStyleType: "circle" } : undefined}>{inline(it, onLink, `${k}-${j}`)}</li>)}</ul>;
        case "ol":
          if (b.depth) {
            let n = 0;
            return (
              <ol key={k}>
                {b.items.map((it, j) => {
                  const top = b.depth![j] === 0;
                  if (top) n++;
                  return <li key={j} value={top ? n : undefined} style={top ? undefined : { listStyleType: "disc", marginInlineStart: 22 * b.depth![j]! }}>{inline(it, onLink, `${k}-${j}`)}</li>;
                })}
              </ol>
            );
          }
          return <ol key={k}>{b.items.map((it, j) => <li key={j}>{inline(it, onLink, `${k}-${j}`)}</li>)}</ol>;
        case "table":
          return (
            <div key={k} className="md-table">
              <table>
                <thead><tr>{b.head.map((c, j) => <th key={j}>{inline(c, onLink, `${k}-h${j}`)}</th>)}</tr></thead>
                <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, x) => <td key={x}>{inline(c, onLink, `${k}-${j}-${x}`)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        case "code":
          return <pre key={k} dir="ltr"><code>{b.text}</code></pre>;
        case "hr":
          return <hr key={k} />;
      }
    })}
  </div>
);
