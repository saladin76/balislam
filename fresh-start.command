#!/bin/bash
# بداية نظيفة للاستوديو على الماك: دبل كليك على الملف ده (مرة واحدة عند الحاجة).
# 1) يطابق المشروع مع آخر نسخة على GitHub تمامًا (وتُلغى أي تعديلات محلية على ملفات المشروع).
# 2) ينقل كل محتوى الحلقات القديمة (صوت، فيديو، صور، حالة النشر، حلقات محذوفة) إلى أرشيف خارج المشروع،
#    فلا يظهر في الاستوديو ولا يضيع (يمكنك حذف الأرشيف يدويًا لاحقًا).
# 3) يثبّت الحزم، ويفحص المشروع، ثم يفتح الاستوديو.
# لا يلمس: ملف المفاتيح .env، والمؤثرات الصوتية المولَّدة (assets/sfx)، والتلاوات المرخّصة (assets/recitations).
cd "$(dirname "$0")" || exit 1
set -u

ARCHIVE="$HOME/balislam-archive/$(date +%Y-%m-%d_%H-%M)"
echo "بداية نظيفة للاستوديو"
echo "المحتوى القديم سيُنقل إلى: $ARCHIVE"
read -r -p "اكتب نعم للمتابعة: " ok
[ "$ok" = "نعم" ] || { echo "أُلغي."; exit 0; }

echo "١/٤ مطابقة المشروع مع GitHub…"
git fetch origin || { echo "تعذّر الاتصال بـ GitHub."; exit 1; }
git merge --abort 2>/dev/null
git reset --hard origin/main || exit 1

echo "٢/٤ نقل المحتوى القديم إلى الأرشيف…"
mkdir -p "$ARCHIVE"
# ينقل ملفًا أو مجلدًا إلى المسار نفسه داخل الأرشيف (ويدمج المجلدات إن وُجدت هناك)
archive() {
  p="${1%/}"
  [ -e "$p" ] || return 0
  dst="$ARCHIVE/$p"
  if [ -d "$p" ]; then mkdir -p "$dst" && cp -R "$p/." "$dst/" && rm -rf "$p"
  else mkdir -p "$(dirname "$dst")" && mv "$p" "$dst"; fi
}
# كل ما ليس في GitHub داخل القنوات (صوت، فيديو، صور، حلقات محذوفة) والمخرجات المولَّدة
git ls-files --others --ignored --exclude-standard --directory -- channels renders public/_render | while read -r p; do archive "$p"; done
git ls-files --others --exclude-standard --directory -- channels | while read -r p; do archive "$p"; done
# مجلدات الحلقات التي بقيت فارغة
find channels -type d -empty -path "*/episodes/*" -delete 2>/dev/null
echo "   المنقول: $(find "$ARCHIVE" -type f | wc -l | tr -d ' ') ملفًا"

echo "٣/٤ تثبيت الحزم وفحص المشروع…"
npm install --no-audit --no-fund >/dev/null || { echo "فشل تثبيت الحزم."; exit 1; }
npm run typecheck >/dev/null && echo "   المشروع سليم." || echo "   ⚠️ فحص الأنواع فشل: أرسل هذه الرسالة إلى Claude."

echo "٤/٤ تشغيل الاستوديو…"
( sleep 3; open "http://127.0.0.1:4321" ) &
npm run app
