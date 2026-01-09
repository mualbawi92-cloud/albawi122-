@echo off
chcp 65001 > nul
echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║       نظام إدارة الحوالات المالية                      ║
echo ║       Money Transfer Management System                 ║
echo ╚════════════════════════════════════════════════════════╝
echo.

:: Check if Docker is installed
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker غير مثبت!
    echo.
    echo يرجى تثبيت Docker Desktop من:
    echo https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

:: Check if Docker is running
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker ليس قيد التشغيل!
    echo.
    echo يرجى تشغيل Docker Desktop أولاً
    echo.
    pause
    exit /b 1
)

echo ✅ Docker جاهز
echo.
echo 🚀 جاري تشغيل النظام...
echo    قد يستغرق هذا بضع دقائق في المرة الأولى
echo.

:: Start containers
docker-compose up -d --build

if %errorlevel% equ 0 (
    echo.
    echo ════════════════════════════════════════════════════════
    echo.
    echo ✅ تم تشغيل النظام بنجاح!
    echo.
    echo 🌐 الواجهة: http://localhost:3000
    echo 📡 API: http://localhost:8001
    echo 📚 التوثيق: http://localhost:8001/docs
    echo.
    echo 🔑 بيانات الدخول:
    echo    المستخدم: admin
    echo    كلمة المرور: admin123
    echo.
    echo ════════════════════════════════════════════════════════
    echo.
    echo لإيقاف النظام: docker-compose down
    echo.
    
    :: Open browser
    timeout /t 5 /nobreak > nul
    start http://localhost:3000
) else (
    echo.
    echo ❌ حدث خطأ أثناء التشغيل
    echo يرجى التحقق من سجلات Docker
    echo.
)

pause
