"""
يعيد بناء ألوان identity.json لكل قناة من هويتها المعتمدة فقط (brand/identity/approved.ts):
الثيمات الأربعة، ولوحات العناصر، والشخصيات، والشعار. لا يبقى أي لون من الهويات القديمة.
الاستعمال: python3 tools/identity/rebuild.py   (ثم npm test: اختبار الهويات يرفض أي لون خارج القائمة)
"""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
SH = "rgba(0,0,0,0.18)"

def theme(nameAr, motif, c, outline, skin, garments, cap):
    return {"nameAr": nameAr, "motif": motif, "colors": c,
            "character": {"style": "flat", "outline": outline, "skin": skin, "garments": garments, "cap": cap}}

def pal(style, edge, line, main, second, accent, light, dark, skin, metal, wood, green, water, stroke="none", sw=0):
    return {"style": style, "edge": edge, "stroke": stroke, "sw": sw, "line": line, "lw": 3, "main": main, "second": second,
            "accent": accent, "light": light, "dark": dark, "skin": skin, "metal": metal, "wood": wood, "green": green, "water": water, "shadow": SH}

def cols(bg, surface, ink, inkSoft, primary, secondary, highlight, onHighlight, captionBg, captionInk):
    return dict(bg=bg, surface=surface, ink=ink, inkSoft=inkSoft, primary=primary, secondary=secondary,
                highlight=highlight, onHighlight=onHighlight, captionBg=captionBg, captionInk=captionInk)

# ── بالإسلام «محراب النور»: كل الثيمات ليلية زمردية (لا ورق فاتح ولا أخضر قديم) ──
N, N2, N3, N4, DEEP = "#0B1F1C", "#0F2A26", "#12352F", "#174039", "#071512"
BR, DW, PP, SL, SG, SG2 = "#C9A24A", "#F2B35B", "#F4EEE2", "#C2412D", "#A9C3B9", "#6F8F84"
SKIN = ["#E7C3A0", "#D2A782"]
bal_garments = [BR, DW, PP, SL, SG]
bal = {
  "night": theme("محراب الليل", "arches", cols(N, N2, PP, SG, BR, DW, DW, N, PP, N), DEEP, SKIN, bal_garments, PP),
  "warm": theme("زمرد ونحاس", "girih", cols(N3, N4, PP, SG, DW, BR, DW, N, PP, N), DEEP, SKIN, bal_garments, PP),
  "paper": theme("نور الفجر", "girih", cols(N2, N3, PP, SG, DW, SL, BR, N, PP, N), DEEP, SKIN, bal_garments, PP),
  "family": theme("دفء الختم", "arches", cols(N, N2, PP, SG, BR, SL, DW, N, PP, N), DEEP, SKIN, bal_garments, PP),
}
# الخطوط الداخلية للعناصر بلون فاتح (لا حبر داكن على أرضية داكنة)
bal_pal = {k: pal("flat", SG, SG, BR, DW, SL, v["colors"]["surface"], SG2, SKIN[0], BR, BR, SG, SG2) for k, v in bal.items()}
bal_logo = {"tile": N, "baa": BR, "play": DW, "ink": PP}

# ── دفاتر الزمن «دفتر الأفق»: رَقّ وغسق وحبر بني ──
DUSK, DUSK2, DUSK3, NIGHT, VIOLET = "#2A1E3F", "#251C30", "#35284D", "#1A1424", "#120C18"
SUN, PARCH, BROWN, RIB, SAND, GLOW, LAV, TERRA, INK = "#E07A3F", "#F1E4CB", "#4A2E1F", "#D7372B", "#C8A15A", "#F3C98B", "#A399B4", "#B4583A", "#2B1E14"
PARCH2, PARCH3, PARCH4, INKS, CREAM, LAV2 = "#EADBC0", "#F4E9D4", "#F8EEDB", "#5A4632", "#F3E9DA", "#BFB3C9"
OLIVE = "#7A7F4E"
SKIN_D = ["#E7C3A0", "#D2A782"]
daf = {
  "warm": theme("رق وحبر", "horizon", cols(PARCH, PARCH4, INK, INKS, TERRA, SAND, SUN, INK, INK, PARCH), INK, SKIN_D, [BROWN, TERRA, SAND, DUSK, RIB], PARCH),
  "paper": theme("خريطة عتيقة", "ink-lines", cols(PARCH2, PARCH3, INK, INKS, DUSK, SUN, SUN, INK, DUSK, PARCH), INK, SKIN_D, [DUSK, TERRA, SAND, BROWN, INKS], PARCH),
  "night": theme("غسق", "stars", cols(NIGHT, DUSK2, CREAM, LAV2, SUN, GLOW, GLOW, NIGHT, CREAM, NIGHT), VIOLET, SKIN_D, [SUN, GLOW, RIB, BROWN, LAV2], CREAM),
  "family": theme("أفق الغروب", "stars", cols(DUSK, DUSK3, CREAM, LAV2, GLOW, SUN, GLOW, DUSK, CREAM, DUSK), VIOLET, SKIN_D, [GLOW, SUN, RIB, SAND, LAV2], CREAM),
}
def daf_pal(k, v):
    dark = k in ("night", "family")
    return pal("flat", LAV2 if dark else INK, VIOLET if dark else INK, BROWN if not dark else SUN, TERRA, SAND, v["colors"]["surface"], VIOLET if dark else INK, SKIN_D[0], SAND, BROWN, OLIVE, LAV)
