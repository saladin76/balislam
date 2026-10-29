import { mkdtempSync, cpSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createChannel } from "../src/channel/create";
import { listChannels, loadChannel, channelPaths } from "../src/channel";
import { checkScript, configFromFile } from "../src/script/check";
import { parseScript } from "../src/script/parse";
import { generatePlan } from "../src/plan/generate";
import { planIssues } from "../src/plan/validate";
import { langPack, localDigits } from "../src/i18n/packs";

/** نسخة مؤقتة من مجلد القنوات حتى لا تمس الاختبارات القنوات الحقيقية. */
let tmp = "";
beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-channels-"));
  cpSync(path.join(__dirname, "..", "channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !s.includes(`${path.sep}episodes${path.sep}`) });
  process.env.BAL_CHANNELS_DIR = tmp;
});
afterAll(() => {
  delete process.env.BAL_CHANNELS_DIR;
  delete process.env.BAL_CHANNEL;
});

describe("القنوات", () => {
  it("القناة الأساسية تُقرأ بمجالاتها وثيماتها", () => {
    const c = loadChannel("balislam");
    expect(c.name).toBe("بالإسلام");
    expect(c.domains.psychology?.theme).toBe("paper");
    expect(c.rules.music).toBe(false);
  });

  it("قناة جديدة: هوية منسوخة، مجال عام، بلا قرآن عند الطلب", async () => {
    await createChannel({ id: "tech-test", name: "تقنية", language: "ar", quran: false });
    expect(listChannels()).toEqual(["balislam", "tech-test"]);
    const p = channelPaths("tech-test");
    expect(existsSync(p.identity) && existsSync(p.episodes) && existsSync(p.pronunciation)).toBe(true);
    const c = loadChannel("tech-test");
    expect(Object.keys(c.domains)).toEqual(["general"]);
    expect(c.rules.quran).toBe(false);
    expect(c.rules.hadith).toBe(false);
    expect(JSON.parse(readFileSync(p.identity, "utf8")).themes.paper).toBeTruthy();
    await expect(createChannel({ id: "tech-test", name: "x", language: "ar" })).rejects.toThrow("موجودة");
    await expect(createChannel({ id: "Bad Id", name: "x", language: "ar" })).rejects.toThrow("معرّف");
    await expect(createChannel({ id: "x2", name: "x", language: "fr" })).rejects.toThrow("اللغة");
  });

  it("المجال يُفحص حسب القناة، والثيم يُختار من خريطة القناة", () => {
    const src = readFileSync(path.join(__dirname, "fixtures", "valid.md"), "utf8").replace("domain: psychology", "domain: ai");
    const tech = { ...loadChannel("balislam"), id: "t", domains: { ai: { name: "ذكاء", theme: "night" as const, tags: [] } } };
    const ok = checkScript(parseScript(src), { ...configFromFile(), domains: Object.keys(tech.domains) });
    expect(ok.issues.some((i) => i.code === "frontmatter-invalid")).toBe(false);
    const bad = checkScript(parseScript(src), { ...configFromFile(), domains: ["psychology"] });
    expect(bad.issues.some((i) => i.code === "frontmatter-invalid")).toBe(true);
    const plan = generatePlan(parseScript(src), null, {}, tech);
    expect(plan.themeId).toBe("night");
    expect(plan.channel).toBe("t");
  });
});

describe("اللغات", () => {
  const tr = `---
title: "Neden erteleriz?"
domain: psychology
episode: "900"
lang: tr
---

## Bölüm 1 · Soru

[sahne: list | items=Bir؛ İki]
Bir dakika açarsın, bir saat geçer.

## Kaynaklar

- hadis | Sahih-i Buhari 6446 | صحيح

## Pratik adım

Bugün başla. Hangisini seçtin?
`;

  it("السكريبت التركي يُقرأ بكلماته: الفصل والعلامات والأقسام", () => {
    const p = parseScript(tr);
    expect(p.chapters).toHaveLength(1);
    expect(p.chapters[0]!.blocks[0]).toMatchObject({ kind: "scene", template: "list" });
    expect(p.hasCitationsSection).toBe(true);
    expect(p.citations[0]!.kind).toBe("hadith");
    expect(p.practicalStep?.text).toContain("Bugün");
  });

  it("الخطة تأخذ لغة الحلقة ونصوصها، واللغة غير الجاهزة تمنع النسخة النهائية", () => {
    const plan = generatePlan(parseScript(tr));
    expect(plan.lang).toBe("tr");
    const end = plan.chapters[0]!.scenes.at(-1)!;
    expect(end.props.prompt).toBe("Yorumlara yaz: Hangisini seçtin?");
    expect(planIssues(plan).some((i) => i.level === "error" && i.message.includes("التركية"))).toBe(true);
  });

  it("الفحص ينبّه للغة غير الجاهزة ويرفض اللغة المجهولة", () => {
    const warn = checkScript(parseScript(tr));
    expect(warn.issues.some((i) => i.code === "lang-not-ready")).toBe(true);
    const unknown = checkScript(parseScript(tr.replace("lang: tr", "lang: xx")));
    expect(unknown.issues.some((i) => i.code === "lang-unknown")).toBe(true);
  });

  it("الأرقام حسب اللغة", () => {
    expect(localDigits("٢٠٪ و 3", langPack("ar"))).toBe("٢٠٪ و ٣");
    expect(localDigits("٢٠٪ و ٣٫٥", langPack("en"))).toBe("20% و 3.5");
  });
});
