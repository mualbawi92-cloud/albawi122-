# 💰 نظام الحوالات المالية - Money Transfer System

نظام متكامل لإدارة الحوالات المالية بين الصيارفة مع واجهة عربية كاملة (RTL)

## 🌟 المميزات الرئيسية

### 🔐 الأمان والتدقيق
- **JWT Authentication** مع rate limiting (5 محاولات/15 دقيقة)
- **PIN Protection** - رمز سري 4 أرقام لكل حوالة
- **Audit Logs** - سجل شامل لجميع العمليات
- **Cloudinary** - رفع صور الهوية بشكل آمن
- **bcrypt** - تشفير كلمات المرور والPINs

### 📊 إدارة الحوالات
- إنشاء حوالة مع رمز فريد وPIN
- استلام حوالة بإدخال PIN وصورة هوية
- تتبع الحوالات (واردة/صادرة)
- Transfer Code مع check digit (mod97)
- إشعارات فورية عبر WebSocket

### 🎨 تصميم عصري
- RTL كامل للعربية
- خط Cairo احترافي
- ألوان: أزرق داكن (#0A2342) + ذهبي (#D4AF37)
- Shadcn/UI Components
- Responsive Design

## 👤 حسابات الدخول

**Admin:** `admin` / `admin123`
**صراف بغداد:** `agent_baghdad` / `agent123`
**صراف البصرة:** `agent_basra` / `agent123`

## 🚀 التشغيل السريع

```bash
# Backend
cd /app/backend
pip install -r requirements.txt
python /app/scripts/create_admin.py
sudo supervisorctl restart backend

# Frontend
cd /app/frontend
yarn install
sudo supervisorctl restart frontend
```

## 📡 API Endpoints

- `POST /api/login` - تسجيل دخول
- `POST /api/transfers` - إنشاء حوالة
- `GET /api/transfers` - قائمة الحوالات
- `POST /api/transfers/{id}/receive` - استلام حوالة
- `GET /api/agents` - قائمة الصرافين
- `GET /api/dashboard/stats` - إحصائيات

## 🔄 سير العمل

1. **إنشاء**: صراف → إنشاء حوالة → يحصل على Code + PIN
2. **إشعار**: WebSocket يرسل إشعار للصراف المستلم
3. **استلام**: صراف مستلم → إدخال PIN + صورة هوية → إكمال

## 🛠 التقنيات

**Backend:** FastAPI, MongoDB, JWT, bcrypt, Cloudinary, Socket.IO
**Frontend:** React 19, Tailwind CSS, Shadcn/UI, Socket.IO Client

---
**الإصدار:** 1.0.0 | **التاريخ:** أكتوبر 2025
