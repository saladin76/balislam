import React from "react";
import { num } from "../ui/format";
import type { ChannelConfig } from "../../../src/channel/types";
import { useTheme } from "../../../brand/identity/index";
import type { Identity } from "../../../brand/identity/index";
import type { ThemeId } from "../../../brand/themes";
import { LogoMark } from "../../../brand/logo/Logo";
import { approvedIdentity } from "../../../brand/identity/approved";
import { channelLibrary } from "../../../src/channel/library";
import { useStudioFonts } from "../ui/useStudioFonts";

const SLOTS: ThemeId[] = ["paper", "family", "night", "warm"];
const MOTIF_AR: Record<string, string> = { arches: "أقواس", girih: "نجمة ثمانية", stars: "نجوم", horizon: "خط الأفق", "ink-lines": "سطور حبر", ruled: "ورقة مسطّرة", "house-circles": "دوائر دافئة" };
const dateAr = (iso: string) => new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });

const ThemeChip: React.FC<{ id: ThemeId; domains: string[] }> = ({ id, domains }) => {
  const t = useTheme(id);
  const c = t.colors;
  return (
    <div className="idc-theme" style={{ background: c.bg, color: c.ink, borderColor: c.inkSoft + "55" }}>
      <div className="idc-theme-dots">
        {[c.primary, c.secondary, c.highlight].map((x, i) => <i key={i} style={{ background: x }} />)}
      </div>
      <b>{t.nameAr}</b>
      <small style={{ color: c.inkSoft }}>{MOTIF_AR[t.motif] ?? t.motif}{domains.length ? ` — ${domains.join("، ")}` : ""}</small>
    </div>
  );
};

/**
 * بطاقة هوية القناة أعلى تبويب «القناة»: الشعار والاسم بخط الهوية، وحالة الاعتماد، والألوان، والخطوط، والثيمات،
 * وما في مكتبة القناة. الهوية المعتمدة تُقرأ من brand/identity/approved.ts.
 */
export const ChannelIdentity: React.FC<{ c: ChannelConfig; identity?: Identity }> = ({ c, identity }) => {
  useStudioFonts();
  const a = approvedIdentity(c.id);
  const master = useTheme(c.masterTheme);
  const fonts = identity?.fonts ?? {};
  const heading = fonts.heading ?? "El Messiri";
  const lib = channelLibrary(c);
  const palette = a?.palette ?? [
    { hex: master.colors.bg, nameAr: "الخلفية" },
    { hex: master.colors.ink, nameAr: "الحبر" },
    { hex: master.colors.primary, nameAr: "الأساسي" },
    { hex: master.colors.highlight, nameAr: "التمييز" },
  ];
  const domainsOf = (slot: ThemeId) => Object.values(c.domains).filter((d) => d.theme === slot).map((d) => d.name);
  return (
    <section className="group ch-identity">
      <div className="idc-head" style={{ background: master.colors.bg, color: master.colors.ink }}>
        <LogoMark size={104} colors={master.logo} mark={c.logo} />
        <div className="idc-name">
          <h2 style={{ fontFamily: `'${heading}', var(--f-head)`, color: master.colors.ink }}>{c.nameDisplay ?? c.name}</h2>
          <span dir="ltr" style={{ color: master.colors.inkSoft }}>{c.nameLatin}</span>
          <p style={{ color: master.colors.inkSoft }}>{c.description}</p>
        </div>
        <div className={`idc-badge ${a ? "ok" : "tmp"}`}>
          {a ? (
            <>
              <b>✓ هوية معتمدة: «{a.nameAr}»</b>
              <small>{dateAr(a.approvedOn)} — مقفلة: الشعار والافتتاحية والمصغّرة والخطوط والألوان</small>
            </>
          ) : (
            <>
              <b>هوية مؤقتة</b>
              <small>تُبنى هوية القناة بستوري بورد ثم اعتماد، قبل أول حلقة</small>
            </>
          )}
        </div>
      </div>
      {a ? <p className="idc-summary">{a.summaryAr}</p> : null}

      <div className="idc-grid">
        <div>
          <h4>الألوان</h4>
          <div className="idc-palette">
            {palette.map((p) => (
              <figure key={p.hex}>
                <i style={{ background: p.hex }} />
                <figcaption>{p.nameAr}<code dir="ltr">{p.hex}</code></figcaption>
              </figure>
            ))}
          </div>
        </div>
        <div>
          <h4>الخطوط</h4>
          <div className="idc-fonts">
            <div><span style={{ fontFamily: `'${heading}'`, fontSize: 26 }}>{c.nameDisplay ?? c.name}</span><small>العناوين — {heading}</small></div>
            <div><span style={{ fontFamily: `'${fonts.body ?? "IBM Plex Sans Arabic"}'`, fontSize: 17 }}>نص الشرح والترجمة على الشاشة</span><small>النص — {fonts.body ?? "IBM Plex Sans Arabic"}</small></div>
            {c.id === "dafatir-alzaman" ? <div><span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 18 }} dir="ltr">1258–1453</span><small>السنوات — IBM Plex Mono</small></div> : null}
          </div>
        </div>
      </div>

      <h4>الثيمات <small className="help">لكل مجال ثيم من هذه الأربعة، وكلها من هوية القناة</small></h4>
      <div className="idc-themes">{SLOTS.map((s) => <ThemeChip key={s} id={s} domains={domainsOf(s)} />)}</div>

      <h4>مكتبة القناة <small className="help">ما يظهر لها في «المكتبة» ويُسمح به في حلقاتها</small></h4>
      <div className="idc-lib">
        <span><b>{num(lib.templates.length)}</b> قالبًا</span>
        <span><b>{num(lib.sets.length)}</b> مكانًا</span>
        <span><b>{num(lib.elements.length)}</b> عنصرًا</span>
        <span>{lib.figures ? "شخصيات تاريخية بملامح" : "شخصيات بلا ملامح فقط"}</span>
        <span>{c.rules.quran ? "آيات" : "بلا آيات"} — {c.rules.hadith ? "أحاديث" : "بلا أحاديث"} — {c.rules.music ? "موسيقى" : "بلا موسيقى"}</span>
      </div>
    </section>
  );
};