daf_pal_all = {k: daf_pal(k, v) for k, v in daf.items()}
daf_logo = {"tile": DUSK, "baa": BROWN, "play": SUN, "ink": PARCH}

# ── زبدة الكتب «القلم المميِّز»: أبيض وأسود؛ الفسفوري للفكرة فقط (التمييز)، لا في رسم العناصر ──
W, K, HL, OR = "#FFFFFF", "#111111", "#E8F542", "#FF6B4A"
G1, G2, G3, G4, G5, G6, G7 = "#F4F4F1", "#DCD6C8", "#BDBDBD", "#8A8172", "#6A6A6A", "#4A4A4A", "#1E1E1E"
STK, STK2, STK3 = "#F1EDE4", "#EDE7DA", "#F8F4EC"
SKIN_Z = ["#E7C3A0", "#D2A782"]
zub = {
  "paper": theme("ورقة بيضاء", "ruled", cols(W, G1, K, G6, K, OR, HL, K, K, W), K, SKIN_Z, [K, G5, G2, G4, G3], K),
  "family": theme("ورقة لاصقة", "ruled", cols(STK, W, K, G6, K, OR, HL, K, K, W), K, SKIN_Z, [K, G5, G2, G4, G3], K),
  "night": theme("حبر أسود", "ruled", cols(K, G7, W, G3, HL, OR, HL, K, W, K), "#000000", SKIN_Z, [W, G3, G5, G4, G2], W),
  "warm": theme("كتاب كلاسيكي", "ruled", cols(STK2, STK3, K, G6, K, OR, HL, K, K, W), K, SKIN_Z, [K, G5, G2, G4, G3], K),
}
def zub_pal(k, v):
    dark = k == "night"
    return pal("flat", G3 if dark else K, "#000000" if dark else K, W if dark else K, G5, G4, v["colors"]["surface"], "#000000" if dark else K, SKIN_Z[0], G3, G4, G5, G3)
zub_pal_all = {k: zub_pal(k, v) for k, v in zub.items()}
zub_logo = {"tile": W, "baa": K, "play": HL, "ink": K}

SPEC = {"balislam": (bal, bal_pal, bal_logo), "dafatir-alzaman": (daf, daf_pal_all, daf_logo), "zubdat-alkutub": (zub, zub_pal_all, zub_logo)}

for ch, (themes, pals, logo) in SPEC.items():
    channel = json.loads((ROOT / f"channels/{ch}/channel.json").read_text())
    for f in ("identity.json", "identity.default.json"):
        p = ROOT / f"channels/{ch}/{f}"
        d = json.loads(p.read_text())
        for tid, t in themes.items():
            old = d["themes"][tid]
            names = [dm["name"] for dm in channel["domains"].values() if dm["theme"] == tid]
            old.update({"nameAr": t["nameAr"], "motif": t["motif"], "colors": t["colors"], "logo": dict(logo), "character": t["character"],
                        "domainAr": "، ".join(names) if names else t["nameAr"]})
            # أسلوب الرسم (خطي/مسطح) يبقى كما اختير للثيم؛ والخط بلون حبر الهوية
            new = dict(pals[tid])
            prev = d["palettes"].get(tid, {})
            if prev.get("style") == "line" and ch != "balislam":  # بالإسلام كلها ليلية: رسم مسطح
                new.update({"style": "line", "stroke": new["line"], "sw": prev.get("sw", 3)})
            d["palettes"][tid] = new
        p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    print("rebuilt", ch)
