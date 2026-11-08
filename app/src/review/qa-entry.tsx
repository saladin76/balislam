/** Independent real React QA route; contains NO production assets or approvals. */
import React from "react";
import { createRoot } from "react-dom/client";
import { SceneReviewWorkspace } from "./SceneReviewWorkspace";
import type { SceneSeed } from "./model";
import "../styles.css";

const samples: SceneSeed[] = [
  {
    id: "c1-s1", ordinal: 1, chapter: "الفصل الأول — التمهيد",
    title: "المشهد 01 — افتتاحية",
    narration: "عندما ننظر إلى التاريخ، نجد أن التحولات الكبرى تبدأ أحيانًا من تفاصيل صغيرة.",
    storyboard: "تظهر خريطة مبسطة تدريجيًا، ثم تبرز نقطة مركزية ترتبط بعناصر توضيحية متتابعة.",
    artDirection: "لوحة ألوان هادئة، عنوان واضح، حركة تدعم السرد دون تشتيت.",
    camera: "Zoom Out بطيء، ثم ثبات مقصود",
    transition: "Match Cut", timing: "إظهار العناصر عند الكلمات المفتاحية في التعليق",
    durationSec: 8, elements: ["map", "title", "timeline"],
  },
  {
    id: "c1-s2", ordinal: 2, chapter: "الفصل الأول — التمهيد",
    title: "المشهد 02 — بناء السياق",
    narration: "قبل ظهور المدينة، كانت المنطقة تمر بمراحل متعددة من التغير.",
    storyboard: "مخطط زمني ببطاقات معلومات مرتبة.",
    artDirection: "أسلوب Infographic", camera: "Static", transition: "Dissolve",
    timing: "انتقال البطاقة بعد نطق عنوانها", durationSec: 12, elements: ["timeline"],
  },
  {
    id: "c1-s3", ordinal: 3, chapter: "الفصل الثاني — المقارنة",
    title: "المشهد 03 — لحظة صامتة",
    narration: "", storyboard: "صورة ثابتة وهدوء مقصود لثلاث ثوانٍ.",
    artDirection: "Minimal", camera: "Slow Pan", transition: "Hard Cut",
    timing: "صمت متعمد مع مؤثر محيطي بسيط", durationSec: 3, elements: ["background"],
  },
  {
    id: "c2-s1", ordinal: 4, chapter: "الفصل الثاني — المقارنة",
    title: "المشهد 04 — خلاصة الفكرة",
    narration: "وهكذا تتضح لنا العلاقة بين السبب والنتيجة.",
    storyboard: "عنصران يندمجان في رسم توضيحي واحد.",
    artDirection: "Clean 2D", camera: "Static", transition: "Morph",
    timing: "لحظة الاندماج عند كلمة النتيجة", durationSec: 7, elements: ["diagram"],
  },
];
const video = new URLSearchParams(window.location.search).has("no-video") ?
  undefined : "/scene-review-qa.mp4";
createRoot(document.getElementById("root")!).render(
  <SceneReviewWorkspace channelId="balislam" episodeId="001-scene-review-qa"
    episodeTitle="حلقة اختبارية — لا ملفات إنتاج" seeds={samples}
    initialMode="demo" initialSceneId="c1-s1" demoVideoUrl={video}/>
);
