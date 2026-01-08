# 🚀 دليل تشغيل نظام الحوالات محلياً (Localhost)

## المتطلبات الأساسية

### 1. تثبيت البرامج المطلوبة:

#### على Windows:
```bash
# تحميل وتثبيت:
# - Python 3.11+ من https://python.org
# - Node.js 18+ من https://nodejs.org
# - MongoDB من https://www.mongodb.com/try/download/community
# - Git من https://git-scm.com
```

#### على Mac:
```bash
brew install python@3.11 node mongodb-community git
brew services start mongodb-community
```

#### على Linux (Ubuntu):
```bash
sudo apt update
sudo apt install python3.11 python3-pip nodejs npm mongodb git
sudo systemctl start mongodb
```

---

## خطوات التشغيل

### الخطوة 1: تحميل الكود
```bash
git clone https://github.com/mualbawi92-cloud/[repo-name].git
cd [repo-name]
```

### الخطوة 2: استيراد البيانات
```bash
# انسخ مجلد local_setup إلى المشروع أولاً
cd local_setup
pip install pymongo
python import_data.py
```

### الخطوة 3: تشغيل Backend
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

# إنشاء ملف .env
echo 'MONGO_URL=mongodb://localhost:27017/money_transfer_db' > .env
echo 'DB_NAME=money_transfer_db' >> .env
echo 'SECRET_KEY=your-secret-key-here-change-it' >> .env

# تشغيل السيرفر
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### الخطوة 4: تشغيل Frontend
```bash
# في terminal جديد
cd frontend

# تثبيت المكتبات
yarn install
# أو
npm install

# إنشاء ملف .env
echo 'REACT_APP_BACKEND_URL=http://localhost:8001' > .env

# تشغيل التطبيق
yarn start
# أو
npm start
```

---

## 🌐 فتح التطبيق

بعد التشغيل، افتح المتصفح:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8001/docs

---

## 🔐 بيانات الدخول

| المستخدم | اسم المستخدم | كلمة المرور | الدور |
|----------|--------------|-------------|-------|
| المدير | admin | admin123 | admin |

---

## ⚠️ حل المشاكل الشائعة

### مشكلة: MongoDB لا يعمل
```bash
# Windows: تشغيل كخدمة
net start MongoDB

# Mac:
brew services start mongodb-community

# Linux:
sudo systemctl start mongodb
```

### مشكلة: Port مستخدم
```bash
# تغيير البورت في Backend
uvicorn server:app --port 8002

# تحديث Frontend .env
REACT_APP_BACKEND_URL=http://localhost:8002
```

### مشكلة: Module not found
```bash
pip install -r requirements.txt --force-reinstall
```

---

## 📁 هيكل الملفات

```
project/
├── backend/
│   ├── server.py          # السيرفر الرئيسي
│   ├── requirements.txt   # مكتبات Python
│   └── .env              # إعدادات البيئة
├── frontend/
│   ├── src/              # كود React
│   ├── package.json      # مكتبات Node
│   └── .env              # إعدادات البيئة
└── local_setup/
    ├── database/         # ملفات البيانات JSON
    ├── import_data.py    # سكربت الاستيراد
    └── LOCAL_SETUP_GUIDE.md  # هذا الدليل
```

---

## 🎉 مبروك!

الآن التطبيق يعمل محلياً بدون انترنت!
