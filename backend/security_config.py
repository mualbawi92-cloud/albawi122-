# Security Configuration for Money Transfer Application
# هذا الملف يحتوي على جميع إعدادات الأمان

from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from slowapi import Limiter
from slowapi.util import get_remote_address
from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets
import hashlib
import re

# ============ Rate Limiting ============
# حماية من هجمات DDoS والطلبات الكثيرة

limiter = Limiter(key_func=get_remote_address)

# حدود مختلفة لكل endpoint
RATE_LIMITS = {
    "login": "5/minute",              # 5 محاولات تسجيل دخول في الدقيقة
    "register": "3/hour",             # 3 تسجيلات في الساعة
    "transfer_create": "10/minute",   # 10 حوالات في الدقيقة
    "transfer_receive": "20/minute",  # 20 استلام في الدقيقة
    "general": "60/minute",           # 60 طلب عام في الدقيقة
}

# ============ Password Security ============
# متطلبات كلمة المرور القوية

PASSWORD_MIN_LENGTH = 8
PASSWORD_REQUIREMENTS = {
    'min_length': 8,
    'require_uppercase': True,
    'require_lowercase': True,
    'require_digit': True,
    'require_special': True,
}

def validate_password_strength(password: str) -> tuple[bool, str]:
    """التحقق من قوة كلمة المرور"""
    if len(password) < PASSWORD_MIN_LENGTH:
        return False, f"كلمة المرور يجب أن تكون {PASSWORD_MIN_LENGTH} أحرف على الأقل"
    
    if PASSWORD_REQUIREMENTS['require_uppercase'] and not re.search(r'[A-Z]', password):
        return False, "كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل"
    
    if PASSWORD_REQUIREMENTS['require_lowercase'] and not re.search(r'[a-z]', password):
        return False, "كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل"
    
    if PASSWORD_REQUIREMENTS['require_digit'] and not re.search(r'\d', password):
        return False, "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل"
    
    if PASSWORD_REQUIREMENTS['require_special'] and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل (!@#$%^&*)"
    
    return True, "كلمة مرور قوية"

# ============ Input Validation ============
# التحقق من المدخلات لمنع الحقن والهجمات

def sanitize_input(text: str) -> str:
    """تنظيف المدخلات من الأحرف الخطرة"""
    if not text:
        return text
    
    # إزالة الأحرف الخطرة
    dangerous_chars = ['<', '>', '"', "'", '\\', '/', '{', '}', '[', ']']
    for char in dangerous_chars:
        text = text.replace(char, '')
    
    return text.strip()

def validate_amount(amount: float) -> tuple[bool, str]:
    """التحقق من صحة المبلغ"""
    if amount <= 0:
        return False, "المبلغ يجب أن يكون أكبر من صفر"
    
    if amount > 1000000000:  # 1 مليار حد أقصى
        return False, "المبلغ تجاوز الحد الأقصى المسموح"
    
    # التحقق من عدد الأرقام العشرية
    if len(str(amount).split('.')[-1]) > 2:
        return False, "المبلغ يجب أن يحتوي على رقمين عشريين فقط"
    
    return True, "مبلغ صحيح"

def validate_phone(phone: str) -> tuple[bool, str]:
    """التحقق من صحة رقم الهاتف"""
    if not phone:
        return True, "رقم الهاتف اختياري"
    
    # إزالة المسافات والرموز
    phone_clean = re.sub(r'[^\d+]', '', phone)
    
    # التحقق من الطول
    if len(phone_clean) < 10 or len(phone_clean) > 15:
        return False, "رقم الهاتف يجب أن يكون بين 10 و 15 رقم"
    
    # التحقق من البداية
    if not phone_clean.startswith(('+', '0', '7', '9')):
        return False, "رقم الهاتف غير صحيح"
    
    return True, "رقم هاتف صحيح"

# ============ Token Security ============
# إدارة الـ JWT tokens بشكل آمن

TOKEN_EXPIRY_MINUTES = 60  # انتهاء الصلاحية بعد ساعة
REFRESH_TOKEN_EXPIRY_DAYS = 7  # refresh token لمدة أسبوع

def generate_secure_token() -> str:
    """توليد token آمن عشوائي"""
    return secrets.token_urlsafe(32)

def hash_token(token: str) -> str:
    """تشفير الـ token"""
    return hashlib.sha256(token.encode()).hexdigest()

# ============ File Upload Security ============
# حماية رفع الملفات

ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB حد أقصى

def validate_file_upload(filename: str, file_size: int) -> tuple[bool, str]:
    """التحقق من أمان الملف المرفوع"""
    # التحقق من الامتداد
    ext = '.' + filename.lower().split('.')[-1] if '.' in filename else ''
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return False, f"نوع الملف غير مسموح. الامتدادات المسموحة: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
    
    # التحقق من الحجم
    if file_size > MAX_FILE_SIZE:
        return False, f"حجم الملف تجاوز الحد الأقصى ({MAX_FILE_SIZE // (1024*1024)} MB)"
    
    # التحقق من الاسم
    if '..' in filename or '/' in filename or '\\' in filename:
        return False, "اسم الملف يحتوي على أحرف غير مسموحة"
    
    return True, "ملف آمن"

# ============ IP Blocking ============
# حظر IP في حالة محاولات الاختراق

blocked_ips = set()
failed_attempts = {}  # {ip: [(timestamp, action), ...]}

def check_ip_blocked(ip: str) -> bool:
    """التحقق من حظر IP"""
    return ip in blocked_ips

def record_failed_attempt(ip: str, action: str = 'login'):
    """تسجيل محاولة فاشلة"""
    now = datetime.now(timezone.utc)
    
    if ip not in failed_attempts:
        failed_attempts[ip] = []
    
    # إزالة المحاولات القديمة (أكثر من ساعة)
    failed_attempts[ip] = [
        (ts, act) for ts, act in failed_attempts[ip]
        if (now - ts).total_seconds() < 3600
    ]
    
    # إضافة المحاولة الجديدة
    failed_attempts[ip].append((now, action))
    
    # حظر IP إذا تجاوز 10 محاولات فاشلة
    if len(failed_attempts[ip]) >= 10:
        blocked_ips.add(ip)
        return True
    
    return False

def clear_failed_attempts(ip: str):
    """مسح المحاولات الفاشلة عند النجاح"""
    if ip in failed_attempts:
        failed_attempts[ip] = []

# ============ Session Security ============
# إدارة الجلسات بشكل آمن

active_sessions = {}  # {user_id: {session_id: {token, ip, created_at, last_active}}}

MAX_SESSIONS_PER_USER = 3  # حد أقصى 3 جلسات لكل مستخدم

def create_session(user_id: str, ip: str, token: str) -> str:
    """إنشاء جلسة جديدة"""
    session_id = generate_secure_token()
    
    if user_id not in active_sessions:
        active_sessions[user_id] = {}
    
    # حذف الجلسات القديمة إذا تجاوز الحد
    if len(active_sessions[user_id]) >= MAX_SESSIONS_PER_USER:
        # حذف أقدم جلسة
        oldest_session = min(
            active_sessions[user_id].items(),
            key=lambda x: x[1]['last_active']
        )[0]
        del active_sessions[user_id][oldest_session]
    
    active_sessions[user_id][session_id] = {
        'token': hash_token(token),
        'ip': ip,
        'created_at': datetime.now(timezone.utc),
        'last_active': datetime.now(timezone.utc)
    }
    
    return session_id

def validate_session(user_id: str, token: str, ip: str) -> bool:
    """التحقق من صحة الجلسة"""
    if user_id not in active_sessions:
        return False
    
    token_hash = hash_token(token)
    
    for session_id, session_data in active_sessions[user_id].items():
        if session_data['token'] == token_hash:
            # تحديث آخر نشاط
            session_data['last_active'] = datetime.now(timezone.utc)
            
            # التحقق من IP (اختياري - يمكن تعطيله للأجهزة المتنقلة)
            # if session_data['ip'] != ip:
            #     return False
            
            return True
    
    return False

def revoke_session(user_id: str, session_id: str):
    """إلغاء جلسة"""
    if user_id in active_sessions and session_id in active_sessions[user_id]:
        del active_sessions[user_id][session_id]

def revoke_all_sessions(user_id: str):
    """إلغاء جميع جلسات المستخدم"""
    if user_id in active_sessions:
        active_sessions[user_id] = {}

# ============ Audit Logging ============
# تسجيل جميع العمليات الحساسة

SENSITIVE_ACTIONS = [
    'login', 'logout', 'password_change',
    'transfer_create', 'transfer_receive', 'transfer_cancel',
    'user_create', 'user_update', 'user_delete',
    'wallet_add', 'commission_rate_create'
]

def log_security_event(
    action: str,
    user_id: Optional[str],
    ip: str,
    status: str,
    details: dict = None
):
    """تسجيل حدث أمني"""
    event = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'action': action,
        'user_id': user_id,
        'ip': ip,
        'status': status,  # 'success' or 'failed'
        'details': details or {}
    }
    
    # يمكن حفظها في قاعدة البيانات أو ملف log
    print(f"[SECURITY] {event}")
    return event

