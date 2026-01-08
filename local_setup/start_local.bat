@echo off
echo ========================================
echo    نظام الحوالات - التشغيل المحلي
echo ========================================
echo.

echo [1/3] التحقق من MongoDB...
net start MongoDB 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  يرجى تثبيت MongoDB أولاً
    pause
    exit
)
echo ✅ MongoDB يعمل
echo.

echo [2/3] تشغيل Backend...
start cmd /k "cd backend && venv\Scripts\activate && uvicorn server:app --host 0.0.0.0 --port 8001 --reload"
echo ✅ Backend started on port 8001
echo.

timeout /t 5 /nobreak > nul

echo [3/3] تشغيل Frontend...
start cmd /k "cd frontend && yarn start"
echo ✅ Frontend started on port 3000
echo.

echo ========================================
echo 🎉 التطبيق يعمل!
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:8001
echo ========================================
pause
