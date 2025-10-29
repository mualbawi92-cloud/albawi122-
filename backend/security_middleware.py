# Security Middleware for FastAPI
# Middleware لإضافة طبقات الأمان

from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from datetime import datetime, timezone
import time

from security_config import (
    check_ip_blocked,
    record_failed_attempt,
    log_security_event,
    SECURITY_HEADERS,
    sanitize_input
)

class SecurityMiddleware(BaseHTTPMiddleware):
    """Middleware شامل للأمان"""
    
    async def dispatch(self, request: Request, call_next):
        # الحصول على IP
        client_ip = request.client.host
        
        # 1. التحقق من حظر IP
        if check_ip_blocked(client_ip):
            log_security_event(
                action='blocked_ip_access',
                user_id=None,
                ip=client_ip,
                status='blocked'
            )
            return JSONResponse(
                status_code=403,
                content={"detail": "تم حظر الوصول من هذا IP"}
            )
        
        # 2. تسجيل وقت البداية
        start_time = time.time()
        
        # 3. معالجة الطلب
        try:
            response = await call_next(request)
        except Exception as e:
            # تسجيل الخطأ
            log_security_event(
                action='request_error',
                user_id=None,
                ip=client_ip,
                status='error',
                details={'error': str(e)}
            )
            raise
        
        # 4. إضافة Security Headers
        for header_name, header_value in SECURITY_HEADERS.items():
            response.headers[header_name] = header_value
        
        # 5. تسجيل وقت الاستجابة
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        
        # 6. إزالة headers غير آمنة
        response.headers.pop("Server", None)
        response.headers.pop("X-Powered-By", None)
        
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware لتسجيل جميع الطلبات"""
    
    async def dispatch(self, request: Request, call_next):
        # تسجيل الطلب
        client_ip = request.client.host
        method = request.method
        url = str(request.url)
        
        # عدم تسجيل routes الحساسة بالكامل
        sensitive_routes = ['/login', '/register']
        log_url = url if not any(route in url for route in sensitive_routes) else url.split('?')[0]
        
        print(f"[REQUEST] {method} {log_url} from {client_ip}")
        
        response = await call_next(request)
        
        # تسجيل الاستجابة
        print(f"[RESPONSE] {method} {log_url} - Status: {response.status_code}")
        
        return response


class InputSanitizationMiddleware(BaseHTTPMiddleware):
    """Middleware لتنظيف المدخلات"""
    
    async def dispatch(self, request: Request, call_next):
        # تنظيف query parameters
        if request.query_params:
            # لا يمكن تعديل query_params مباشرة، لكن يمكن التحقق منها
            pass
        
        # معالجة الطلب
        response = await call_next(request)
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware للحد من الطلبات"""
    
    def __init__(self, app, max_requests: int = 100, window: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window = window  # بالثواني
        self.requests = {}  # {ip: [(timestamp), ...]}
    
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host
        now = time.time()
        
        # تنظيف الطلبات القديمة
        if client_ip in self.requests:
            self.requests[client_ip] = [
                ts for ts in self.requests[client_ip]
                if now - ts < self.window
            ]
        else:
            self.requests[client_ip] = []
        
        # التحقق من الحد
        if len(self.requests[client_ip]) >= self.max_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": "تجاوزت الحد الأقصى للطلبات. يرجى المحاولة لاحقاً."}
            )
        
        # إضافة الطلب الحالي
        self.requests[client_ip].append(now)
        
        response = await call_next(request)
        
        # إضافة معلومات Rate Limit في الـ headers
        response.headers["X-RateLimit-Limit"] = str(self.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(
            self.max_requests - len(self.requests[client_ip])
        )
        response.headers["X-RateLimit-Reset"] = str(int(now + self.window))
        
        return response


class SQLInjectionProtectionMiddleware(BaseHTTPMiddleware):
    """Middleware للحماية من SQL/NoSQL Injection"""
    
    DANGEROUS_PATTERNS = [
        r'\$where',
        r'\$function',
        r'<script',
        r'javascript:',
        r'onerror=',
        r'onload=',
    ]
    
    async def dispatch(self, request: Request, call_next):
        # فحص URL
        url_lower = str(request.url).lower()
        
        for pattern in self.DANGEROUS_PATTERNS:
            if pattern.lower() in url_lower:
                log_security_event(
                    action='injection_attempt',
                    user_id=None,
                    ip=request.client.host,
                    status='blocked',
                    details={'pattern': pattern, 'url': str(request.url)}
                )
                return JSONResponse(
                    status_code=400,
                    content={"detail": "طلب غير صالح"}
                )
        
        response = await call_next(request)
        return response


class TimeoutMiddleware(BaseHTTPMiddleware):
    """Middleware للحد من وقت الطلب"""
    
    def __init__(self, app, timeout_seconds: int = 30):
        super().__init__(app)
        self.timeout_seconds = timeout_seconds
    
    async def dispatch(self, request: Request, call_next):
        import asyncio
        
        try:
            response = await asyncio.wait_for(
                call_next(request),
                timeout=self.timeout_seconds
            )
            return response
        except asyncio.TimeoutError:
            return JSONResponse(
                status_code=504,
                content={"detail": "انتهت مهلة الطلب"}
            )


class CORSSecurityMiddleware(BaseHTTPMiddleware):
    """Middleware محكم لـ CORS"""
    
    def __init__(self, app, allowed_origins: list):
        super().__init__(app)
        self.allowed_origins = allowed_origins
    
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get('origin')
        
        # التحقق من Origin
        if origin and origin not in self.allowed_origins:
            # يمكن رفض الطلب أو تسجيله
            log_security_event(
                action='cors_violation',
                user_id=None,
                ip=request.client.host,
                status='warning',
                details={'origin': origin}
            )
        
        response = await call_next(request)
        return response