# ============ Data Encryption ============
# تشفير البيانات الحساسة

def encrypt_sensitive_data(data: str, key: str) -> str:
    """تشفير البيانات الحساسة"""
    # يمكن استخدام Fernet أو AES
    from cryptography.fernet import Fernet
    f = Fernet(key.encode())
    return f.encrypt(data.encode()).decode()

def decrypt_sensitive_data(encrypted_data: str, key: str) -> str:
    """فك تشفير البيانات"""
    from cryptography.fernet import Fernet
    f = Fernet(key.encode())
    return f.decrypt(encrypted_data.encode()).decode()

# ============ HTTPS Configuration ============
# إعدادات HTTPS الإجبارية

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(self)"
}

# ============ CORS Configuration ============
# إعدادات CORS محكمة

ALLOWED_ORIGINS = [
    "https://yourdomain.com",  # استبدل بنطاقك
    "http://localhost:3000",   # للتطوير فقط
]

# ============ Database Security ============
# حماية قاعدة البيانات

def prevent_nosql_injection(query: dict) -> dict:
    """منع حقن NoSQL"""
    # إزالة العمليات الخطرة
    dangerous_operators = ['$where', '$function', '$accumulator', '$mapReduce']
    
    def clean_dict(d):
        if not isinstance(d, dict):
            return d
        
        cleaned = {}
        for key, value in d.items():
            # إزالة المفاتيح الخطرة
            if key in dangerous_operators:
                continue
            
            # تنظيف القيم المتداخلة
            if isinstance(value, dict):
                cleaned[key] = clean_dict(value)
            elif isinstance(value, list):
                cleaned[key] = [clean_dict(item) if isinstance(item, dict) else item for item in value]
            else:
                cleaned[key] = value
        
        return cleaned
    
    return clean_dict(query)
