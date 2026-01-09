# 🏦 نظام إدارة الحوالات المالية

نظام متكامل لإدارة الحوالات المالية مع لوحة تحكم للمدير ولوحات للوكلاء.

---

## 📋 المتطلبات

| البرنامج | الإصدار المطلوب |
|----------|----------------|
| Python | 3.11+ |
| Node.js | 18+ |
| MongoDB | 6.0+ |
| Yarn | 1.22+ |

---

## 🚀 التشغيل السريع

### 1️⃣ تثبيت MongoDB

**Windows:**
```bash
# حمّل من: https://www.mongodb.com/try/download/community
# أو استخدم chocolatey:
choco install mongodb
net start MongoDB
```

**Mac:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Linux (Ubuntu):**
```bash
sudo apt update
sudo apt install mongodb
sudo systemctl start mongodb
```

### 2️⃣ تشغيل Backend

```bash
cd backend

# إنشاء بيئة افتراضية
python -m venv venv

# تفعيل البيئة
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# تثبيت المكتبات
pip install -r requirements.txt

# إعداد ملف البيئة
cp .env.example .env

# تشغيل السيرفر
uvicorn server:app --host 0.0.0.0 --port 8001
```

### 3️⃣ تشغيل Frontend

```bash
# في terminal جديد
cd frontend

# تثبيت المكتبات
yarn install

# إعداد ملف البيئة
cp .env.example .env

# تشغيل التطبيق
yarn start
```

---

## 🌐 الروابط

| الخدمة | الرابط |
|--------|--------|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8001 |
| API Documentation | http://localhost:8001/docs |

---

## 🔐 بيانات الدخول الافتراضية

| المستخدم | اسم المستخدم | كلمة المرور | الدور |
|----------|--------------|-------------|-------|
| المدير | admin | admin123 | admin |

---

## 📁 هيكل المشروع

```
├── backend/
│   ├── server.py           # السيرفر الرئيسي (FastAPI)
│   ├── requirements.txt    # مكتبات Python
│   ├── .env.example        # نموذج ملف البيئة
│   └── .env                # ملف البيئة (أنشئه)
│
├── frontend/
│   ├── src/
│   │   ├── services/
│   │   │   └── api.js      # ملف API الموحد
│   │   ├── pages/          # صفحات التطبيق
│   │   ├── components/     # المكونات
│   │   └── contexts/       # Context providers
│   ├── package.json
│   ├── .env.example        # نموذج ملف البيئة
│   └── .env                # ملف البيئة (أنشئه)
│
└── local_setup/
    ├── database/           # بيانات JSON للاستيراد
    ├── import_data.py      # سكربت استيراد البيانات
    └── LOCAL_SETUP_GUIDE.md
```

---

## 📥 استيراد البيانات (اختياري)

إذا أردت استيراد بيانات تجريبية:

```bash
cd local_setup
pip install pymongo
python import_data.py
```

---

## 🔧 API Endpoints

جميع الـ endpoints تبدأ بـ `/api`:

| Endpoint | Method | الوصف |
|----------|--------|-------|
| /api/login | POST | تسجيل الدخول |
| /api/transfers | GET/POST | الحوالات |
| /api/users | GET | المستخدمين |
| /api/accounting/accounts | GET | الحسابات |

للتوثيق الكامل: http://localhost:8001/docs

---

## ⚠️ ملاحظات مهمة

1. **MongoDB يجب أن يكون يعمل** قبل تشغيل Backend
2. **لا تستخدم npm** - استخدم yarn فقط
3. **SECRET_KEY** يجب تغييره في الإنتاج

---

## 🆘 حل المشاكل

### المشكلة: MongoDB لا يعمل
```bash
# Windows
net start MongoDB

# Mac
brew services start mongodb-community

# Linux
sudo systemctl start mongodb
```

### المشكلة: Port مستخدم
```bash
# تغيير port الـ backend
uvicorn server:app --port 8002

# تحديث frontend/.env
REACT_APP_BACKEND_URL=http://localhost:8002
```

### المشكلة: Module not found
```bash
pip install -r requirements.txt --force-reinstall
```

---

## 📞 الدعم

للمساعدة أو الإبلاغ عن مشاكل، تواصل معنا.
