import React from "react";

export type StudioSection = "home" | "ops" | "channels" | "review" | "research" | "episode" | "script" | "storyboard" | "voice" | "publish" | "identity" | "library" | "channel" | "settings" | "guide" | "labs" | "treviews";

export const SECTION_TITLES: Record<StudioSection, string> = {
  home: "حلقات القناة", ops: "غرفة العمليات والمراقبة", channels: "إدارة القنوات", review: "المراجعة المتكاملة", research: "البحث والتحضير", script: "السكريبت",
  storyboard: "الستوري بورد", voice: "صوت الحلقة", episode: "محرر المشاهد", publish: "النشر والتسليم",
  identity: "الهوية البصرية", library: "مكتبة الأصول والقوالب", channel: "إعدادات القناة",
  settings: "الاتصالات والمفاتيح", guide: "دليل الاستوديو", labs: "مختبرات الإنتاج", treviews: "المراجعات الفنية",
};

type IconName = "grid" | "monitor" | "layers" | "play" | "library" | "lab" | "review" | "palette" | "sliders" | "plug" | "book" | "menu" | "close";
const paths: Record<IconName, string> = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  monitor: "M3 5h18v13H3z M8 22h8 M12 18v4 M7 10h4 M7 14h10",
  layers: "M12 3 2 9l10 6 10-6-10-6z M2 14l10 6 10-6",
  play: "M8 5v14l11-7z",
  library: "M4 4h4v16H4z M10 4h4v16h-4z M16 5l4-1 4 15-4 1z",
  lab: "M9 3h6 M10 3v7L4 20h16l-6-10V3 M8 14h8",
  review: "M8 3h8v3H8z M8 5H5v16h14V5h-3 M8 12l2 2 5-5 M8 18h7",
  palette: "M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4 2 2 0 0 1 1-4h3a3 3 0 0 0 3-3 9 9 0 0 0-9-7z M7 10h.01 M10 6h.01 M15 6h.01 M18 9h.01",
  sliders: "M4 7h8 M16 7h4 M4 17h4 M12 17h8 M12 4v6 M8 14v6",
  plug: "M9 3v5 M15 3v5 M6 8h12v3a6 6 0 0 1-12 0z M12 17v4",
  book: "M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v16h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3z M12 6v16",
  menu: "M4 6h16 M4 12h16 M4 18h16", close: "M6 6l12 12 M6 18L18 6",
};
export const StudioIcon: React.FC<{ name: IconName }> = ({ name }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;

export const StudioSidebar: React.FC<{
  active: StudioSection; channelName: string; channelMark: React.ReactNode;
  hasGuide: boolean; guideLabel: string; hasLabs: boolean; hasTechReviews: boolean;
  identityDirty: boolean; voiceConnected: boolean; episodeTitle?: string; episodeId?: string;
  onHome: () => void; onNavigate: (section: StudioSection) => void; onClose: () => void;
}> = (p) => {
  const item = (id: StudioSection, icon: IconName, label = SECTION_TITLES[id], hint?: string) => (
    <button type="button" key={id} className={`studio-nav-item${p.active === id ? " is-active" : ""}`} aria-current={p.active === id ? "page" : undefined} onClick={() => id === "home" ? p.onHome() : p.onNavigate(id)}>
      <StudioIcon name={icon} /><span>{label}</span>{hint && <span className="studio-nav-dot" title={hint} aria-label={hint} />}
    </button>
  );
  return <aside className="studio-sidebar" id="studio-navigation" aria-label="التنقل في الاستوديو">
    <div className="studio-sidebar-heading"><div className="studio-product-mark"><span /><span /><span /></div><div><strong>الاستوديو</strong><small>مساحات عمل مستقلة</small></div><button type="button" className="studio-close-nav" onClick={p.onClose} aria-label="إغلاق القائمة"><StudioIcon name="close" /></button></div>
    <div className="studio-channel-card"><div className="studio-channel-mark">{p.channelMark}</div><div><span>القناة الحالية</span><strong>{p.channelName}</strong></div></div>
    <nav className="studio-sidebar-nav" aria-label="الأقسام الرئيسية للاستوديو">
      <div className="studio-nav-group"><p>القيادة والمراقبة</p>{item("ops", "monitor")}</div>
      <div className="studio-nav-group"><p>إنتاج الحلقات</p>{item("home", "grid")}{p.episodeId && item("script", "play", "مساحة الحلقة المفتوحة")}</div>
      <div className="studio-nav-group"><p>إدارة القنوات الثلاث</p>{item("channels", "layers")}{item("identity", "palette", undefined, p.identityDirty ? "تعديلات غير محفوظة" : undefined)}{item("channel", "sliders")}</div>
      <div className="studio-nav-group"><p>المكتبة والمراجعات</p>{item("library", "library")}{p.hasLabs && item("labs", "lab")}{p.hasTechReviews && item("treviews", "review")}</div>
      <div className="studio-nav-group studio-guide-link"><p>الأدوات والإعدادات</p>{item("settings", "plug", undefined, p.voiceConnected ? undefined : "تحتاج إعداد الاتصال")}{p.hasGuide && item("guide", "book", p.guideLabel)}</div>
    </nav>
    {p.episodeId && p.episodeTitle && <div className="studio-sidebar-episode"><span>الحلقة المفتوحة <b dir="ltr">{p.episodeId}</b></span><strong>{p.episodeTitle}</strong><small>مراحل الإنتاج تظهر داخل مساحة الحلقة</small></div>}
    <div className="studio-sidebar-footer"><span className="studio-system-dot" /><span>استوديو القنوات</span><span>3 قنوات · مسارات واضحة</span></div>
  </aside>;
};
