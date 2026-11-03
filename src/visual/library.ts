/**
 * مكتبة صور القناة: لقطات واقعية عامة تُولَّد مرة واحدة (Firefly أو غيره) وتُستعمل في حلقات كثيرة.
 * كل خانة لها: معرّف (= اسم الملف)، ومجموعة، ووصف عربي، ووصف إنجليزي للمشهد فقط
 * (أسلوب القناة وقواعد الوجوه تُضاف تلقائيًا من prompts.ts)، ونوعها (لقطة أو وثيقة أو فيديو).
 * لا نبي ولا صحابي ولا ملَك في أي خانة، ولا أماكن مقدسة بتفاصيل يمكن أن تُفهم خطأ.
 */
export type LibrarySlot = {
  id: string;
  group: string;
  titleAr: string;
  prompt: string;
  look?: "scene" | "archive";
  /** مقطع فيديو قصير بدل صورة (Firefly Video) */
  video?: boolean;
  /**
   * وثيقة حقيقية من المتاحف بدل التوليد (بحث في Wikimedia Commons): المخطوطات والخرائط والعملات المولّدة
   * تخرج بكتابة عربية مشوّهة يلاحظها المشاهد فورًا، والأصل متاح مجانًا بترخيص مفتوح.
   */
  museum?: string;
};

const d = (group: string, rows: [string, string, string, ("archive" | "video")?][]): LibrarySlot[] =>
  rows.map(([id, titleAr, prompt, kind]) => ({ id, group, titleAr, prompt, look: kind === "archive" ? "archive" : "scene", video: kind === "video" }));

/** كلمات البحث في Wikimedia Commons لكل وثيقة (ملفات بترخيص مفتوح أو ملكية عامة) */
const museumSearch: Record<string, string> = {
  "map-world": "Al-Idrisi Tabula Rogeriana",
  "manuscript-astronomy": "al-Sufi Book of Fixed Stars manuscript",
  "manuscript-medicine": "Hunayn ibn Ishaq eye manuscript",
  "manuscript-math": "al-Khwarizmi algebra manuscript",
  "astrolabe-brass": "Andalusian astrolabe",
  coins: "Abbasid gold dinar",
  "letter-seal": "illuminated Arabic manuscript Abbasid",
};

