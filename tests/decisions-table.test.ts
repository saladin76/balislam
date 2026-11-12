import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { definitionsIn, readLogs } from "../scripts/decisions.mjs";

/**
 * جدول القرارات (العمل ٥، D113): docs/studio/decisions.md يطابق سجلات القرارات الثلاثة.
 * - كل قرار معرَّف في السجلات له صف واحد، ولا صف بلا قرار؛
 * - الحالة من أربع صيغ، وكل قرار تذكره الحالة موجود وأحدث من صاحب الصف؛
 * - ما يقوله سجل («يحل محل Dس»، «يُلغي Dس»، «يُبطل … Dس»، «أُلغي بـ/في Dص») يظهر في حالة القرار المعني؛
 * - CLAUDE.md وstudio-map.md لا يذكران قرارًا ملغى كله إلا في سطر يقول إنه أُلغي أو يذكر ما حل محله.
 */
const root = path.resolve(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");
const logs = readLogs(root) as Record<string, string>;
const num = (id: string) => Number(id.replace(/^D/, ""));
const ids = (s: string) => [...s.matchAll(/\bD(\d{2,3})\b/g)].map((m) => Number(m[1]));

type Row = { id: number; date: string; log: string; title: string; status: string };
const rows: Row[] = read("docs/studio/decisions.md").split("\n")
  .filter((l) => /^\|\s*D\d{2,3}\s*\|/.test(l))
  .map((l) => {
    const c = l.split(/(?<!\\)\|/).slice(1, -1).map((x) => x.trim());
    return { id: num(c[0]!), date: c[1]!, log: c[2]!, title: c[3]!, status: c[4]! };
  });
const byId = new Map(rows.map((r) => [r.id, r]));

/** أقسام السجلات: كل عنوان فيه D<رقم> (تعريفًا أو إحالة) ونصه حتى العنوان التالي */
const sections = Object.entries(logs).flatMap(([file, text]) => {
  const out: { file: string; id: number; text: string }[] = [];
  let cur: { file: string; id: number; text: string } | null = null;
  for (const line of text.split("\n")) {
    if (/^#{2,3}\s/.test(line)) {
      const m = line.match(/\bD(\d{2,3})\b/);
      cur = m ? { file, id: Number(m[1]), text: line } : null;
      if (cur) out.push(cur);
    } else if (cur) cur.text += `\n${line}`;
  }
  return out;
});

const STATUS = /^(سارٍ|أُلغي بـ D\d{2,3}|حل محله D\d{2,3}|أُلغي جزئيًا بـ D\d{2,3})/;
const fullyVoided = (r: Row) => /^(أُلغي بـ|حل محله)/.test(r.status);

describe("جدول القرارات docs/studio/decisions.md", () => {
  it("صف واحد لكل قرار معرَّف في السجلات، ولا صف بلا قرار", () => {
    const defined = new Set(Object.values(logs).flatMap((t) => (definitionsIn(t) as { id: string }[]).map((d) => num(d.id))));
    const listed = rows.map((r) => r.id);
    expect(listed.length, "صف مكرر").toBe(new Set(listed).size);
    expect([...defined].filter((d) => !byId.has(d)).map((d) => `D${d}`), "قرار بلا صف في decisions.md").toEqual([]);
    expect(listed.filter((d) => !defined.has(d)).map((d) => `D${d}`), "صف بلا قرار في السجلات").toEqual([]);
  });

  it("كل صف بتاريخ وسطر وحالة صالحة، وما تذكره الحالة قرار أحدث موجود", () => {
    const bad: string[] = [];
    for (const r of rows) {
      if (!/نوفمبر/.test(r.date) || !r.title || !r.log) bad.push(`D${r.id}: صف ناقص`);
      if (!STATUS.test(r.status)) bad.push(`D${r.id}: حالة غير معروفة «${r.status}»`);
      for (const d of ids(r.status)) if (d <= r.id || !byId.has(d)) bad.push(`D${r.id}: الحالة تذكر D${d}`);
    }
    expect(bad).toEqual([]);
  });

  it("ما تقوله السجلات عن الإلغاء يظهر في حالة القرار المعني", () => {
    const bad: string[] = [];
    for (const s of sections) {
      for (const sentence of s.text.split(/(?<=[.؛\n])/)) {
        // قرار أحدث يُلغي أقدم أو يحل محله
        if (/(يحل محل|يُلغي|يُبطل)/.test(sentence))
          for (const old of ids(sentence).filter((d) => d < s.id)) {
            const r = byId.get(old);
            if (!r || r.status === "سارٍ" || !ids(r.status).includes(s.id)) bad.push(`${s.file} D${s.id} يُلغي D${old}، وحالته «${r?.status}»`);
          }
        // القرار نفسه معلَّم «أُلغي بـ/في Dص»
        for (const m of sentence.matchAll(/أُلغي(?: هذا القرار)? (?:بـ ?|في )D(\d{2,3})/g)) {
          const r = byId.get(s.id);
          if (!r || r.status === "سارٍ" || !ids(r.status).includes(Number(m[1]))) bad.push(`${s.file} D${s.id} «أُلغي بـ D${m[1]}»، وحالته «${r?.status}»`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("CLAUDE.md وstudio-map.md لا يذكران قرارًا ملغى كله كأنه سارٍ", () => {
    const VOID = /(أُلغي|ألغي|يُلغي|إلغاء|المُلغاة|الملغاة|يحل محل|حل محله|يُبطل|supersed)/;
    const bad: string[] = [];
    for (const f of ["CLAUDE.md", "docs/studio/studio-map.md"])
      for (const line of read(f).split("\n"))
        for (const d of ids(line)) {
          const r = byId.get(d);
          if (r && fullyVoided(r) && !VOID.test(line) && !ids(r.status).some((n) => ids(line).includes(n))) bad.push(`${f}: D${d} (${r.status}) — ${line.slice(0, 80)}`);
        }
    expect(bad).toEqual([]);
  });

  it("كل قرار في سجل تحديثات الخريطة له صف في الجدول", () => {
    const map = read("docs/studio/studio-map.md");
    const listed = [...map.matchAll(/^\| D(\d{2,3}) \|/gm)].map((m) => Number(m[1]));
    expect(listed.filter((d) => !byId.has(d))).toEqual([]);
  });
});
