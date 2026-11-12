/**
 * العمل ٦ (D113): بقايا تقرير D102 وتجميليات الجرد — كل بند باختبار يُسقطه لو عاد.
 * KI-019 زر تأكيد الحذف، KI-020 «اعتمد التلاوة» قبل علامة الاستماع، KI-016 صف البسملة، KI-023 نافذة تصحيح الكلمة،
 * KI-022 «0:00» بأرقام غربية، KI-024 اسم المجلد التقريبي، KI-015 «معتمد ٤٩» في الستوري بورد، KI-014 «٢ مسودات»،
 * KI-017 البسملة «بلا صوت» في «متتابعة»، KI-021 حذف سلسلة فيها حلقات، KI-025 «دليل الاستوديو»، KI-026 «Amiri»،
 * KI-012 خطأ الرندر المبتور.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deleteReady } from "../app/src/tabs/HomeTab";
import { RecitationItem, approveMissing } from "../app/src/workspace/RecitationItem";
import { OwnerAudio } from "../app/src/ui/OwnerAudio";
import { WordFixPopover } from "../app/src/workspace/SentencesPanel";
import { autoSlug } from "../app/src/App";
import { BOARD_APPROVED_TITLE, boardsApprovedText } from "../app/src/tabs/BoardViewer";
import { clipStatus } from "../app/src/workspace/VoiceWorkspaceTab";
import { SeriesMenu } from "../app/src/tabs/Series";
import { fontNameAr } from "../app/src/ui/format";
import { DRAFTS, countAr } from "../src/i18n/count";
import { BASMALA_TEXT } from "../src/voice/basmala";

const root = path.join(__dirname, "..");
const src = (f: string) => readFileSync(path.join(root, f), "utf8");
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const noop = () => {};

describe("KI-019: «انقلها إلى سلة المحذوفات» لا يُضغط قبل رقم الحلقة", () => {
  it("معطّل فارغًا أو برقم خاطئ أو أثناء النقل، ومفعّل بالرقم بأي نظام أرقام", () => {
    expect(deleteReady("", "001")).toBe(false);
    expect(deleteReady("002", "001")).toBe(false);
    expect(deleteReady("٠٠١", "001", true)).toBe(false);
    expect(deleteReady("٠٠١", "001")).toBe(true);
    expect(deleteReady(" 001 ", "001")).toBe(true);
    expect(src("app/src/tabs/HomeTab.tsx")).toContain("disabled={!deleteReady(del.typed, del.id, del.busy)}");
  });
});

const pendingRecs = (key: string) => ({
  verses: [], approved: {},
  pending: { [key]: { file: "r.wav" } },
}) as never;
const rec = (key: string, recs: unknown = pendingRecs(key)) => renderToStaticMarkup(
  <RecitationItem episodeId="001" channelId="dafatir-alzaman" ayahKey={key} scenes={["c1-s1"]} recs={recs as never} onChanged={noop} />,
);
const approveButton = (html: string) => /<button[^>]*>اعتمد (التلاوة|التسجيل)<\/button>/.exec(html)?.[0] ?? "";

describe("KI-020: «اعتمد التلاوة» معطّل قبل علامة «استمعت…» والحقول", () => {
  it("التلاوة المرفوعة: الزر معطّل ومعه سبب ظاهر يذكر العلامة أولًا", () => {
    const html = rec("20:14");
    expect(approveButton(html)).toMatch(/disabled=""/);
    expect(text(html)).toContain("استمع إليها كاملة وضع العلامة");
  });
  it("ما ينقص بالترتيب، ولا شيء حين يكتمل (شروط الخادم نفسها)", () => {
    const full = { reciter: "المالك", rights: "تسجيلي الخاص بتاريخ ١٢ نوفمبر", note: "استمعت إليها كاملة بعد المعالجة", listened: true };
    expect(approveMissing(full)).toBe("");
    expect(approveMissing({ ...full, listened: false })).toMatch(/^استمع إليها كاملة وضع العلامة «استمعت…» أولًا/);
    expect(approveMissing({ ...full, note: "قصيرة" })).toMatch(/١٢ حرفًا/);
    expect(approveMissing({ ...full, listened: false, reciter: "" })).toMatch(/وضع العلامة، واكتب اسم القارئ/);
  });
});

describe("KI-016: صف البسملة «ارفع التسجيل» لا «ارفع التلاوة»", () => {
  it("قبل الرفع: «ارفع التسجيل» و«لم يُرفع»", () => {
    const html = rec("basmala", { verses: [], pending: {}, approved: {} });
    expect(text(html)).toContain("ارفع التسجيل");
    expect(text(html)).not.toContain("ارفع التلاوة");
    expect(text(html)).toContain("لم يُرفع");
  });
  it("بعد الرفع: «اعتمد التسجيل» و«استمعت إلى التسجيل كاملًا»، والآية كما هي", () => {
    const b = text(rec("basmala"));
    expect(b).toContain("اعتمد التسجيل");
    expect(b).toContain("استمعت إلى التسجيل كاملًا");
    expect(b).toContain("استمع إليه كاملًا");
    const v = text(rec("20:14"));
    expect(v).toContain("اعتمد التلاوة");
    expect(v).toContain("استمعت إلى التلاوة كاملة");
  });
});

describe("KI-022: الزمن في مشغّل التلاوة بأرقام عربية", () => {
  it("لا مشغّل المتصفح الأصلي (controls) في التلاوات، والزمن «٠:٠٠»", () => {
    const html = rec("20:14");
    expect(html).not.toMatch(/<audio[^>]*controls/);
    const player = renderToStaticMarkup(<OwnerAudio src="/x.wav" />);
    expect(text(player)).toContain("٠:٠٠");
    expect(text(player)).not.toMatch(/\d:\d\d/);
    expect(player).toContain('aria-label="شغّل التسجيل"');
  });
});

describe("KI-023: نافذة تصحيح الكلمة بلا تناقض وبفواصل", () => {
  const words = ["وَمَعَ", "السِّنِينَ", "نَحْفَظُ"].map((w, i) => ({ word: w, say: w, sent: i === 1 ? "السِّنِين" : w, source: (i === 1 ? "lexicon" : "written") as never, correction: null, start: i, end: i + 0.5, quran: false }));
  const html = renderToStaticMarkup(
    <WordFixPopover words={words} rowNo={1} draft={{ row: "r1", index: 1, say: "السِّنِينْ", save: true, wide: false }} busy={null} noKey={false} playing={false}
      pos={{ top: 0, left: 0, arrow: 0, sheet: false }} onDraft={noop} onClose={noop} onPlay={noop} onFix={noop} onWhole={noop} />,
  );
  it("«النطق المستعمل حتى الآن» و«عند «أعد نطق الكلمة» يُرسل»، لا «يُرسل الآن» مع «سيُرسل»", () => {
    expect(text(html)).toContain("النطق المستعمل حتى الآن «السِّنِين»");
    expect(text(html)).toContain("عند «أعد نطق الكلمة» يُرسل: «السِّنِينْ»");
    expect(text(html)).not.toContain("يُرسل الآن");
    expect(text(html)).not.toContain("سيُرسل");
  });
  it("عنوان الخانة وشرحها مفصولان (لا «للقناةيُستعمل…»)", () => {
    expect(html).not.toMatch(/للقناة<small>/);
    expect(html).not.toMatch(/تُنطق<small>/);
    expect(html).toMatch(/احفظ هذا النطق للقناة <small>/);
  });
});

describe("KI-024: اسم المجلد من العنوان يأخذ حركاته", () => {
  it("العنوان المشكول يُقرأ بحركاته وشدّته، بلا «ال» ولا حركة الإعراب الأخيرة", () => {
    expect(autoSlug("أَوَّلُ مَرَّةٍ أُصَلِّي", "002")).toBe("awwal-marra-usalli");
    expect(autoSlug("قِصَّةُ آدَمَ", "002")).toBe("qissa-adam");
    expect(autoSlug("الشَّمْسُ", "002")).toBe("shams");
    expect(autoSlug("مِفْتَاحُ الْجَنَّةِ", "002")).toBe("miftah-janna");
    expect(autoSlug("الإِسْلَامُ", "002")).toBe("islam");
  });
  it("العنوان بلا تشكيل كما كان، والفارغ «episode-٠٠٢» بأرقام لاتينية في الاسم", () => {
    expect(autoSlug("حكاية الحارة", "002")).toBe("hkaya-hara");
    expect(autoSlug("", "٠٠٢")).toBe("episode-002");
    expect(autoSlug("Trailer 2026", "002")).toBe("trailer-2026");
  });
});

describe("KI-015: الستوري بورد يسمّي اللوحات لا المشاهد", () => {
  it("«اعتُمدت في التجهيز: ٤٩ لوحة» بدل «معتمد ٤٩»، وعلامة اللوحة «لوحة معتمدة»", () => {
    expect(boardsApprovedText(49)).toBe("اعتُمدت في التجهيز: ٤٩ لوحة");
    expect(boardsApprovedText(2)).toBe("اعتُمدت في التجهيز: لوحتان");
    expect(BOARD_APPROVED_TITLE).toContain("الخطوة ٢");
    const panel = src("app/src/tabs/StoryboardPanel.tsx");
    expect(panel).not.toContain("— معتمد {ar(st.approved)}");
    expect(panel).toContain("لوحة معتمدة");
    expect(src("app/src/shell/EpisodeSpine.tsx")).toContain("(مشاهد معتمدة: ${arNum(w.progress.approvedScenes)} من");
  });
});

describe("KI-014: «جُهّزت مسودتان» لا «٢ مسودات»", () => {
  it("العدّ العربي للمسودات", () => {
    expect(countAr(2, DRAFTS)).toBe("مسودتان");
    expect(countAr(1, DRAFTS)).toBe("مسودة واحدة");
    expect(countAr(11, DRAFTS)).toBe("١١ مسودة");
    expect(src("app/src/workspace/PrepareAll.tsx")).toContain("`جُهّزت ${countAr(job.rendered.length, DRAFTS)}`");
  });
});

describe("KI-017: البسملة في «متتابعة» تسجيل المالك لا «بلا صوت»", () => {
  it("البسملة وحدها بلا ملف: «تسجيلك بصوتك»، وجملة الراوي بلا ملف «بلا صوت»", () => {
    expect(clipStatus(BASMALA_TEXT, false, "missing").text).toBe("تسجيلك بصوتك — التلاوة تُضاف لاحقًا");
    expect(clipStatus("جملة الراوي.", false, "missing").text).toBe("بلا صوت");
    expect(clipStatus("جملة الراوي.", true, "ready").text).toBe("صوت مطابق");
    expect(clipStatus("جملة الراوي.", false, "stale").text).toBe("صوت قديم");
  });
});

describe("KI-021: «احذف…» لسلسلة فيها حلقات معطّل، لا تأكيد يُرفض بعده", () => {
  it("العنصر معطّل بسببه؛ والسلسلة الفارغة يُحذف كالمعتاد", () => {
    const menu = (canDelete: boolean) => {
      const html = renderToStaticMarkup(<SeriesMenu general={false} archived={false} canDelete={canDelete} onRename={noop} onMove={noop} onArchive={noop} onDelete={noop} />);
      return html;
    };
    // the menu opens on click; its items are in the component source and rendered when open
    expect(src("app/src/tabs/Series.tsx")).toContain('disabled: !p.canDelete');
    expect(src("app/src/tabs/Series.tsx")).toMatch(/disabled=\{off\} aria-disabled=\{off \|\| undefined\} onClick=\{\(\) => \{ if \(off\) return;/);
    expect(menu(false)).toContain('aria-label="خيارات السلسلة"');
  });
});

describe("KI-025 وKI-026: الأسماء كما يقرؤها المالك", () => {
  it("«مرجع الاستوديو» في القائمة لكل قناة (لا «دليل الاستوديو»)", () => {
    expect(src("app/src/ui/StudioSidebar.tsx")).toContain('guide: "مرجع الاستوديو"');
    expect(src("app/src/App.tsx")).not.toContain('"دليل الاستوديو"');
  });
  it("خط العناوين بالعربية: الأميري، الرقعة، لاله زار", () => {
    expect(fontNameAr("Amiri")).toBe("الأميري");
    expect(fontNameAr("Aref Ruqaa")).toBe("الرقعة");
    expect(fontNameAr("Lalezar")).toBe("لاله زار");
    expect(src("app/src/tabs/Series.tsx")).toContain("«{fontNameAr(rules.fonts.heading)}» ثابت");
  });
});

describe("KI-012: خطأ رندر المشهد بطاقة كاملة لا سطر مبتور", () => {
  it("بطاقة تلتف، بنص المالك، والتشخيص كاملًا تحت «عرض التشخيص»", () => {
    const tsx = src("app/src/workspace/PrepareAll.tsx");
    expect(tsx).toContain('<div className="prep-note is-err prep-error-card" role="alert">\n          تعذّر {countAr(failed, SCENES)}');
    expect(tsx).toContain("<details><summary>عرض التشخيص</summary><pre>{job!.failed.map(");
  });
});
