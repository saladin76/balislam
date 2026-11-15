import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { INK_SHOTS } from "../src/remotion/zubdat/shots";
import { INK_VERSE, inkVerseParts, makeAt, makeEnd, type Z } from "../src/remotion/zubdat/inkKit";
import { estimateTimings } from "../src/remotion/scenes/timing";

/**
 * طلب المالك (١٥ نوفمبر): «ادمج مشاهد ‹كما جاء في سورة كذا› مع مشهد الصورة بشكل مباشر، لا تفصلهم في مشهدين».
 * اختار المالك الدمج على الشاشة: يبقيان مشهدين في سجل الإنتاج (التلاوة بشرية ولا يُرسل نص الآية للصوت)،
 * لكن التمهيد لا يتلاشى، ويكتب «سورة …» وخطها في موضع رأس البطاقة وخطه وحجمه، فتبدأ البطاقة من آخر لقطة فيه.
 */
const z: Z = { ink: "#111111", paper: "#FFFFFF", hl: "#E8F542", alert: "#FF6B4A", faint: "#4A4A4A" };
const intros = Object.keys(INK_SHOTS).filter((k) => k.startsWith("verse-intro-"));

describe("تمهيد الآية وبطاقتها مشهد واحد على الشاشة (زبدة الكتب)", () => {
  it("لقطات التمهيد الثلاث لا تتلاشى في آخرها، ولا لقطة غيرها", () => {
    expect(intros.sort()).toEqual(["verse-intro-muminun", "verse-intro-nahl", "verse-intro-taha"]);
    for (const [k, d] of Object.entries(INK_SHOTS)) expect(Boolean(d.holdExit), k).toBe(k.startsWith("verse-intro-"));
    expect(readFileSync("src/remotion/scenes/InkShot.tsx", "utf8")).toMatch(/exitFrames=\{def\?\.holdExit \? 0 : undefined\}/);
  });

  it("آخر لقطة في التمهيد: «سورة …» وخطها في موضع رأس البطاقة نفسه", () => {
    const narration = "كَمَا جَاءَ فِي سُورَةِ طَهَ:";
    const dur = 90;
    const t = estimateTimings(narration, 6, dur - 12);
    const m = renderToStaticMarkup(<svg>{INK_SHOTS["verse-intro-taha"]!.render({ frame: dur - 1, dur, z, at: makeAt(t, dur), end: makeEnd(t, dur), logo: () => null, reg: () => {} }).world}</svg>);
    expect(m).toContain(`d="M${960 + INK_VERSE.ruleHalf} ${INK_VERSE.ruleY} L${960 - INK_VERSE.ruleHalf} ${INK_VERSE.ruleY}"`);
    expect(m).toMatch(new RegExp(`<text x="960" y="${INK_VERSE.headY}"[^>]*font-size:${INK_VERSE.headSize}px[^>]*>سورة طه</text>`));
    expect(m).not.toContain("clip-path"); // اكتملت الكتابة
  });

  it("البطاقة الأفقية ترسم الورقة والرأس والخط بالإحداثيات نفسها، وتضيف رقم الآية تحتها", () => {
    const src = readFileSync("src/remotion/scenes/VerseCard.tsx", "utf8");
    expect(src).toMatch(/<Paper z=\{z\} \/>/);
    expect(src).toMatch(/y1=\{V\.ruleY\} y2=\{V\.ruleY\}/);
    expect(src).toMatch(/x=\{960\} y=\{V\.headY\}[^>]*fontSize: V\.headSize/);
    expect(inkVerseParts("طه · ١٤")).toEqual({ surah: "طه", ayah: "الآية ١٤" });
    expect(inkVerseParts("المؤمنون · ١–٢")).toEqual({ surah: "المؤمنون", ayah: "الآيتان ١–٢" });
  });

});
