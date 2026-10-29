import React, { useMemo, useState } from "react";
import { Element } from "../../../brand/elements/Element";
import { elementLibrary, hasElement, elementById } from "../../../brand/elements/registry";
import { categoryNamesAr, categoryOrder, type ElementCategory } from "../../../brand/elements/types";
import { Character, characterNamesAr, characterPoseNamesAr, characterPoses, characterVariants, type CharacterPose, type CharacterVariant } from "../../../characters/Character";
import { useTheme } from "../../../brand/identity/index";
import type { ThemeId } from "../../../brand/themes";

/** نافذة اختيار عنصر من المكتبة بالبحث والفئات، بألوان ثيم الحلقة. */
export const ElementPicker: React.FC<{
  themeId: ThemeId;
  value?: string;
  kind: "prop" | "backdrop";
  onPick: (id: string) => void;
  onClose: () => void;
}> = ({ themeId, value, kind, onPick, onClose }) => {
  const t = useTheme(themeId);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ElementCategory | "all">("all");
  const items = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return elementLibrary.filter(
      (e) =>
        (kind === "backdrop" ? e.kind === "backdrop" : e.kind !== "backdrop") &&
        (cat === "all" || e.category === cat) &&
        (!qq || `${e.nameAr} ${e.id} ${e.tags.join(" ")}`.toLowerCase().includes(qq)),
    );
  }, [q, cat, kind]);
  const cats = categoryOrder.filter((c) => (kind === "backdrop" ? c === "backdrops" : c !== "backdrops"));
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="اختيار عنصر">
        <div className="modal-head">
          <h3>{kind === "backdrop" ? "اختر خلفية" : "اختر عنصرًا"}</h3>
          <span className="help">{items.length} من المكتبة · بألوان «{t.nameAr}»</span>
          <div className="spacer" />
          <input id="picker-search" type="text" placeholder="ابحث: قلب، هاتف، coin…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} autoFocus />
          <button className="btn" onClick={onClose}>إغلاق</button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {kind === "prop" ? (
            <div className="cat-row">
              <button aria-pressed={cat === "all"} onClick={() => setCat("all")}>الكل</button>
              {cats.map((c) => (
                <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}>{categoryNamesAr[c]}</button>
              ))}
            </div>
          ) : null}
          <div className="grid-el" style={kind === "backdrop" ? { gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" } : undefined}>
            <button className="el-card" aria-selected={!value} onClick={() => onPick("")}>
              <div className="stage" style={{ background: t.colors.bg, aspectRatio: kind === "backdrop" ? "16 / 9" : "1", color: t.colors.inkSoft }}>بدون</div>
              <span>{kind === "backdrop" ? "زخرفة الثيم" : "لا شيء"}</span>
            </button>
            {items.map((e) => (
              <button key={e.id} className="el-card" aria-selected={value === e.id} onClick={() => onPick(e.id)} title={e.id}>
                <div className="stage" style={{ background: t.colors.bg, aspectRatio: kind === "backdrop" ? "16 / 9" : "1" }}>
                  {kind === "backdrop" ? <Element id={e.id} theme={t} width={1920} height={1080} style={{ width: "100%", height: "100%" }} /> : <Element id={e.id} theme={t} size={72} />}
                </div>
                <span>{e.nameAr}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/** زر يعرض العنصر المختار ويفتح المنتقي. */
export const ElementField: React.FC<{ themeId: ThemeId; value?: string; kind?: "prop" | "backdrop"; onChange: (id: string) => void }> = ({ themeId, value, kind = "prop", onChange }) => {
  const t = useTheme(themeId);
  const [open, setOpen] = useState(false);
  const def = value && hasElement(value) ? elementById(value) : null;
  return (
    <>
      <button type="button" className="pick" onClick={() => setOpen(true)}>
        <span className="thumb" style={{ background: t.colors.bg, width: kind === "backdrop" ? 78 : 44 }}>
          {def ? (kind === "backdrop" ? <Element id={def.id} theme={t} width={1920} height={1080} style={{ width: "100%", height: "100%" }} /> : <Element id={def.id} theme={t} size={36} />) : <span className="help">—</span>}
        </span>
        <span className="meta">
          <b>{def ? def.nameAr : kind === "backdrop" ? "زخرفة الثيم (بدون خلفية)" : "بدون عنصر"}</b>
          {def ? <code>{def.id}</code> : <span className="help">اضغط للاختيار</span>}
        </span>
      </button>
      {open ? (
        <ElementPicker
          themeId={themeId}
          value={value}
          kind={kind}
          onClose={() => setOpen(false)}
          onPick={(id) => {
            onChange(id);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
};

/** اختيار الشخصية والوضعية بصريًا. */
export const CharacterField: React.FC<{
  themeId: ThemeId;
  variant: CharacterVariant;
  pose: CharacterPose;
  onChange: (v: { variant: CharacterVariant; pose: CharacterPose }) => void;
}> = ({ themeId, variant, pose, onChange }) => {
  const t = useTheme(themeId);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="grid-el" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        {characterVariants.map((v) => (
          <button key={v} className="el-card" aria-selected={variant === v} onClick={() => onChange({ variant: v, pose })} title={characterNamesAr[v]}>
            <div className="stage" style={{ background: t.colors.bg, aspectRatio: "3 / 4" }}>
              <Character theme={t} variant={v} pose="stand" height={70} />
            </div>
            <span>{characterNamesAr[v]}</span>
          </button>
        ))}
      </div>
      <div className="grid-el" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {characterPoses.map((p) => (
          <button key={p} className="el-card" aria-selected={pose === p} onClick={() => onChange({ variant, pose: p })}>
            <div className="stage" style={{ background: t.colors.bg, aspectRatio: "3 / 4" }}>
              <Character theme={t} variant={variant} pose={p} height={64} />
            </div>
            <span>{characterPoseNamesAr[p]}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
