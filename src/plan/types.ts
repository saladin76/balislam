import type { Domain, ThemeId } from "../../brand/themes";
import type { Overlays } from "../../brand/identity/index";

/** مؤثر صوتي داخل مشهد: at بالثواني من بداية المشهد. */
export type PlanSfx = { id: string; at: number };

export type PlanScene = {
  /** ثابت لا يتغير عند إعادة التوليد: c<الفصل>-s<الترتيب> */
  id: string;
  template: string;
  /** نص التعليق الصوتي (مصدره السكريبت؛ يُعدَّل هناك) */
  narration: string;
  /** سطر البداية في script.md */
  line: number;
  /** حقول القالب (السؤال، الشخصية، العنصر…) */
  props: Record<string, string>;
  /** مدة يدوية بالثواني؛ إن غابت تُحسب من طول التعليق */
  durationSec?: number;
  /** خلفية من المكتبة؛ إن غابت تُستخدم زخرفة الثيم */
  backdrop?: string;
  /** قديم: يعادل overlays.captions */
  captions?: boolean;
  /** إظهار/إخفاء عناصر الشاشة لهذا المشهد فقط (ما لم يُحدَّد يتبع الحلقة) */
  overlays?: Partial<Overlays>;
  sfx: PlanSfx[];
  /** للآيات: مفتاح مثل 53:39 */
  ayahKey?: string;
  /** عدّلها المستخدم يدويًا: تُحفظ عند إعادة التوليد */
  edited?: boolean;
  /** نبرة الصوت لهذا المشهد (تتجاوز نبرة الحلقة) */
  tone?: string;
  /** صوت آخر من ElevenLabs لهذا المشهد (حوار شخصية): معرّف الصوت */
  voice?: string;
  /** كيف يدخل هذا المشهد من الذي قبله (الأمر 011)؛ بلا الحقل يبقى التلاشي القائم. الصيغة في src/plan/transitions.ts */
  transition?: string;
};

export type PlanChapter = { number: number; title: string; scenes: PlanScene[] };

export type Plan = {
  version: 1;
  episode: string;
  title: string;
  domain: Domain;
  themeId: ThemeId;
  /** القناة صاحبة الحلقة */
  channel?: string;
  /** لغة الحلقة (رمز مثل ar أو tr أو en) */
  lang?: string;
  updatedAt: string;
  /** إظهار/إخفاء عناصر الشاشة للحلقة كلها (ما لم يُحدَّد يتبع القناة) */
  overlays?: Partial<Overlays>;
  /** نبرة الصوت للحلقة كلها (تتجاوز نبرة القناة) */
  tone?: string;
  /** افتتاحية القناة في أول الحلقة (افتراضيًا تظهر إن كانت للقناة افتتاحية) */
  intro?: boolean;
  /**
   * أدوات المحرك التي كانت معتمدة افتراضيًا للقناة لحظة إنشاء الخطة (src/plan/engine.ts).
   * تُختم مرة واحدة، فلا يغيّر اعتماد لاحق حلقة قائمة؛ وغيابها = السلوك القديم.
   */
  engineDefaults?: string[];
  chapters: PlanChapter[];
};
