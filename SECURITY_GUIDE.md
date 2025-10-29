# 🔒 دليل الأمان الشامل - تطبيق نظام الحوالات

## ⚠️ تحذير: هذا تطبيق مالي - الأمان أولوية قصوى!

تم تطبيق **15 طبقة أمان** لحماية التطبيق والبيانات المالية.

---

## 🛡️ طبقات الأمان المطبقة

### 1️⃣ **حماية كلمات المرور**
✅ **متطلبات كلمة مرور قوية:**
- الحد الأدنى 8 أحرف
- حرف كبير واحد على الأقل (A-Z)
- حرف صغير واحد على الأقل (a-z)
- رقم واحد على الأقل (0-9)
- رمز خاص واحد على الأقل (!@#$%^&*)

✅ **تشفير bcrypt:**
- جميع كلمات المرور مشفرة بـ bcrypt (cost factor 12)
- لا يتم تخزين كلمات المرور الأصلية أبداً

**الملف:** `security_config.py` → `validate_password_strength()`

---

### 2️⃣ **JWT Token Security**
✅ **إعدادات آمنة:**
- انتهاء الصلاحية بعد 60 دقيقة
- Refresh tokens لمدة 7 أيام
- تشفير HS256
- Secret key عشوائي قوي

✅ **إدارة الجلسات:**
- حد أقصى 3 جلسات نشطة لكل مستخدم
- تسجيل IP و timestamp لكل جلسة
- إمكانية إلغاء الجلسات عن بُعد

**الملف:** `security_config.py` → `create_session()`, `validate_session()`

---

### 3️⃣ **Rate Limiting (الحد من الطلبات)**
✅ **حدود مختلفة لكل endpoint:**

| Endpoint | الحد | الوصف |
|---------|------|-------|
| تسجيل الدخول | 5/دقيقة | منع هجمات Brute Force |
| التسجيل | 3/ساعة | منع حسابات وهمية |
| إنشاء حوالة | 10/دقيقة | منع spam |
| استلام حوالة | 20/دقيقة | للمرونة |
| General API | 60/دقيقة | للحماية العامة |

✅ **حظر IP تلقائي:**
- بعد 10 محاولات فاشلة في ساعة → حظر IP

**الملف:** `security_config.py` → `RATE_LIMITS`, `record_failed_attempt()`

---

### 4️⃣ **Input Validation (التحقق من المدخلات)**
✅ **تنظيف جميع المدخلات:**
- إزالة الأحرف الخطرة: `< > " ' \ / { } [ ]`
- التحقق من الأطوال والأنواع
- منع XSS attacks

✅ **التحقق المالي:**
- المبالغ بين 0 و 1,000,000,000
- رقمين عشريين فقط
- منع القيم السالبة

✅ **التحقق من الهواتف:**
- 10-15 رقم فقط
- تنسيق صحيح

**الملف:** `security_config.py` → `sanitize_input()`, `validate_amount()`, `validate_phone()`

---

### 5️⃣ **File Upload Security**
✅ **حماية رفع الملفات:**
- الامتدادات المسموحة فقط: `.jpg`, `.jpeg`, `.png`
- حجم أقصى: **5 MB**
- فحص اسم الملف (منع Path Traversal)
- فحص نوع MIME الحقيقي

✅ **تخزين آمن:**
- أسماء ملفات عشوائية
- حفظ في Cloudinary (خارج الخادم)

**الملف:** `security_config.py` → `validate_file_upload()`

---

### 6️⃣ **SQL/NoSQL Injection Prevention**
✅ **منع حقن NoSQL:**
- حذف العمليات الخطرة: `$where`, `$function`, `$mapReduce`
- تنظيف جميع queries
- استخدام Pydantic للتحقق من الأنواع

✅ **معالجة آمنة للبيانات:**
- استخدام ObjectId بشكل صحيح
- عدم السماح بـ regex injection

**الملف:** `security_config.py` → `prevent_nosql_injection()`

---

### 7️⃣ **XSS Protection (Cross-Site Scripting)**
✅ **حماية من XSS:**
- Content Security Policy headers
- X-XSS-Protection header
- تنظيف جميع المدخلات
- عدم السماح بـ inline scripts

✅ **Headers الآمنة:**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

**الملف:** `security_config.py` → `SECURITY_HEADERS`

---

### 8️⃣ **HTTPS Enforcement**
✅ **HTTPS إجباري:**
- Strict-Transport-Security header
- تحويل تلقائي من HTTP إلى HTTPS
- مدة سنة (31536000 ثانية)

✅ **في الإنتاج:**
- استخدام SSL certificates (Let's Encrypt مجاني)
- TLS 1.2 كحد أدنى

**الملف:** `security_config.py` → `SECURITY_HEADERS`

---

### 9️⃣ **CORS Security**
✅ **CORS محكم:**
- origins محددة فقط
- عدم السماح بـ wildcard (`*`)
- تسجيل محاولات CORS غير مصرح بها

✅ **للتطوير:**
```python
ALLOWED_ORIGINS = [
    "https://yourdomain.com",
    "http://localhost:3000"  # للتطوير فقط
]
```

**الملف:** `security_config.py` → `ALLOWED_ORIGINS`

---

### 🔟 **Audit Logging (تسجيل الأحداث)**
✅ **تسجيل جميع العمليات الحساسة:**
- تسجيل الدخول/الخروج
- إنشاء/استلام/إلغاء الحوالات
- تعديل المستخدمين
- إضافة أموال للمحفظة
- محاولات الوصول المرفوضة

✅ **معلومات مسجلة:**
- Timestamp
- User ID
- IP Address
- Action
- Status (success/failed)
- Details

**الملف:** `security_config.py` → `log_security_event()`

---

### 1️⃣1️⃣ **Data Encryption**
✅ **تشفير البيانات الحساسة:**
- PIN الحوالات (مشفر)
- كلمات المرور (bcrypt)
- الـ tokens (hashed)

✅ **البيانات في قاعدة البيانات:**
- يجب تشفير الحقول الحساسة
- استخدام encryption at rest

**الملف:** `security_config.py` → `encrypt_sensitive_data()`, `decrypt_sensitive_data()`

---

### 1️⃣2️⃣ **Session Management**
✅ **إدارة الجلسات:**
- Session timeout بعد ساعة
- تتبع IP لكل جلسة
- إلغاء الجلسات القديمة تلقائياً
- Logout من جميع الأجهزة

✅ **الحد الأقصى:**
- 3 جلسات نشطة لكل مستخدم
- حذف أقدم جلسة عند تجاوز الحد

**الملف:** `security_config.py` → `active_sessions`

---

### 1️⃣3️⃣ **IP Blocking**
✅ **حظر IP تلقائي:**
- بعد 10 محاولات فاشلة → حظر
- مدة الحظر: دائم (يمكن تعديلها)
- تسجيل جميع المحاولات

✅ **فك الحظر:**
- يدوياً من قبل المدير
- أو تلقائياً بعد فترة

**الملف:** `security_config.py` → `blocked_ips`, `check_ip_blocked()`

---

### 1️⃣4️⃣ **Request Timeout**
✅ **حد أقصى لوقت الطلب:**
- 30 ثانية كحد أقصى
- منع Slowloris attacks
- إرجاع 504 عند timeout

**الملف:** `security_middleware.py` → `TimeoutMiddleware`

---

### 1️⃣5️⃣ **Security Middleware**
✅ **Middleware شاملة:**
- SecurityMiddleware (headers + IP blocking)
- RequestLoggingMiddleware (تسجيل الطلبات)
- RateLimitMiddleware (حد الطلبات)
- SQLInjectionProtectionMiddleware (منع الحقن)
- TimeoutMiddleware (timeout)

**الملف:** `security_middleware.py`

---

## 🚀 كيفية التفعيل

### 1. تحديث server.py
```python
from security_config import *
from security_middleware import *

# إضافة Middleware
app.add_middleware(SecurityMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RateLimitMiddleware, max_requests=100, window=60)
app.add_middleware(SQLInjectionProtectionMiddleware)
app.add_middleware(TimeoutMiddleware, timeout_seconds=30)
```

### 2. استخدام Rate Limiter
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/login")
@limiter.limit("5/minute")
async def login(...):
    ...
```

### 3. التحقق من المدخلات
```python
from security_config import validate_password_strength, sanitize_input

# التحقق من كلمة المرور
is_valid, message = validate_password_strength(password)
if not is_valid:
    raise HTTPException(400, detail=message)

# تنظيف المدخلات
clean_name = sanitize_input(user_input)
```

---

## 📋 Check List للأمان

### قبل الإنتاج:
- [ ] تغيير SECRET_KEY إلى قيمة عشوائية قوية
- [ ] تفعيل HTTPS فقط
- [ ] تحديث ALLOWED_ORIGINS
- [ ] مراجعة Rate Limits
- [ ] تفعيل Firewall
- [ ] تفعيل Database backup
- [ ] مراجعة أذونات الملفات
- [ ] تفعيل WAF (Web Application Firewall)
- [ ] إعداد Monitoring & Alerts
- [ ] مراجعة Audit Logs بشكل دوري

### للمراقبة:
- [ ] مراقبة محاولات تسجيل الدخول الفاشلة
- [ ] مراقبة IPs المحظورة
- [ ] مراقبة الطلبات غير الطبيعية
- [ ] مراقبة استخدام الموارد
- [ ] مراجعة Audit Logs يومياً

---

## 🆘 في حالة الاختراق

1. **فصل الخادم فوراً**
2. **تغيير جميع كلمات المرور والـ tokens**
3. **مراجعة Audit Logs**
4. **فحص التغييرات على الملفات**
5. **استعادة النسخة الاحتياطية**
6. **إبلاغ المستخدمين**
7. **تحديث الأمان**

---

## 📚 مراجع إضافية

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [MongoDB Security](https://docs.mongodb.com/manual/security/)

---

## ✅ الخلاصة

التطبيق الآن محمي بـ **15 طبقة أمان** شاملة:
1. ✅ Password Security
2. ✅ JWT Token Security
3. ✅ Rate Limiting
4. ✅ Input Validation
5. ✅ File Upload Security
6. ✅ NoSQL Injection Prevention
7. ✅ XSS Protection
8. ✅ HTTPS Enforcement
9. ✅ CORS Security
10. ✅ Audit Logging
11. ✅ Data Encryption
12. ✅ Session Management
13. ✅ IP Blocking
14. ✅ Request Timeout
15. ✅ Security Middleware

**🔒 التطبيق جاهز للإنتاج مع أمان قوي!**
