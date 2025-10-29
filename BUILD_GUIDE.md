# 📱 تطبيق نظام الحوالات - دليل البناء والنشر

## 🌐 الموقع الإلكتروني (Web)
التطبيق يعمل حالياً كموقع ويب على المنصة الحالية.

## 📦 بناء التطبيقات

### 1️⃣ بناء تطبيق Android (APK)

#### المتطلبات:
- Android Studio مثبت
- Java Development Kit (JDK) 11 أو أعلى

#### الخطوات:
```bash
cd /app/frontend

# تحديث التطبيق
yarn build

# نسخ الملفات إلى Android
npx cap sync android

# فتح المشروع في Android Studio
npx cap open android
```

**في Android Studio:**
1. اذهب إلى `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
2. انتظر اكتمال البناء
3. ستجد ملف APK في: `android/app/build/outputs/apk/debug/app-debug.apk`

#### بناء APK للإصدار (Release):
```bash
cd /app/frontend/android

# بناء APK موقع
./gradlew assembleRelease

# ملف APK سيكون في:
# android/app/build/outputs/apk/release/app-release-unsigned.apk
```

### 2️⃣ بناء تطبيق iOS (IPA)

#### المتطلبات:
- macOS
- Xcode مثبت
- حساب Apple Developer

#### الخطوات:
```bash
cd /app/frontend

# تحديث التطبيق
yarn build

# نسخ الملفات إلى iOS
npx cap sync ios

# فتح المشروع في Xcode
npx cap open ios
```

**في Xcode:**
1. اختر `Product` → `Archive`
2. بعد اكتمال الأرشفة، اختر `Distribute App`
3. اختر الطريقة المناسبة (App Store, Ad Hoc, Enterprise)
4. اتبع التعليمات لإنشاء IPA

## 🔑 الأذونات المضافة

### Android (`AndroidManifest.xml`):
- ✅ `CAMERA` - الوصول للكاميرا
- ✅ `MANAGE_EXTERNAL_STORAGE` - إدارة التخزين الخارجي
- ✅ `POST_NOTIFICATIONS` - إرسال الإشعارات
- ✅ `READ_EXTERNAL_STORAGE` - قراءة التخزين
- ✅ `WRITE_EXTERNAL_STORAGE` - كتابة التخزين

### iOS (`Info.plist`):
- ✅ `NSCameraUsageDescription` - وصف استخدام الكاميرا
- ✅ `NSPhotoLibraryUsageDescription` - وصف الوصول للمعرض
- ✅ `NSPhotoLibraryAddUsageDescription` - وصف حفظ الصور
- ✅ `NSUserNotificationUsageDescription` - وصف الإشعارات

## 🛠️ التطوير

### تحديث التطبيقات بعد تعديل الكود:
```bash
cd /app/frontend

# بناء مشروع React
yarn build

# مزامنة التغييرات مع التطبيقات
npx cap sync

# أو مزامنة منصة واحدة فقط:
npx cap sync android
npx cap sync ios
```

### تشغيل التطبيق على المحاكي:
```bash
# Android
npx cap run android

# iOS (macOS فقط)
npx cap run ios
```

## 📝 ملاحظات مهمة

### للكاميرا:
- في التطبيق الأصلي (Android/iOS)، الكاميرا تعمل مباشرة
- في الموقع الإلكتروني، تحتاج HTTPS للكاميرا

### للإشعارات:
- يجب تفعيل Firebase Cloud Messaging (FCM) لإشعارات Android
- يجب إعداد Apple Push Notification Service (APNs) لإشعارات iOS

### الأيقونات والـ Splash Screen:
الأيقونات موجودة في:
- Android: `android/app/src/main/res/`
- iOS: `ios/App/App/Assets.xcassets/`

لتحديث الأيقونات، استخدم:
```bash
# تثبيت الأداة
npm install -g @capacitor/assets

# توليد الأيقونات من صورة واحدة
npx @capacitor/assets generate --iconBackgroundColor '#1e3a5f' --iconBackgroundColorDark '#1e3a5f'
```

## 🚀 النشر

### Google Play Store (Android):
1. قم بإنشاء حساب على Google Play Console
2. قم بتوقيع APK
3. ارفع APK إلى Play Console
4. املأ معلومات التطبيق
5. انشر التطبيق

### Apple App Store (iOS):
1. قم بإنشاء حساب Apple Developer ($99/سنة)
2. قم بإنشاء App ID في App Store Connect
3. استخدم Xcode للأرشفة والرفع
4. انشر التطبيق بعد المراجعة

## 🔗 روابط مفيدة

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/)
- [iOS Developer Guide](https://developer.apple.com/)
- [React Documentation](https://react.dev/)

## 💡 دعم

للمساعدة أو الاستفسارات، يرجى الرجوع إلى الوثائق أو التواصل مع فريق التطوير.
