#!/bin/bash

# نظام الحوالات - Build Script
# هذا السكريبت يساعد في بناء التطبيقات لجميع المنصات

set -e

echo "🚀 بدء عملية البناء لنظام الحوالات"
echo "========================================="

cd /app/frontend

# 1. بناء React App
echo ""
echo "📦 الخطوة 1: بناء تطبيق React..."
yarn build

if [ $? -eq 0 ]; then
    echo "✅ تم بناء React بنجاح"
else
    echo "❌ فشل بناء React"
    exit 1
fi

# 2. مزامنة مع Capacitor
echo ""
echo "🔄 الخطوة 2: مزامنة مع Capacitor..."
npx cap sync

if [ $? -eq 0 ]; then
    echo "✅ تمت المزامنة بنجاح"
else
    echo "❌ فشلت المزامنة"
    exit 1
fi

# 3. عرض الخيارات
echo ""
echo "✅ البناء الأساسي اكتمل!"
echo ""
echo "الخطوات التالية:"
echo "==================="
echo ""
echo "📱 لبناء تطبيق Android:"
echo "   npx cap open android"
echo "   ثم في Android Studio:"
echo "   Build → Build Bundle(s) / APK(s) → Build APK(s)"
echo ""
echo "🍎 لبناء تطبيق iOS:"
echo "   npx cap open ios"
echo "   ثم في Xcode:"
echo "   Product → Archive"
echo ""
echo "🌐 الموقع الإلكتروني جاهز في مجلد: build/"
echo ""
echo "📚 للمزيد من التفاصيل، راجع: /app/BUILD_GUIDE.md"
echo ""
