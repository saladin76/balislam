/**
 * D89: a render error never leaves a white page. The Studio is wrapped in `StudioErrorBoundary` (main.tsx), and each
 * step / large panel has its own (App.tsx, SceneProductionPanel.tsx). The card shows the error text to copy,
 * «أعد المحاولة» (the one filled button) and «ارجع إلى الرئيسية», and clears nothing.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StudioErrorBoundary, crashReport, homeHref } from "../app/src/shell/ErrorBoundary";

const src = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const crashed = (props: Partial<React.ComponentProps<typeof StudioErrorBoundary>> = {}) => {
  const b = new StudioErrorBoundary({ scope: "screen", children: null, ...props });
  b.state = { ...b.state, ...StudioErrorBoundary.getDerivedStateFromError(new Error("Rendered more hooks than during the previous render.")), stack: "\n    at SentencesPanel\n    at SceneProductionPanel" };
  return { b, html: renderToStaticMarkup(<>{b.render()}</>) };
};

describe("ErrorBoundary — no white page (D89)", () => {
  it("without an error the children render as they are", () => {
    const b = new StudioErrorBoundary({ scope: "app", children: <p>الاستوديو</p> });
    expect(renderToStaticMarkup(<>{b.render()}</>)).toBe("<p>الاستوديو</p>");
  });

  it("the card (D112): Arabic title, «أرسل المشكلة» (the one filled button), retry, home, the error text under «تفاصيل»; nothing cleared", () => {
    const { html } = crashed({ label: "الخطوة ٢ «المشاهد»" });
    const t = text(html);
    expect(t).toContain("الخطوة ٢ «المشاهد» — تعذّر العرض");
    expect(t).toContain("حدث خطأ في العرض");
    expect(t).toContain("لم يُمسح شيء ولم يُحذف");
    expect(html).toContain("Rendered more hooks than during the previous render.");
    expect(html).toContain("SentencesPanel");
    expect(html).toContain("<summary>تفاصيل</summary>");
    const buttons = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
    expect(buttons).toEqual(["أرسل المشكلة", "أعد المحاولة", "ارجع إلى الرئيسية"]);
    expect(html).toMatch(/<button[^>]*btn primary[^>]*>أرسل المشكلة/);
    expect(html.match(/btn primary/g)).toHaveLength(1);
    expect(html).toContain('role="alert"');
  });

  it("the app scope brings the shell tokens (the channel last chosen) and goes home with ?link (D85)", () => {
    const { html } = crashed({ scope: "app" });
    expect(html).toContain("shell-v3 crash-shell");
    expect(text(html)).toContain("الاستوديو — تعذّر العرض");
    expect(homeHref("zubdat-alkutub")).toBe("/?link#/zubdat-alkutub/home");
    expect(homeHref("../x")).toBe("/");
    expect(homeHref(null)).toBe("/");
  });

  it("retry and home reset the boundary; a new resetKey (another step) clears the error by itself", () => {
    const onHome = vi.fn();
    const { b } = crashed({ onHome, resetKey: "a" });
    const set = vi.fn((u: unknown) => { const v = typeof u === "function" ? (u as (s: typeof b.state) => object)(b.state) : u; b.state = { ...b.state, ...(v as object) }; });
    b.setState = set as never;
    (b as unknown as { home: () => void }).home();
    expect(onHome).toHaveBeenCalledOnce();
    expect(b.state.error).toBeNull();
    expect(b.state.tries).toBe(1);
    b.state = { ...b.state, error: new Error("x") };
    b.componentDidUpdate({ scope: "screen", resetKey: "b", children: null });
    expect(b.state.error).toBeNull();
  });

  it("the report holds the message, the address and the component stack — and no storage is touched", () => {
    const r = crashReport(new TypeError("Cannot read properties of undefined (reading 'id')"), "\n  at A\n  at B", "http://127.0.0.1:4321/#/balislam/001/episode");
    expect(r).toMatch(/^TypeError: Cannot read properties/);
    expect(r).toContain("العنوان: http://127.0.0.1:4321/#/balislam/001/episode");
    expect(r).toContain("المكوّن:\nat A\nat B");
    expect(src("app/src/shell/ErrorBoundary.tsx")).not.toMatch(/localStorage\.(setItem|removeItem|clear)|sessionStorage\.(setItem|removeItem|clear)|api\./);
  });

  it("wired: the whole Studio, every screen of App, the episode spine, the scene preview and both sentence panels", () => {
    expect(src("app/src/main.tsx")).toContain('<StudioErrorBoundary scope="app"><App /></StudioErrorBoundary>');
    const app = src("app/src/App.tsx");
    expect(app).toContain('<StudioErrorBoundary scope="screen" label={screenLabel}');
    expect(app).toContain('label="حالة الحلقة"');
    const panel = src("app/src/workspace/SceneProductionPanel.tsx");
    expect(panel).toContain('label="معاينة المشهد"');
    expect(panel).toContain('label="الجمل"');
    expect(panel).toContain('label="جمل الحلقة"');
  });
});
