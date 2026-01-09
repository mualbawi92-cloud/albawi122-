# 📦 دليل إنشاء ملف التثبيت (Windows Installer)

## الطريقة 1: النسخة Portable (الأسهل)

### الخطوات:

1. **حمّل المكونات:**
   - [Python 3.11 Embedded](https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip)
   - [MongoDB 6.0 Windows](https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-6.0.13.zip)

2. **أنشئ هيكل المجلدات:**
   ```
   MoneyTransfer/
   ├── python/          ← فك ضغط Python هنا
   ├── mongodb/
   │   ├── bin/         ← انسخ مجلد bin من MongoDB
   │   └── data/        ← أنشئ هذا المجلد
   ├── backend/         ← انسخ مجلد backend
   ├── frontend/        ← انسخ frontend/build هنا
   ├── Start.bat        ← انسخ من portable/
   └── Stop.bat         ← انسخ من portable/
   ```

3. **تفعيل pip في Python Embedded:**
   - افتح ملف `python311._pth` في مجلد python
   - أزل الـ # من سطر `#import site`
   - حمّل [get-pip.py](https://bootstrap.pypa.io/get-pip.py)
   - شغّل: `python\python.exe get-pip.py`

4. **ثبّت مكتبات Python:**
   ```cmd
   python\python.exe -m pip install -r backend\requirements.txt
   ```

5. **ابني Frontend:**
   ```cmd
   cd frontend
   yarn build
   ```
   ثم انسخ محتويات `build/` إلى `MoneyTransfer/frontend/`

6. **انتهى!** يمكنك نسخ مجلد `MoneyTransfer` إلى أي جهاز وتشغيله بـ `Start.bat`

---

## الطريقة 2: إنشاء Installer بـ Inno Setup

1. **حمّل [Inno Setup](https://jrsoftware.org/isdl.php)**

2. **جهّز النسخة Portable** (الطريقة 1)

3. **افتح `setup.iss`** في Inno Setup Compiler

4. **اضغط Build** → ستحصل على `MoneyTransfer-Setup-1.0.0.exe`

---

## الطريقة 3: استخدام سكربت PowerShell التلقائي

إذا كان لديك إنترنت **مرة واحدة فقط**:

1. افتح PowerShell كمسؤول (Run as Administrator)
2. شغّل:
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force
   .\install.ps1
   ```

---

## ملاحظات مهمة

- **الحجم المتوقع:** ~500 MB (بسبب MongoDB)
- **النظام:** Windows 10/11 64-bit فقط
- **الذاكرة:** 2GB RAM كحد أدنى

---

## بيانات الدخول

| المستخدم | كلمة المرور |
|----------|-------------|
| admin | admin123 |

---

## الروابط بعد التشغيل

- الواجهة: http://localhost:3000
- API: http://localhost:8001/docs
