#!/bin/bash
# بداية نظيفة للاستوديو على الماك: دبل كليك على الملف ده (مرة واحدة عند الحاجة).
# 1) يطابق المشروع مع آخر نسخة على GitHub تمامًا (وتُلغى أي تعديلات محلية على ملفات المشروع).
# 2) ينقل كل محتوى الحلقات القديمة (صوت، فيديو، صور، حالة النشر، حلقات محذوفة) إلى أرشيف خارج المشروع،
#    فلا يظهر في الاستوديو ولا يضيع (يمكنك حذف الأرشيف يدويًا لاحقًا).
# 3) يثبّت الحزم، ويفحص المشروع، ثم يفتح الاستوديو.
# لا يلمس: ملف المفاتيح .env، والمؤثرات الصوتية المولَّدة (assets/sfx)، والتلاوات المرخّصة (assets/recitations).
# ولا يؤرشف ولا يحذف أبدًا (is_protected أدناه): اعتمادات المالك (سجل المشاهد وكل ملفات الاعتماد)، وجلسة المالك (.studio/)،
# وصندوق الملاحظات (notes/)، والصوت (voice/ كله: index.json وsentences.json وتسجيلات الجمل السابقة والمستبدَلة في voice/superseded/، D50)، والتلاوات (recitations/)، ومسودات الرندر (out/).
# وإن كان في ملف اعتماد متتبَّع تعديل غير محفوظ، أو commits محلية لم تُرفع، يتوقف قبل أي تغيير.
cd "$(dirname "$0")" || exit 1
set -u

# مسار محمي: لا يُنقل إلى الأرشيف ولا يُحذف (يبقى في مكانه داخل المشروع).
is_protected() {
  case "${1%/}" in
    .studio|.studio/*|.env) return 0 ;;
    # voice/ كله: المقاطع وindex.json وsentences.json (الجمل وتسجيلاتها takes) وsuperseded/ (D50)
    channels/*/episodes/*/voice|channels/*/episodes/*/voice/*) return 0 ;;
    channels/*/episodes/*/recitations|channels/*/episodes/*/recitations/*) return 0 ;;
    channels/*/episodes/*/out|channels/*/episodes/*/out/*) return 0 ;;
    channels/*/episodes/*/notes|channels/*/episodes/*/notes/*) return 0 ;;
    channels/*/episodes/*/scene-production.v1.json*|channels/*/episodes/*/workflow-approvals.json*) return 0 ;;
    channels/*/episodes/*/scene-workflow.v2.json*) return 0 ;;
    channels/*/episodes/*/storyboard.json|channels/*/episodes/*/script-signoff.json) return 0 ;;
    channels/*/episodes/*/voice-review.json|channels/*/episodes/*/scene-review.json) return 0 ;;
    channels/*/episodes/*/review.json|channels/*/episodes/*/status.json|channels/*/episodes/*/publish.json) return 0 ;;
    channels/*/episodes/*/plan.local.json|channels/*/episodes/*/plan.backup-*.json) return 0 ;;
    assets/recitations|assets/recitations/*|out|out/*) return 0 ;;
  esac
  return 1
}

ARCHIVE="$HOME/balislam-archive/$(date +%Y-%m-%d_%H-%M)"
echo "بداية نظيفة للاستوديو"
echo "المحتوى القديم سيُنقل إلى: $ARCHIVE"
read -r -p "اكتب نعم للمتابعة: " ok
[ "$ok" = "نعم" ] || { echo "أُلغي."; exit 0; }

echo "١/٤ مطابقة المشروع مع GitHub…"
git fetch origin || { echo "تعذّر الاتصال بـ GitHub."; exit 1; }
# قبل أي تغيير: لا تُلغى اعتمادات أو ملاحظات محفوظة في ملفات متتبَّعة لم تُرفع بعد.
held=""
while IFS= read -r -d '' p; do is_protected "$p" && held="$held
   • $p"; done < <(git -c core.quotePath=false diff -z --name-only HEAD -- 2>/dev/null)
if [ -n "$held" ]; then
  echo "⛔ توقفت البداية النظيفة ولم يتغير أي ملف: هذه الملفات فيها اعتمادات أو ملاحظات غير محفوظة في Git:$held"
  echo "   احفظها أولًا (أرسل هذه الرسالة إلى Claude)، ثم أعد تشغيل البداية النظيفة."
  exit 1
fi
if [ "$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)" != "0" ]; then
  echo "⛔ توقفت البداية النظيفة ولم يتغير أي ملف: على هذا الجهاز commits لم تُرفع إلى GitHub وقد تحمل اعتماداتك:"
  git log --format='   • %h %s' origin/main..HEAD | head -n 8
  echo "   أرسل هذه الرسالة إلى Claude قبل أي بداية نظيفة."
  exit 1
fi
git merge --abort 2>/dev/null
git reset --hard origin/main || exit 1

echo "٢/٤ نقل المحتوى القديم إلى الأرشيف…"
mkdir -p "$ARCHIVE"
# ينقل ملفًا واحدًا إلى المسار نفسه داخل الأرشيف؛ المسار المحمي يبقى مكانه
archive() {
  p="$1"
  is_protected "$p" && { kept=$((kept + 1)); return 0; }
  [ -f "$p" ] || [ -L "$p" ] || return 0
  dst="$ARCHIVE/$p"
  mkdir -p "$(dirname "$dst")" && mv "$p" "$dst"
}
kept=0
# كل ما ليس في GitHub داخل القنوات (فيديو، صور، حلقات محذوفة) والمخرجات المولَّدة، ملفًا ملفًا
# (بلا --directory: مجلد حلقة غير متتبَّع قد يحمل سجل الاعتماد أو الصوت، فيُفحص كل ملف فيه)
while IFS= read -r -d '' p; do archive "$p"; done < <(git ls-files -z --others --ignored --exclude-standard -- channels renders public/_render)
while IFS= read -r -d '' p; do archive "$p"; done < <(git ls-files -z --others --exclude-standard -- channels)
# مجلدات الحلقات التي بقيت فارغة
find channels -type d -empty -path "*/episodes/*" -delete 2>/dev/null
echo "   المنقول: $(find "$ARCHIVE" -type f | wc -l | tr -d ' ') ملفًا، وبقي في مكانه (محمي): $kept"

echo "٣/٤ تثبيت الحزم وفحص المشروع…"
npm install --no-audit --no-fund >/dev/null || { echo "فشل تثبيت الحزم."; exit 1; }
npm run typecheck >/dev/null && echo "   المشروع سليم." || echo "   ⚠️ فحص الأنواع فشل: أرسل هذه الرسالة إلى Claude."

echo "٤/٤ تشغيل الاستوديو…"
( sleep 3; open "http://127.0.0.1:4321" ) &
npm run app