export const channelLibraries: Record<string, LibrarySlot[]> = {
  "dafatir-alzaman": [
    ...d("مدن", [
      ["baghdad-river", "بغداد على دجلة", "Wide establishing shot of medieval Baghdad on the Tigris river at golden hour, round city walls, brick domes and slender minarets, wooden boats on the river, palm trees along the banks"],
      ["baghdad-night", "بغداد ليلًا", "Medieval Baghdad at night seen from a rooftop, warm oil lamps glowing in thousands of windows, domes under a starry sky, the Tigris reflecting the lights"],
      ["cairo-citadel", "القاهرة والقلعة", "Medieval Cairo seen from the hills at sunrise, a stone citadel on a hill, many minarets and domes rising through morning haze, the Nile in the distance"],
      ["cordoba-bridge", "قرطبة والجسر", "Medieval Cordoba in Al-Andalus, a long Roman stone bridge over the Guadalquivir river, a great mosque with horseshoe arches behind it, soft evening light"],
      ["damascus-gate", "دمشق وبابها", "A massive old stone gate of medieval Damascus, travelers and donkeys passing through, orchards and the mountain behind the city, warm afternoon light"],
      ["samarkand-domes", "سمرقند والقباب الزرقاء", "Medieval Samarkand with turquoise tiled domes and tall portals, a busy square at dawn, dusty light, distant mountains"],
      ["alexandria-port", "ميناء الإسكندرية", "The ancient harbor of Alexandria with wooden sailing ships, a tall stone lighthouse on an island, blue Mediterranean sea, bright morning"],
      ["granada-palace", "غرناطة والقصر الأحمر", "A red stone fortress palace on a hill above medieval Granada, snowy mountains behind it, cypress trees, golden sunset"],
      ["istanbul-walls", "أسوار القسطنطينية", "The massive triple land walls of Constantinople in the 15th century, towers stretching into the distance, morning fog, a vast plain in front"],
      ["city-ruins", "مدينة خربة", "Ruins of a once great medieval Islamic city after a siege, broken domes and collapsed arches, smoke rising, grey overcast sky, dust in the air"],
    ]),
    ...d("أماكن داخلية", [
      ["library-hall", "قاعة مكتبة كبرى", "A grand medieval library hall, carved wooden shelves full of manuscripts reaching the ceiling, tall arched windows, light beams with floating dust, a scholar seen from behind at a desk"],
      ["scriptorium-lamp", "نسّاخ على ضوء السراج", "Close shot of the hands of a scribe holding a reed pen above blank paper by an oil lamp at night, ink pots and stacks of paper, warm candlelight, shallow depth of field, face not visible"],
      ["palace-hall", "قاعة العرش", "A vast medieval palace hall with marble columns, carved stucco arches, hanging brass lanterns, guards standing far away, sunlight through high windows"],
      ["observatory", "مرصد فلكي", "A medieval Islamic observatory at night, a giant brass astrolabe and stone sextant, a starry sky through an open dome, an astronomer seen from behind"],
      ["bimaristan", "مستشفى (بيمارستان)", "Interior of a medieval hospital courtyard with a fountain, arched corridors, physicians in robes seen from afar, herbs and jars on shelves, soft daylight"],
      ["courtyard-fountain", "صحن بنافورة", "A quiet medieval courtyard with a marble fountain, orange trees, carved arches and tiles, early morning light and long shadows"],
      ["council-room", "مجلس شورى", "A dim medieval council chamber, men in robes seated in a circle on carpets seen from behind, oil lamps, maps on a low table, tense atmosphere"],
      ["prison-cell", "زنزانة", "A dark medieval stone prison cell, a single shaft of light from a small high window, chains on the wall, dust in the light"],
    ]),
    ...d("أسواق وناس", [
      ["market-street", "سوق مزدحم", "A crowded medieval Middle Eastern market street, spice stalls, hanging lanterns and fabrics, people seen from behind and from afar, shafts of sunlight through a covered roof"],
      ["port-merchants", "تجار في الميناء", "Merchants unloading crates and sacks from wooden ships in a medieval harbor, ropes and masts, workers seen from afar, late afternoon light"],
      ["caravanserai", "خان القوافل", "A stone caravanserai courtyard at dusk, camels resting, travelers around small fires seen from afar, arched rooms around the courtyard"],
      ["crowd-square", "حشد في ساحة", "A large crowd gathered in a medieval city square seen from high above, a speaker on steps far away, banners, dust and late light"],
      ["farmers-field", "فلاحون في الحقول", "Farmers working in green fields by a river with a waterwheel, palm trees, a village of mud houses, soft morning mist, figures distant"],
    ]),
    ...d("طبيعة وطرق", [
      ["caravan-dunes", "قافلة على الكثبان", "A long camel caravan crossing golden sand dunes at sunset, merchants wrapped in cloth seen from a distance, long shadows, heat haze, a distant walled oasis on the horizon"],
      ["desert-night", "صحراء ليلًا", "An empty desert at night under the milky way, a small camp with one fire, silhouettes of camels, deep blue sky"],
      ["mountain-pass", "ممر جبلي", "A narrow mountain pass with an ancient road, a line of travelers and horses far away, clouds clinging to the peaks, dramatic light"],
      ["river-nile", "النيل", "The Nile river at dawn with traditional sailing boats, palm trees and fields along the banks, mist on the water"],
      ["sea-storm", "بحر عاصف", "A wooden sailing ship struggling through a stormy sea at night, huge waves, lightning in the distance"],
      ["oasis", "واحة", "A green oasis with palm trees and a pool of water in the middle of a vast desert, mud brick houses, midday heat haze"],
    ]),
    ...d("حرب وحصار (من بعيد)", [
      ["army-march", "جيش يزحف", "A vast medieval army marching across a plain seen from a hilltop, thousands of soldiers and banners, dust clouds rising, overcast dramatic sky"],
      ["siege-camp", "معسكر حصار ليلًا", "A huge army camp at night outside a walled city, hundreds of campfires on the plain, tents and siege towers, smoke and moonlight"],
      ["walls-commander", "قائد على السور", "A commander seen from behind standing on massive stone city walls at night, looking down at an enemy camp with campfires, torches on the battlements, wind in his cloak"],
      ["cavalry-charge", "خيالة تندفع", "Cavalry charging across a dusty plain seen from far away, horses and riders as silhouettes in a huge cloud of dust, low sun behind them"],
      ["fleet-sea", "أسطول في البحر", "A medieval war fleet of wooden galleys with oars and sails at sea, seen from above, calm water, morning haze"],
      ["city-burning", "مدينة تحترق", "A medieval city burning at night seen from a distant hill, orange smoke filling the sky, silhouettes of domes and towers"],
      ["battlefield-after", "بعد المعركة", "A quiet battlefield after the battle at dawn, broken banners and spears in the ground, mist over the field, crows in the sky, no bodies visible"],
    ]),
    // الأرشيف: أصول حقيقية من المتاحف (مجانية) لا صور مولّدة
    ...d("أرشيف ووثائق (من المتاحف مجانًا)", [
      ["map-world", "خريطة الإدريسي", "", "archive"],
      ["manuscript-astronomy", "مخطوطة فلك", "", "archive"],
      ["manuscript-medicine", "مخطوطة طب (العين)", "", "archive"],
      ["manuscript-math", "مخطوطة الخوارزمي", "", "archive"],
      ["astrolabe-brass", "أسطرلاب أندلسي", "", "archive"],
      ["coins", "دينار عباسي", "", "archive"],
      ["letter-seal", "مخطوطة مصحف أو كتاب مذهّب", "", "archive"],
    ]).map((s) => ({ ...s, museum: museumSearch[s.id] })),
    ...d("مقاطع فيديو قصيرة", [
      ["v-fire-torch", "شعلة نار", "Close shot of a burning torch flame flickering in the wind at night, sparks rising, dark stone wall behind", "video"],
      ["v-sand-wind", "رمال تتطاير", "Wind blowing sand over the crest of a desert dune at sunset, slow motion, golden light", "video"],
      ["v-waves-ship", "أمواج حول سفينة", "Waves hitting the wooden hull of a sailing ship at sea, spray in the air, overcast light", "video"],
      ["v-banner-wind", "راية في الريح", "A plain dark cloth banner without symbols waving slowly in the wind on a wooden pole against a cloudy sky", "video"],
      ["v-ink-pen", "قلم يكتب", "A reed pen dipping into an ink pot, then drawing a single curved ink stroke on blank paper, macro shot, candlelight", "video"],
      ["v-candle-library", "شموع في مكتبة", "Candle flames flickering in a dark library with shelves of old manuscripts, slow camera push", "video"],
      ["v-stars-desert", "نجوم فوق الصحراء", "Time lapse of stars moving over desert dunes at night, milky way", "video"],
      ["v-smoke-city", "دخان فوق مدينة", "Smoke drifting slowly over the domes of an old city at dusk, slow motion", "video"],
    ]),
  ],
  // زبدة الكتب: «القلم المميِّز» نظام أبيض وأسود، فلا تصوير ملون في مكتبتها (حُذفت الخانات الملونة القديمة بطلب صاحب القناة)
  "zubdat-alkutub": [],
  balislam: [
    ...d("طبيعة وسكينة", [
      ["dawn-sky", "سماء الفجر", "A calm dawn sky over a quiet town with a single minaret silhouette, soft pink and gold clouds, no people"],
      ["rain-window", "مطر على النافذة", "Rain drops on a window glass with a blurred warm room behind, cozy calm mood, no people"],
      ["tree-roots", "شجرة جذورها ثابتة", "A huge old tree with deep roots on a green hill under a wide sky, morning light, no people"],
      ["sea-horizon", "البحر والأفق", "A calm sea horizon at sunset with gentle waves on the sand, no people"],
      ["night-stars", "نجوم الليل", "A clear night sky full of stars over quiet mountains, a small lit house far away, no people"],
      ["desert-path", "طريق في الصحراء", "A long path through calm desert dunes toward the horizon at sunrise, no people"],
    ]),
    ...d("البيت والحياة", [
      ["home-table", "مائدة البيت", "A simple family dinner table set with bread, dates and tea in a warm home, empty chairs waiting, evening lamp light, no people"],
      ["mosque-light", "ضوء في مسجد", "Interior of a simple mosque with carpets and arches, sunlight beams through the windows, peaceful and empty, no people"],
      ["kitchen-morning", "مطبخ صباحًا", "A bright kitchen in the morning with tea brewing and fresh bread on the counter, sunlight, no people"],
      ["desk-phone", "هاتف على المكتب", "A smartphone face down on a wooden desk next to an open notebook and a cup of tea, calm mood, no people"],
      ["market-fruit", "سوق الفاكهة", "Colorful fruit and vegetable stalls in a traditional market in the morning, no people visible"],
      ["wallet-coins", "محفظة ونقود", "An old leather wallet with a few coins and bills on a wooden table, soft light, no people"],
    ]),
  ],
};

export const librarySlot = (channel: string, id: string) => channelLibraries[channel]?.find((s) => s.id === id);
