@echo off
chcp 65001 > nul
echo.
echo 🛑 جاري إيقاف النظام...
echo.

docker-compose down

echo.
echo ✅ تم إيقاف النظام
echo.
pause
