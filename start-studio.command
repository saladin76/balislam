#!/bin/bash
# تشغيل استوديو بالإسلام على الماك: دبل كليك على الملف ده.
cd "$(dirname "$0")" || exit 1
echo "تحديث المشروع…"
git pull --ff-only || echo "تعذّر التحديث (هنكمل بالنسخة الحالية)"
# تثبيت الحزم فقط لو اتغيرت
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm install
fi
( sleep 3; open "http://127.0.0.1:4321" ) &
echo "الاستوديو شغال. سيب النافذة دي مفتوحة؛ للإيقاف: Ctrl + C"
npm run app
