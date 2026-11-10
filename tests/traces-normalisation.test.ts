/**
 * C2 (security QA, 10 Nov): the Rule-1 trace check cannot be bypassed by spelling, and it does not flag
 * normal Arabic. Thumbnails: every PNG text chunk is read (zTXt/iTXt inflated, eXIf, XMP). On-screen text
 * (scene props, chapter titles, frontmatter.book) goes through the same check.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { findTraces, normalizeForTraces, onScreenTexts } from "../src/package/traces";
import { pngTextChunks, pngTraces } from "../src/package/driveHandoff";

const repo = path.resolve(__dirname, "..");

describe("normalisation defeats spelling tricks", () => {
  const caught: [string, string][] = [
    ["Eleven​Labs", "ElevenLabs"], ["Eleven Labs", "ElevenLabs"], ["Eleven⁠Labs", "ElevenLabs"], ["Eleven﻿Labs", "ElevenLabs"],
    ["#Eleven_Labs", "ElevenLabs"], ["E.l.e.v.e.n-L.a.b.s", "ElevenLabs"], ["ＥｌｅｖｅｎＬａｂｓ", "ElevenLabs"],
    ["Еlеvеn Lаbs", "ElevenLabs"], ["Voice by ElevenLabs", "ElevenLabs"], ["إلفن لابس", "ElevenLabs"], ["اليفن لابز", "ElevenLabs"],
    ["ClaudeAI", "Claude"], ["Claude", "Claude"], ["C‮laude", "Claude"], ["Ｃｌａｕｄｅ", "Claude"], ["كلود", "Claude"], ["كـلـود", "Claude"], ["Anthropic", "Claude"],
    ["GPT", "ChatGPT"], ["GPT-4", "ChatGPT"], ["gpt4o", "ChatGPT"], ["ChatGPT", "ChatGPT"], ["Chat GPT", "ChatGPT"], ["OpenAI", "ChatGPT"], ["Open AI", "ChatGPT"], ["شات جي بي تي", "ChatGPT"],
    ["Gemini", "أداة ذكاء اصطناعي"], ["Bard", "أداة ذكاء اصطناعي"], ["Copilot", "أداة ذكاء اصطناعي"],
    ["Midjourney", "أداة توليد صور"], ["Firefly", "أداة توليد صور"], ["Runway", "أداة توليد صور"], ["Pika", "أداة توليد صور"], ["Sora", "أداة توليد صور"],
    ["HeyGen", "أداة توليد فيديو"], ["Synthesia", "أداة توليد فيديو"], ["Suno", "أداة توليد صوت"], ["Udio", "أداة توليد صوت"],
    ["Remotion", "Remotion"], ["ريموشن", "Remotion"],
    ["made with AI", "AI"], ["A.I.", "AI"],
    ["ذكاء اصطناعي", "ذكاء اصطناعي"], ["ذكاء صناعي", "ذكاء اصطناعي"], ["بالذكاء الإصطناعي", "ذكاء اصطناعي"], ["الذَّكَاءُ الاصْطِنَاعِيُّ", "ذكاء اصطناعي"],
    ["مولد بالذكاء", "مولَّد آليًا"], ["مولّد بالذكاء", "مولَّد آليًا"], ["مولد آليًا", "مولَّد آليًا"],
    ["صوت مولد", "صوت آلي"], ["صوت اصطناعي", "صوت آلي"], ["صوت آلي", "صوت آلي"], ["صوت مستنسخ", "استنساخ الصوت"],
  ];
  for (const [text, label] of caught)
    it(`catches ${JSON.stringify(text)}`, () => expect(findTraces(text)).toContain(label));

  it("normalises NFKC, format characters, confusables and case", () => {
    expect(normalizeForTraces("ＡＢ​‪cс")).toBe("abcc");
  });
});

describe("zero false positives on normal Arabic and the channels' scripts", () => {
  const normal = [
    "كيف تعرف أنك على حق؟ اللهم أرنا الحق حقًا #بالإسلام", "SAID and MAIN", "reopen aisle", "a I",
    "ابتسامة اصطناعية", "أطراف اصطناعية", "الصناعة الثقيلة", "ذكاء الطفل وفطنته", "بذكاء وهدوء", "المولد النبوي",
    "يصل صوت إلى القلب", "رفع صوته إلى السماء", "جبت لك هدية", "الفن والجمال", "استنساخ التجربة الناجحة",
    "آلية العمل", "توليد الأفكار", "صوت المطر", "صوت الأذان", "الغيمة البيضاء", "الطريق إلى المسجد",
  ];
  for (const t of normal) it(`passes ${JSON.stringify(t)}`, () => expect(findTraces(t)).toEqual([]));

  it("every script of the three channels and every channel script template is clean", () => {
    const files: string[] = [];
    for (const ch of readdirSync(path.join(repo, "channels"))) {
      const ed = path.join(repo, "channels", ch, "episodes");
      if (!existsSync(ed)) continue;
      for (const ep of readdirSync(ed)) for (const f of ["script.md", "tashkeel.md"])
        if (existsSync(path.join(ed, ep, f))) files.push(path.join(ed, ep, f));
    }
    for (const t of readdirSync(path.join(repo, "templates")))
      if (existsSync(path.join(repo, "templates", t, "script.md"))) files.push(path.join(repo, "templates", t, "script.md"));
    expect(files.length).toBeGreaterThanOrEqual(6);
    const hits: string[] = [];
    for (const f of files) readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      // a note to the producer above the narration (blockquote) is not published text
      if (line.startsWith(">")) return;
      const h = findTraces(line);
      if (h.length) hits.push(`${path.relative(repo, f)}:${i + 1} ${h.join(",")}`);
    });
    expect(hits).toEqual([]);
  });

  it("every plan's on-screen text and every publish kit of the channels is clean", () => {
    const hits: string[] = [];
    for (const ch of readdirSync(path.join(repo, "channels"))) {
      const ed = path.join(repo, "channels", ch, "episodes");
      if (!existsSync(ed)) continue;
      for (const ep of readdirSync(ed)) {
        const plan = path.join(ed, ep, "plan.json");
        if (existsSync(plan)) for (const t of onScreenTexts(JSON.parse(readFileSync(plan, "utf8"))))
          if (findTraces(t.text).length) hits.push(`${ch}/${ep} ${t.name}`);
        const kit = path.join(ed, ep, "publish.json");
        if (existsSync(kit) && findTraces(readFileSync(kit, "utf8")).length) hits.push(`${ch}/${ep} publish.json`);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("on-screen text", () => {
  it("collects props that are words, chapter titles and frontmatter.book; skips identifiers", () => {
    const plan = {
      title: "حلقة", chapters: [{ title: "فصل", scenes: [
        { id: "c1-s1", narration: "", props: { text: "صُنع بـ Remotion", element: "brain-ai", variant: "narrator-m" } },
        { id: "c1-end", narration: "", props: { step: "خطوة", prompt: "شاركنا رأيك" } },
      ] }],
    };
    const texts = onScreenTexts(plan, { book: "كتاب ElevenLabs" });
    const flagged = texts.filter((t) => findTraces(t.text).length).map((t) => t.name);
    expect(flagged).toEqual(["السكريبت: book", "نص الشاشة في المشهد c1-s1"]);
    expect(texts.some((t) => t.text.includes("brain-ai"))).toBe(false);
  });
});

describe("PNG thumbnails: every text chunk is read", () => {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const png = (...chunks: Buffer[]) => {
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), ...chunks, chunk("IEND", Buffer.alloc(0))]);
  };
  const withFile = async (buf: Buffer) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "bal-png-"));
    const f = path.join(dir, "t.png");
    writeFileSync(f, buf);
    try { return await pngTraces(f); } finally { rmSync(dir, { recursive: true, force: true }); }
  };
  const z = (kw: string, text: string) => chunk("zTXt", Buffer.concat([Buffer.from(`${kw}\0\0`, "latin1"), deflateSync(Buffer.from(text, "latin1"))]));
  const it_ = (kw: string, text: string, compressed: boolean) => chunk("iTXt", Buffer.concat([
    Buffer.from(`${kw}\0${compressed ? "\x01" : "\x00"}\0\0\0`, "latin1"), compressed ? deflateSync(Buffer.from(text, "utf8")) : Buffer.from(text, "utf8")]));

  it("a clean PNG passes", async () => {
    expect(await withFile(png(chunk("tEXt", Buffer.from("Title\0مفتاح الفرج", "utf8"))))).toEqual([]);
  });
  it("finds a tool name in compressed zTXt", async () => {
    expect((await withFile(png(z("Software", "Made with Remotion"))))).not.toEqual([]);
  });
  it("finds a tool name in compressed iTXt XMP and in plain iTXt", async () => {
    const xmp = `<x:xmpmeta><rdf:Description xmp:CreatorTool="Adobe Firefly"/></x:xmpmeta>`;
    expect(await withFile(png(it_("XML:com.adobe.xmp", xmp, true)))).toContain("أداة توليد صور");
    expect(await withFile(png(it_("Comment", "Eleven​Labs", false)))).toContain("ElevenLabs");
  });
  it("finds a tool name in eXIf and refuses an unreadable text chunk", async () => {
    expect(await withFile(png(chunk("eXIf", Buffer.from("MM\0*\0\0\0\x08Software\0Midjourney v6\0", "latin1"))))).toContain("أداة توليد صور");
    const broken = chunk("zTXt", Buffer.from("Software\0\0not-zlib", "latin1"));
    expect((await withFile(png(broken))).join(" ")).toMatch(/zTXt/);
    expect(pngTextChunks(Buffer.from("not a png"))[0]!.error).toBe("not a PNG");
  });
});
