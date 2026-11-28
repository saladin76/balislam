import React from "react";
import { C } from "./kit";
import { QuranSeal, SText } from "./book";

/** لوحة مرجع قرآني: إطار ذهبي وختم «القرآن» واسم السورة ورقم الآية — تظهر ثم تسكن */
/** D242: oRef/oSub (اختياريان) يُظهران سطر المرجع وسطر «من القرآن الكريم» عند كلمتيهما؛ بلاهما يظهر كل شيء مع o كما كان */
export const VerseRefPanel: React.FC<{ refText: string; o: number; oRef?: number; oSub?: number }> = ({ refText, o, oRef, oSub }) =>
  o <= 0 ? null : (
    <g opacity={o} transform={`translate(1365 500) scale(${0.96 + 0.04 * o}) translate(-1365 -500)`}>
      <rect x={1100} y={330} width={530} height={340} rx={18} fill="#FFFAF0" opacity={0.55} />
      <rect x={1100} y={330} width={530} height={340} rx={18} fill="none" stroke={C.gold} strokeWidth={4} />
      <rect x={1114} y={344} width={502} height={312} rx={12} fill="none" stroke={C.gold} strokeWidth={1.5} />
      <QuranSeal x={1365} y={420} s={1.05} />
      <SText x={1365} y={560} size={64} color={C.ink} o={oRef ?? 1}>
        {refText.replace(" · ", ": ")}
      </SText>
      <SText x={1365} y={625} size={28} font="tajawal" weight={500} color={C.inkSoft} o={oSub ?? 1}>
        من القرآن الكريم
      </SText>
    </g>
  );
